/**
 * Airas Audio Manager (Web Audio API)
 * 
 * 外部音声ファイルに依存せず、ブラウザ標準のWeb Audio APIのみで完全自己生成する
 * 超軽量・高精細リアルタイム音響システム：
 * 1. マインクラフト風の癒しアンビエント＆ピアノBGM (C418テイストのペンタトニック/長七度和音)
 * 2. 地形・足元材質（芝生・石畳・アスファルト・木床）に応じたリアルな足音SE
 * 3. 空間音響コンボリューション・リバーブ（駅舎・屋外・屋内での動的反響制御）
 * 4. ランボルギーニのリアルタイムV10エンジン唸り音＆ターボ加速SE
 * 5. ワンタップ完全ミュート制御 & 自動レジューム
 */

export type SurfaceType = 'grass' | 'stone' | 'road' | 'wood';

class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbWetGain: GainNode | null = null;
  private reverbDryGain: GainNode | null = null;

  // BGMステート
  private isBgmPlaying: boolean = false;
  private bgmTimer: any = null;
  private padGain: GainNode | null = null;
  private padOscs: OscillatorNode[] = [];

  // 車両エンジン音ステート
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private isEngineRunning: boolean = false;

  // ミュートステート
  private _isMuted: boolean = false;
  private _masterVolume: number = 0.7;

  constructor() {
    // ユーザー操作時に自動初期化
    if (typeof window !== 'undefined') {
      const unlockAudio = () => {
        this.init();
        window.removeEventListener('pointerdown', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
      };
      window.addEventListener('pointerdown', unlockAudio, { passive: true });
      window.addEventListener('keydown', unlockAudio, { passive: true });
    }
  }

  public init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();

      // マスターゲイン
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this._isMuted ? 0 : this._masterVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // BGMゲイン
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.setValueAtTime(0.45, this.ctx.currentTime);

      // SFXゲイン
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.65, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      // リアルタイム・コンボリューション・リバーブの合成
      this.setupReverb();

      // BGM自動開始
      this.startBgm();
    } catch (e) {
      console.warn('[AudioManager] Failed to initialize AudioContext:', e);
    }
  }

  /**
   * インパルス応答（IR）を数学的に自己生成してスタジオ品質のリバーブを構築
   */
  private setupReverb() {
    if (!this.ctx || !this.masterGain || !this.bgmGain) return;

    try {
      const sampleRate = this.ctx.sampleRate;
      const length = sampleRate * 3.0; // 3秒の贅沢な残響
      const decay = 2.8;
      const impulseBuffer = this.ctx.createBuffer(2, length, sampleRate);
      const left = impulseBuffer.getChannelData(0);
      const right = impulseBuffer.getChannelData(1);

      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * decay);
        left[i] = (Math.random() * 2 - 1) * env;
        right[i] = (Math.random() * 2 - 1) * env;
      }

      this.reverbNode = this.ctx.createConvolver();
      this.reverbNode.buffer = impulseBuffer;

      this.reverbWetGain = this.ctx.createGain();
      this.reverbWetGain.gain.setValueAtTime(0.25, this.ctx.currentTime); // 初期リバーブ深さ

      this.reverbDryGain = this.ctx.createGain();
      this.reverbDryGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

      // ルーティング
      this.bgmGain.connect(this.reverbDryGain);
      this.bgmGain.connect(this.reverbNode);
      this.reverbNode.connect(this.reverbWetGain);

      this.reverbDryGain.connect(this.masterGain);
      this.reverbWetGain.connect(this.masterGain);
    } catch (e) {
      console.warn('[AudioManager] Reverb setup failed, fallback to direct audio:', e);
      this.bgmGain.connect(this.masterGain);
    }
  }

  /**
   * 空間反響の動的調整 (駅舎・トンネル・屋内に入るとウェット感が増加)
   */
  public setReverbWet(wetLevel: number) {
    if (!this.ctx || !this.reverbWetGain) return;
    const clamped = Math.max(0.05, Math.min(0.7, wetLevel));
    this.reverbWetGain.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.3);
  }

  /**
   * ミュート切り替え
   */
  public setMuted(muted: boolean) {
    this._isMuted = muted;
    if (this.ctx && this.masterGain) {
      const targetGain = muted ? 0 : this._masterVolume;
      this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
    }
  }

  public get isMuted(): boolean {
    return this._isMuted;
  }

  /**
   * -------------------------------------------------------------
   * 🎵 マインクラフト風 癒しのアンビエント＆ピアノBGMジェネレーター
   * -------------------------------------------------------------
   */
  public startBgm() {
    if (this.isBgmPlaying || !this.ctx) return;
    this.isBgmPlaying = true;
    this.startAmbientPad();
    this.scheduleNextBgmPhrase();
  }

  public stopBgm() {
    this.isBgmPlaying = false;
    if (this.bgmTimer) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
    this.stopAmbientPad();
  }

  private startAmbientPad() {
    if (!this.ctx || !this.bgmGain) return;

    // 低音の温かいアンビエントドローン（MinecraftのSubwoofer/Ambient）
    const padGain = this.ctx.createGain();
    padGain.gain.setValueAtTime(0.01, this.ctx.currentTime);
    padGain.gain.setTargetAtTime(0.08, this.ctx.currentTime, 4.0); // ゆっくり立ち上がり

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, this.ctx.currentTime);

    // C2 (65.41Hz) と G2 (98.0Hz) のゆったりした2音
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(65.41, this.ctx.currentTime);

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(98.0, this.ctx.currentTime);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(padGain);
    padGain.connect(this.bgmGain);

    osc1.start();
    osc2.start();

    this.padGain = padGain;
    this.padOscs = [osc1, osc2];
  }

  private stopAmbientPad() {
    if (this.padGain && this.ctx) {
      this.padGain.gain.setTargetAtTime(0, this.ctx.currentTime, 1.0);
      setTimeout(() => {
        for (const osc of this.padOscs) {
          try { osc.stop(); osc.disconnect(); } catch (_) {}
        }
        this.padOscs = [];
        this.padGain = null;
      }, 1200);
    }
  }

  /**
   * マイクラ流：静寂の余白を挟みながら、ポロポロと優しいピアノが鳴る
   */
  private scheduleNextBgmPhrase() {
    if (!this.isBgmPlaying) return;

    const phrases = [
      // Cmaj7 (C4, E4, G4, B4)
      [261.63, 329.63, 392.00, 493.88],
      // Fmaj7 (F4, A4, C5, E5)
      [349.23, 440.00, 523.25, 659.25],
      // G6 (G4, B4, D5, E5)
      [392.00, 493.88, 587.33, 659.25],
      // Am9 (A3, C4, E4, B4)
      [220.00, 261.63, 329.63, 493.88],
      // Em7 (E4, G4, B4, D5)
      [329.63, 392.00, 493.88, 587.33],
    ];

    // ランダムにコード進行を選択
    const chord = phrases[Math.floor(Math.random() * phrases.length)];
    const noteCount = 3 + Math.floor(Math.random() * 3); // 3〜5音

    let delay = 0;
    for (let i = 0; i < noteCount; i++) {
      const freq = chord[Math.floor(Math.random() * chord.length)];
      // 音符のタイミング（ゆっくりランダム）
      setTimeout(() => {
        if (this.isBgmPlaying) {
          this.playPianoNote(freq, 0.18 + Math.random() * 0.12);
        }
      }, delay * 1000);
      delay += 0.8 + Math.random() * 1.4; // ゆったりした間隔
    }

    // 次のフレーズまでの静寂（マイクラ特有の8〜16秒の静けさ）
    const quietPause = (delay + 6 + Math.random() * 10) * 1000;
    this.bgmTimer = setTimeout(() => {
      this.scheduleNextBgmPhrase();
    }, quietPause);
  }

  /**
   * アコースティックピアノ・エレピ風の倍音合成
   */
  private playPianoNote(freq: number, velocity: number = 0.2) {
    if (!this.ctx || !this.bgmGain || this._isMuted) return;

    const t = this.ctx.currentTime;
    const noteGain = this.ctx.createGain();

    // ピアノのアタックと減衰 (速いアタック、自然な対数ディケイ)
    noteGain.gain.setValueAtTime(0, t);
    noteGain.gain.linearRampToValueAtTime(velocity, t + 0.012);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);

    // フィルター（高域をまろやかにするマインクラフトピアノの暖かみ）
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(freq * 3.5, 2400), t);

    // 基音 + 第2倍音 + わずかなデチューンで生ピアノの響きをシミュレート
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, t);

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 2.002, t);

    const osc2Gain = this.ctx.createGain();
    osc2Gain.gain.setValueAtTime(0.25, t);

    osc1.connect(filter);
    osc2.connect(osc2Gain);
    osc2Gain.connect(filter);

    filter.connect(noteGain);
    noteGain.connect(this.bgmGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 3.3);
    osc2.stop(t + 3.3);
  }

  /**
   * -------------------------------------------------------------
   * 👣 リアルな足音SE（路面材質別 ＆ リバーブ連携）
   * -------------------------------------------------------------
   */
  public playFootstep(surface: SurfaceType = 'stone') {
    if (!this.ctx || !this.sfxGain || this._isMuted) return;
    const t = this.ctx.currentTime;

    // ノイズバッファ作成 (0.07秒の微小パルス)
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.07);
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    const stepGain = this.ctx.createGain();

    // 路面ごとの周波数・エンベロープ特性
    switch (surface) {
      case 'grass':
        // 芝生：もさっとした低音＋やわらかい草こすれ音
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(750, t);
        filter.Q.setValueAtTime(1.2, t);
        stepGain.gain.setValueAtTime(0.18, t);
        stepGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        break;

      case 'road':
        // アスファルト：重厚な砂利・靴底の低音アタック
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1100, t);
        filter.Q.setValueAtTime(1.8, t);
        stepGain.gain.setValueAtTime(0.22, t);
        stepGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        break;

      case 'wood':
        // 木床：コトッという中空の反響音
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(480, t);
        filter.Q.setValueAtTime(3.5, t);
        stepGain.gain.setValueAtTime(0.26, t);
        stepGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        break;

      case 'stone':
      default:
        // 石畳・駅ホーム：カツッと響くシャープな靴音
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1800, t);
        filter.Q.setValueAtTime(2.2, t);
        stepGain.gain.setValueAtTime(0.24, t);
        stepGain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
        break;
    }

    noiseSource.connect(filter);
    filter.connect(stepGain);
    stepGain.connect(this.sfxGain);

    // リバーブにも送る（空間の広がり感を付与）
    if (this.reverbNode && this.reverbWetGain) {
      const stepReverbSend = this.ctx.createGain();
      stepReverbSend.gain.setValueAtTime(0.15, t);
      filter.connect(stepReverbSend);
      stepReverbSend.connect(this.reverbNode);
    }

    noiseSource.start(t);
    noiseSource.stop(t + 0.08);
  }

  /**
   * 🏃 ジャンプ音 (軽快な風切り音)
   */
  public playJump() {
    if (!this.ctx || !this.sfxGain || this._isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(480, t + 0.12);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.15);
  }

  /**
   * 💥 着地音 (ドサッという体重移動と反響)
   */
  public playLand() {
    if (!this.ctx || !this.sfxGain || this._isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.1);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.13);
  }

  /**
   * 🏎️ ランボルギーニ乗車音（重厚なドアラッチ & セルモーター）
   */
  public playVehicleEnter() {
    if (!this.ctx || !this.sfxGain || this._isMuted) return;
    const t = this.ctx.currentTime;

    // ドア開閉のカチャッという金属音
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(380, t);
    osc.frequency.setValueAtTime(520, t + 0.05);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.16);

    // エンジン起動イグニッション
    setTimeout(() => {
      this.startEngine();
    }, 120);
  }

  /**
   * 🏎️ 降車音
   */
  public playVehicleExit() {
    this.stopEngine();
    if (!this.ctx || !this.sfxGain || this._isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.09);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.11);
  }

  /**
   * 🏎️ エンジン音の連続合成（リアルタイム回転数追従）
   */
  private startEngine() {
    if (this.isEngineRunning || !this.ctx || !this.sfxGain) return;
    this.isEngineRunning = true;

    const t = this.ctx.currentTime;

    // 低音V10の唸りオシレーター
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(45, t); // アイドリング 45Hz

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(90, t);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(160, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.setTargetAtTime(0.18, t, 0.1);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start(t);
    osc2.start(t);

    this.engineOsc1 = osc1;
    this.engineOsc2 = osc2;
    this.engineFilter = filter;
    this.engineGain = gain;
  }

  /**
   * 走行速度・ニトロダッシュに応じたエンジンサウンドのリアルタイム更新
   */
  public updateEngine(isMoving: boolean, isSprint: boolean, speed: number) {
    if (!this.isEngineRunning || !this.ctx) {
      if (this.isEngineRunning) return;
      this.startEngine();
      return;
    }

    const t = this.ctx.currentTime;
    // アイドリング: 45Hz, 巡航: 120Hz, ニトロ加速: 260Hz
    let targetFreq = 45;
    let targetCutoff = 160;
    let targetVol = 0.14;

    if (isMoving) {
      if (isSprint) {
        targetFreq = 260;
        targetCutoff = 800;
        targetVol = 0.28;
      } else {
        targetFreq = 120 + Math.min(speed / 10, 60);
        targetCutoff = 380;
        targetVol = 0.22;
      }
    }

    if (this.engineOsc1) {
      this.engineOsc1.frequency.setTargetAtTime(targetFreq, t, 0.08);
    }
    if (this.engineOsc2) {
      this.engineOsc2.frequency.setTargetAtTime(targetFreq * 1.5, t, 0.08);
    }
    if (this.engineFilter) {
      this.engineFilter.frequency.setTargetAtTime(targetCutoff, t, 0.08);
    }
    if (this.engineGain) {
      this.engineGain.gain.setTargetAtTime(targetVol, t, 0.08);
    }
  }

  public stopEngine() {
    if (!this.isEngineRunning) return;
    this.isEngineRunning = false;

    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      setTimeout(() => {
        try {
          this.engineOsc1?.stop();
          this.engineOsc2?.stop();
          this.engineOsc1?.disconnect();
          this.engineOsc2?.disconnect();
        } catch (_) {}
        this.engineOsc1 = null;
        this.engineOsc2 = null;
        this.engineGain = null;
        this.engineFilter = null;
      }, 150);
    }
  }

  /**
   * UIクリック音
   */
  public playClick() {
    if (!this.ctx || !this.sfxGain || this._isMuted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.04);
  }
}

// シングルトンインスタンスのエクスポート
export const audioManager = new AudioManager();
