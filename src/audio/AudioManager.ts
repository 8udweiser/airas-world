/**
 * Airas Audio Manager (Web Audio API & Realistic Foley Engine)
 * 
 * 1. 実録ハイファイ足音（Kenney Impact Sounds - CC0）:
 *    アスファルト・石畳、芝生、木床のランダム多重サンプリング＆疾走ピッチスケーリング
 * 2. リアルジャンプ風切り音 & 体重の乗った接地衝撃音（CC0）
 * 3. 実機録音V10スーパーカーエンジン（ATG-Simulator VNS - MIT）:
 *    アイドリング、加速、高回転レッドライン、アクセルオフ時のアフターファイア破裂音
 * 4. ベンチ着席時の安らぎコード音
 * 5. マインクラフト風アンビエント＆ピアノBGM (空間コンボリューションリバーブ)
 * 6. オフライン/未ロード時も完全動作するハイブリッド・プロシージャルフォールバック
 */

export type SurfaceType = 'grass' | 'stone' | 'road' | 'wood' | 'water';

export interface BGMTrack {
  id: string;
  title: string;
  subtitle: string;
  url: string;
  mood: 'sunset' | 'clear' | 'rain' | 'heavy_rain' | 'typhoon' | 'snow' | 'any';
}

export const BGM_PLAYLIST: BGMTrack[] = [
  {
    id: 'last_train',
    title: 'Last Train at Twilight',
    subtitle: '夕暮れの最終列車 (Gemini AI)',
    url: '/assets/audio/bgm/Last_Train_at_Twilight.mp3',
    mood: 'sunset',
  },
  {
    id: 'valley_light',
    title: "The Valley's First Light",
    subtitle: '谷あいの朝光 (Gemini AI)',
    url: "/assets/audio/bgm/The_Valley_s_First_Light.mp3",
    mood: 'clear',
  },
  {
    id: 'rain_bench',
    title: '雨音のベンチ',
    subtitle: '静寂の雨とピアノ (Gemini AI)',
    url: '/assets/audio/bgm/ameoto_no_bench.mp3',
    mood: 'rain',
  },
];

class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbWetGain: GainNode | null = null;
  private reverbDryGain: GainNode | null = null;

  // 実録オーディオバッファキャッシュ
  private audioBufferCache: Map<string, AudioBuffer> = new Map();
  private isPreloaded: boolean = false;

  // Gemini AI BGMプレイヤー
  private bgmAudio: HTMLAudioElement | null = null;
  private currentTrackIndex: number = typeof window !== 'undefined' ? Math.floor(Math.random() * BGM_PLAYLIST.length) : 0;
  private bgmVolume: number = 0.55;
  public onTrackChange?: (track: BGMTrack, isPlaying: boolean) => void;

  private getRandomTrackIndex(excludeCurrent: boolean = true): number {
    if (BGM_PLAYLIST.length <= 1) return 0;
    let nextIdx = Math.floor(Math.random() * BGM_PLAYLIST.length);
    if (excludeCurrent && nextIdx === this.currentTrackIndex) {
      nextIdx = (nextIdx + 1 + Math.floor(Math.random() * (BGM_PLAYLIST.length - 1))) % BGM_PLAYLIST.length;
    }
    return nextIdx;
  }

  // BGMステート
  private isBgmPlaying: boolean = false;
  private bgmTimer: any = null;
  private padGain: GainNode | null = null;
  private padOscs: OscillatorNode[] = [];

  // 車両エンジン音ステート (実録サンプラー + 動的クロスフェード)
  private isEngineRunning: boolean = false;
  private engineIdleSource: AudioBufferSourceNode | null = null;
  private engineIdleGain: GainNode | null = null;
  private engineAccelSource: AudioBufferSourceNode | null = null;
  private engineAccelGain: GainNode | null = null;
  private engineHighrevSource: AudioBufferSourceNode | null = null;
  private engineHighrevGain: GainNode | null = null;
  private lastWasMoving: boolean = false;

  // フォールバック用オシレーター
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private fallbackEngineGain: GainNode | null = null;

  // ミュートステート
  private _isMuted: boolean = false;
  private _masterVolume: number = 0.7;

  // 🌧️ リアル雨音 & 台風・環境音エンジンステート
  private isRainRunning: boolean = false;
  private rainNoiseSource: AudioBufferSourceNode | null = null;
  private rainAmbientGain: GainNode | null = null;
  private rainFilterNode: BiquadFilterNode | null = null;
  private windNoiseSource: AudioBufferSourceNode | null = null;
  private windGain: GainNode | null = null;
  private windFilterNode: BiquadFilterNode | null = null;
  private currentWeatherState: string = 'sunset';
  private thunderTimer: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const unlockAudio = () => {
        this.init();
        if (!this.isBgmPlaying) {
          this.startBgm();
        }
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
      this.bgmGain.gain.setValueAtTime(0.40, this.ctx.currentTime);

      // SFXゲイン
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.70, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      // リアルタイム・コンボリューション・リバーブの合成
      this.setupReverb();

      // 実録サウンドの非同期プリロード
      this.preloadAudioSamples();

      // BGM自動開始
      this.startBgm();
    } catch (e) {
      console.warn('[AudioManager] Failed to initialize AudioContext:', e);
    }
  }

  /**
   * 実録オーディオサンプルの非同期読み込み & デコード
   */
  private async preloadAudioSamples() {
    if (!this.ctx || this.isPreloaded) return;
    this.isPreloaded = true;

    const sampleUrls = [
      '/assets/audio/footstep_stone_0.ogg',
      '/assets/audio/footstep_stone_1.ogg',
      '/assets/audio/footstep_stone_2.ogg',
      '/assets/audio/footstep_stone_3.ogg',
      '/assets/audio/footstep_grass_0.ogg',
      '/assets/audio/footstep_grass_1.ogg',
      '/assets/audio/footstep_grass_2.ogg',
      '/assets/audio/footstep_wood_0.ogg',
      '/assets/audio/footstep_wood_1.ogg',
      '/assets/audio/land_impact.ogg',
      '/assets/audio/jump_whoosh.wav',
      '/assets/audio/eng_idle.wav',
      '/assets/audio/eng_accel.wav',
      '/assets/audio/eng_highrev.wav',
      '/assets/audio/exhaust_burble.ogg',
    ];

    for (const url of sampleUrls) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const ab = await res.arrayBuffer();
          if (this.ctx) {
            const audioBuffer = await this.ctx.decodeAudioData(ab);
            this.audioBufferCache.set(url, audioBuffer);
          }
        }
      } catch (_) {
        // 取得失敗時はプロシージャル合成で自動フォールバック
      }
    }
  }

  /**
   * インパルス応答（IR）を自己生成してスタジオ品質のリバーブを構築
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
      this.reverbWetGain.gain.setValueAtTime(0.22, this.ctx.currentTime);

      this.reverbDryGain = this.ctx.createGain();
      this.reverbDryGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

      this.bgmGain.connect(this.reverbDryGain);
      this.reverbDryGain.connect(this.masterGain);

      this.bgmGain.connect(this.reverbWetGain);
      this.reverbWetGain.connect(this.reverbNode);
      this.reverbNode.connect(this.masterGain);
    } catch (e) {
      console.warn('[AudioManager] Reverb setup failed:', e);
      if (this.bgmGain && this.masterGain) {
        this.bgmGain.connect(this.masterGain);
      }
    }
  }

  public setReverbWet(level: number) {
    if (this.reverbWetGain && this.ctx) {
      const clamped = Math.max(0, Math.min(1, level));
      this.reverbWetGain.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.2);
    }
  }

  public setMuted(muted: boolean) {
    this._isMuted = muted;
    if (this.masterGain && this.ctx) {
      const targetGain = muted ? 0 : this._masterVolume;
      this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
    }
    if (this.bgmAudio) {
      this.bgmAudio.muted = muted;
    }
  }

  public isMuted(): boolean {
    return this._isMuted;
  }

  public setMasterVolume(vol: number) {
    this._masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && !this._isMuted) {
      this.masterGain.gain.setTargetAtTime(this._masterVolume, this.ctx.currentTime, 0.05);
    }
    if (this.bgmAudio) {
      this.bgmAudio.volume = this._isMuted ? 0 : this.bgmVolume * this._masterVolume;
    }
  }

  /**
   * -------------------------------------------------------------
   * 🎵 Gemini生成 リアルハイファイBGMプレイヤー
   * -------------------------------------------------------------
   */
  public startBgm(target?: number | string) {
    this.isBgmPlaying = true;

    if (typeof target === 'number') {
      this.currentTrackIndex = Math.max(0, Math.min(BGM_PLAYLIST.length - 1, target));
    } else if (typeof target === 'string') {
      const foundIdx = BGM_PLAYLIST.findIndex(
        (t) => t.id === target || t.mood === target
      );
      if (foundIdx !== -1) {
        this.currentTrackIndex = foundIdx;
      }
    }

    const track = BGM_PLAYLIST[this.currentTrackIndex];
    if (!track) return;

    if (typeof window !== 'undefined') {
      if (!this.bgmAudio) {
        this.bgmAudio = new Audio();
        this.bgmAudio.loop = false;
        this.bgmAudio.addEventListener('ended', () => {
          // 🎵 曲が終了したら自動でランダムな次の曲へシームレス移行
          this.nextBgm(true);
        });
        this.bgmAudio.addEventListener('error', (e) => {
          console.warn('BGM file load failed, falling back to ambient procedural:', e);
          this.startAmbientDrone();
          this.scheduleNextBgmPhrase();
        });
      }

      if (!this.bgmAudio.src.endsWith(encodeURI(track.url)) || this.bgmAudio.paused) {
        this.bgmAudio.src = track.url;
        this.bgmAudio.volume = this._isMuted ? 0 : this.bgmVolume * this._masterVolume;
        this.bgmAudio.muted = this._isMuted;

        const playPromise = this.bgmAudio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.log('BGM autoplay paused waiting for user action:', err);
          });
        }
      }
    }

    this.onTrackChange?.(track, true);
  }

  public stopBgm() {
    this.isBgmPlaying = false;
    if (this.bgmAudio) {
      this.bgmAudio.pause();
    }
    if (this.bgmTimer) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
    this.stopAmbientDrone();
    const track = BGM_PLAYLIST[this.currentTrackIndex];
    if (track) {
      this.onTrackChange?.(track, false);
    }
  }

  public toggleBgm() {
    if (this.isBgmPlaying && this.bgmAudio && !this.bgmAudio.paused) {
      this.stopBgm();
    } else {
      this.startBgm();
    }
  }

  public nextBgm(random: boolean = true) {
    if (random) {
      this.currentTrackIndex = this.getRandomTrackIndex(true);
    } else {
      this.currentTrackIndex = (this.currentTrackIndex + 1) % BGM_PLAYLIST.length;
    }
    this.startBgm(this.currentTrackIndex);
  }

  public prevBgm() {
    this.currentTrackIndex = (this.currentTrackIndex - 1 + BGM_PLAYLIST.length) % BGM_PLAYLIST.length;
    this.startBgm(this.currentTrackIndex);
  }

  public getCurrentBgmTrack(): { track: BGMTrack; isPlaying: boolean; index: number } {
    return {
      track: BGM_PLAYLIST[this.currentTrackIndex] || BGM_PLAYLIST[0],
      isPlaying: this.isBgmPlaying && !!(this.bgmAudio && !this.bgmAudio.paused),
      index: this.currentTrackIndex,
    };
  }

  public switchBgmForWeather(weather: string) {
    this.updateWeatherAmbient(weather);
    const targetIdx = BGM_PLAYLIST.findIndex((t) => t.mood === weather || (weather === 'heavy_rain' && t.mood === 'rain') || (weather === 'typhoon' && t.mood === 'rain'));
    if (targetIdx !== -1 && targetIdx !== this.currentTrackIndex) {
      this.startBgm(targetIdx);
    }
  }

  /**
   * 🌧️ リアル雨音・大雨・台風（落雷）リアルタイム環境音エンジン
   * 雨が強くなるほど音量・水しぶき感が増大し、台風では暴風と不定期な落雷が発生
   */
  public updateWeatherAmbient(weather: string, intensity: number = 1.0) {
    this.currentWeatherState = weather;
    if (!this.ctx) return;

    const isRaining = weather === 'rain' || weather === 'heavy_rain' || weather === 'typhoon';

    if (!isRaining) {
      this.stopRainAmbient();
      return;
    }

    this.startRainAmbient();

    const t = this.ctx.currentTime;
    let targetRainVol = 0.22 * intensity;
    let targetRainFreq = 2200; // 雨の高域フィルター
    let targetWindVol = 0.001;

    if (weather === 'heavy_rain') {
      targetRainVol = 0.52 * intensity;
      targetRainFreq = 3800; // ザーザーと激しい水滴
      targetWindVol = 0.12;
    } else if (weather === 'typhoon') {
      targetRainVol = 0.75 * intensity;
      targetRainFreq = 4800; // 暴風雨の激しい雨足
      targetWindVol = 0.45; // 唸る強風
    }

    if (this.rainAmbientGain) {
      this.rainAmbientGain.gain.setTargetAtTime(this._isMuted ? 0 : targetRainVol, t, 0.5);
    }
    if (this.rainFilterNode) {
      this.rainFilterNode.frequency.setTargetAtTime(targetRainFreq, t, 0.5);
    }
    if (this.windGain) {
      this.windGain.gain.setTargetAtTime(this._isMuted ? 0 : targetWindVol, t, 0.8);
    }

    // 台風時は不定期なリアル落雷を自動スケジューリング
    if (weather === 'typhoon') {
      if (!this.thunderTimer) {
        this.scheduleRandomThunder();
      }
    } else {
      if (this.thunderTimer) {
        clearTimeout(this.thunderTimer);
        this.thunderTimer = null;
      }
    }
  }

  private startRainAmbient() {
    if (this.isRainRunning || !this.ctx || !this.masterGain) return;
    this.isRainRunning = true;

    try {
      const bufferSize = this.ctx.sampleRate * 4.0; // 4秒のシームレスピンクノイズループ
      const noiseBuffer = this.ctx.createBuffer(2, bufferSize, this.ctx.sampleRate);
      const left = noiseBuffer.getChannelData(0);
      const right = noiseBuffer.getChannelData(1);

      let b0L = 0, b1L = 0, b2L = 0, b3L = 0, b4L = 0;
      let b0R = 0, b1R = 0, b2R = 0, b3R = 0, b4R = 0;

      for (let i = 0; i < bufferSize; i++) {
        const whiteL = Math.random() * 2 - 1;
        const whiteR = Math.random() * 2 - 1;

        b0L = 0.99886 * b0L + whiteL * 0.0555179;
        b1L = 0.99332 * b1L + whiteL * 0.0750759;
        b2L = 0.96900 * b2L + whiteL * 0.1538520;
        b3L = 0.86650 * b3L + whiteL * 0.3104856;
        b4L = 0.55000 * b4L + whiteL * 0.5329522;
        left[i] = (b0L + b1L + b2L + b3L + b4L) * 0.12;

        b0R = 0.99886 * b0R + whiteR * 0.0555179;
        b1R = 0.99332 * b1R + whiteR * 0.0750759;
        b2R = 0.96900 * b2R + whiteR * 0.1538520;
        b3R = 0.86650 * b3R + whiteR * 0.3104856;
        b4R = 0.55000 * b4R + whiteR * 0.5329522;
        right[i] = (b0R + b1R + b2R + b3R + b4R) * 0.12;
      }

      this.rainNoiseSource = this.ctx.createBufferSource();
      this.rainNoiseSource.buffer = noiseBuffer;
      this.rainNoiseSource.loop = true;

      this.rainFilterNode = this.ctx.createBiquadFilter();
      this.rainFilterNode.type = 'lowpass';
      this.rainFilterNode.frequency.setValueAtTime(2400, this.ctx.currentTime);

      this.rainAmbientGain = this.ctx.createGain();
      this.rainAmbientGain.gain.setValueAtTime(0.001, this.ctx.currentTime);

      this.rainNoiseSource.connect(this.rainFilterNode);
      this.rainFilterNode.connect(this.rainAmbientGain);
      this.rainAmbientGain.connect(this.masterGain);
      this.rainNoiseSource.start();

      // 台風用の風ノイズジェネレーター
      this.windNoiseSource = this.ctx.createBufferSource();
      this.windNoiseSource.buffer = noiseBuffer;
      this.windNoiseSource.loop = true;

      this.windFilterNode = this.ctx.createBiquadFilter();
      this.windFilterNode.type = 'bandpass';
      this.windFilterNode.frequency.setValueAtTime(280, this.ctx.currentTime);
      this.windFilterNode.Q.setValueAtTime(1.8, this.ctx.currentTime);

      this.windGain = this.ctx.createGain();
      this.windGain.gain.setValueAtTime(0.001, this.ctx.currentTime);

      this.windNoiseSource.connect(this.windFilterNode);
      this.windFilterNode.connect(this.windGain);
      this.windGain.connect(this.masterGain);
      this.windNoiseSource.start();
    } catch (e) {
      console.warn('[AudioManager] Rain ambient start failed:', e);
    }
  }

  private stopRainAmbient() {
    if (!this.isRainRunning) return;
    this.isRainRunning = false;

    if (this.thunderTimer) {
      clearTimeout(this.thunderTimer);
      this.thunderTimer = null;
    }

    if (this.ctx) {
      const t = this.ctx.currentTime;
      this.rainAmbientGain?.gain.setTargetAtTime(0, t, 0.8);
      this.windGain?.gain.setTargetAtTime(0, t, 0.8);
      setTimeout(() => {
        try {
          this.rainNoiseSource?.stop();
          this.rainNoiseSource?.disconnect();
          this.windNoiseSource?.stop();
          this.windNoiseSource?.disconnect();
        } catch (_) {}
        this.rainNoiseSource = null;
        this.rainFilterNode = null;
        this.rainAmbientGain = null;
        this.windNoiseSource = null;
        this.windFilterNode = null;
        this.windGain = null;
      }, 900);
    }
  }

  private scheduleRandomThunder() {
    if (this.currentWeatherState !== 'typhoon') return;
    const delayMs = 6000 + Math.random() * 12000; // 6〜18秒間隔
    this.thunderTimer = setTimeout(() => {
      if (this.currentWeatherState === 'typhoon') {
        const isDistant = Math.random() > 0.45;
        this.playThunder(isDistant);
        this.scheduleRandomThunder();
      }
    }, delayMs);
  }

  public setBgmVolume(vol: number) {
    this.bgmVolume = Math.max(0, Math.min(1, vol));
    if (this.bgmAudio) {
      this.bgmAudio.volume = this._isMuted ? 0 : this.bgmVolume * this._masterVolume;
    }
  }

  private startAmbientDrone() {
    if (!this.ctx || !this.bgmGain || this.padGain) return;

    const t = this.ctx.currentTime;
    this.padGain = this.ctx.createGain();
    this.padGain.gain.setValueAtTime(0.01, t);
    this.padGain.gain.linearRampToValueAtTime(0.12, t + 4.0);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, t);

    const padFreqs = [130.81, 164.81, 196.0, 246.94]; // C3, E3, G3, B3 (Cmaj7)
    this.padOscs = padFreqs.map((f, idx) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f + (idx % 2 === 0 ? 0.35 : -0.35), t);
      osc.connect(filter);
      osc.start(t);
      return osc;
    });

    filter.connect(this.padGain);
    this.padGain.connect(this.bgmGain);
  }

  private stopAmbientDrone() {
    if (this.padGain && this.ctx) {
      this.padGain.gain.setTargetAtTime(0, this.ctx.currentTime, 1.5);
      setTimeout(() => {
        this.padOscs.forEach((osc) => {
          try {
            osc.stop();
            osc.disconnect();
          } catch (_) {}
        });
        this.padOscs = [];
        this.padGain = null;
      }, 1600);
    }
  }

  private scheduleNextBgmPhrase() {
    if (!this.isBgmPlaying || !this.ctx) return;

    const phrases = [
      [261.63, 329.63, 392.0, 493.88], // C4 - E4 - G4 - B4
      [220.0, 261.63, 329.63, 440.0],  // A3 - C4 - E4 - A4
      [174.61, 220.0, 261.63, 329.63], // F3 - A3 - C4 - E4
      [196.0, 246.94, 293.66, 392.0],  // G3 - B3 - D4 - G4
      [329.63, 392.0, 493.88, 587.33], // E4 - G4 - B4 - D5
    ];
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];

    let delay = 0.5;
    for (let i = 0; i < phrase.length; i++) {
      const freq = phrase[i];
      setTimeout(() => {
        if (this.isBgmPlaying) {
          this.playPianoNote(freq, 0.18 + Math.random() * 0.12);
        }
      }, delay * 1000);
      delay += 0.8 + Math.random() * 1.4;
    }

    const quietPause = (delay + 6 + Math.random() * 10) * 1000;
    this.bgmTimer = setTimeout(() => {
      this.scheduleNextBgmPhrase();
    }, quietPause);
  }

  private playPianoNote(freq: number, velocity: number = 0.2) {
    if (!this.ctx || !this.bgmGain || this._isMuted) return;

    const t = this.ctx.currentTime;
    const noteGain = this.ctx.createGain();

    noteGain.gain.setValueAtTime(0, t);
    noteGain.gain.linearRampToValueAtTime(velocity, t + 0.012);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(freq * 3.5, 2400), t);

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
   * 👣 リアルな実録足音SE（Kenney Impact Sounds - CC0）
   * -------------------------------------------------------------
   */
  public playFootstep(surface: SurfaceType = 'stone', isSprint: boolean = false) {
    if (!this.ctx || !this.sfxGain || this._isMuted) return;

    if (surface === 'water') {
      this.playWaterFootstep(isSprint);
      return;
    }

    let sampleUrls: string[] = [];
    switch (surface) {
      case 'grass':
        sampleUrls = [
          '/assets/audio/footstep_grass_0.ogg',
          '/assets/audio/footstep_grass_1.ogg',
          '/assets/audio/footstep_grass_2.ogg',
        ];
        break;
      case 'wood':
        sampleUrls = [
          '/assets/audio/footstep_wood_0.ogg',
          '/assets/audio/footstep_wood_1.ogg',
        ];
        break;
      case 'road':
      case 'stone':
      default:
        sampleUrls = [
          '/assets/audio/footstep_stone_0.ogg',
          '/assets/audio/footstep_stone_1.ogg',
          '/assets/audio/footstep_stone_2.ogg',
          '/assets/audio/footstep_stone_3.ogg',
        ];
        break;
    }

    const chosenUrl = sampleUrls[Math.floor(Math.random() * sampleUrls.length)];
    const buf = this.audioBufferCache.get(chosenUrl);

    if (buf) {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const basePitch = isSprint ? 1.15 : 1.0;
      src.playbackRate.setValueAtTime(basePitch * (0.94 + Math.random() * 0.12), this.ctx.currentTime);

      const stepGain = this.ctx.createGain();
      stepGain.gain.setValueAtTime(isSprint ? 0.38 : 0.28, this.ctx.currentTime);

      src.connect(stepGain);
      stepGain.connect(this.sfxGain);

      if (this.reverbNode && this.reverbWetGain) {
        const revSend = this.ctx.createGain();
        revSend.gain.setValueAtTime(0.16, this.ctx.currentTime);
        stepGain.connect(revSend);
        revSend.connect(this.reverbNode);
      }

      src.start();
    } else {
      this.playProceduralFootstep(surface);
    }
  }

  /**
   * 🌊 リアルな水たまり・川の水しぶき足音（ジャブジャブ・バシャッ）
   */
  public playWaterFootstep(isSprint: boolean = false) {
    if (!this.ctx || !this.sfxGain || this._isMuted) return;
    const t = this.ctx.currentTime;

    // 1. 水しぶきスプラッシュノイズ
    const splashLength = Math.floor(this.ctx.sampleRate * (isSprint ? 0.12 : 0.08));
    const splashBuffer = this.ctx.createBuffer(1, splashLength, this.ctx.sampleRate);
    const data = splashBuffer.getChannelData(0);
    for (let i = 0; i < splashLength; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (splashLength * 0.4));
    }

    const splashSrc = this.ctx.createBufferSource();
    splashSrc.buffer = splashBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(isSprint ? 3200 : 2600, t);
    filter.Q.setValueAtTime(1.5, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isSprint ? 0.42 : 0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (isSprint ? 0.13 : 0.09));

    splashSrc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    splashSrc.start(t);

    // 2. 水の底で鳴るチャプンという低音バブル
    const bubbleOsc = this.ctx.createOscillator();
    bubbleOsc.type = 'sine';
    const startFreq = 260 + Math.random() * 100;
    bubbleOsc.frequency.setValueAtTime(startFreq, t);
    bubbleOsc.frequency.exponentialRampToValueAtTime(startFreq * 1.8, t + 0.06);

    const bubbleGain = this.ctx.createGain();
    bubbleGain.gain.setValueAtTime(0.18, t);
    bubbleGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    bubbleOsc.connect(bubbleGain);
    bubbleGain.connect(this.sfxGain);
    bubbleOsc.start(t);
    bubbleOsc.stop(t + 0.08);
  }

  /**
   * ⚡ リアルな落雷＆遠雷サウンド（至近雷：バリバリッ！ズドドオォン！ / 遠雷：ゴロゴロ…）
   */
  public playThunder(distant: boolean = false) {
    if (!this.ctx || !this.masterGain || this._isMuted) return;
    const t = this.ctx.currentTime;

    if (distant) {
      // 遠雷（低く唸るゴロゴロ音）
      const dur = 3.5;
      const bufSize = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.sin((i / bufSize) * Math.PI) * Math.exp(-i / (bufSize * 0.7));
      }

      const src = this.ctx.createBufferSource();
      src.buffer = buf;

      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(140, t);
      f.frequency.linearRampToValueAtTime(80, t + dur);

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.01, t);
      g.gain.linearRampToValueAtTime(0.45, t + 0.3);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);

      src.connect(f);
      f.connect(g);
      g.connect(this.masterGain);
      src.start(t);
    } else {
      // 至近雷：激しい放電クラック ＋ 地響き爆発
      // 1. 放電スパーク（バリバリッ！）
      const crackDur = 0.35;
      const crackBufSize = Math.floor(this.ctx.sampleRate * crackDur);
      const crackBuf = this.ctx.createBuffer(1, crackBufSize, this.ctx.sampleRate);
      const cd = crackBuf.getChannelData(0);
      for (let i = 0; i < crackBufSize; i++) {
        cd[i] = (Math.random() * 2 - 1) * (Math.random() > 0.4 ? 1 : -0.8) * Math.exp(-i / (crackBufSize * 0.25));
      }
      const crackSrc = this.ctx.createBufferSource();
      crackSrc.buffer = crackBuf;
      const crackFilter = this.ctx.createBiquadFilter();
      crackFilter.type = 'bandpass';
      crackFilter.frequency.setValueAtTime(1800, t);
      const crackGain = this.ctx.createGain();
      crackGain.gain.setValueAtTime(0.75, t);
      crackGain.gain.exponentialRampToValueAtTime(0.001, t + crackDur);
      crackSrc.connect(crackFilter);
      crackFilter.connect(crackGain);
      crackGain.connect(this.masterGain);
      crackSrc.start(t);

      // 2. ズドドオォォン！ 重低音サブベース
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(95, t);
      osc.frequency.exponentialRampToValueAtTime(32, t + 2.8);

      const oscGain = this.ctx.createGain();
      oscGain.gain.setValueAtTime(0.01, t);
      oscGain.gain.linearRampToValueAtTime(0.9, t + 0.08);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 3.2);

      osc.connect(oscGain);
      oscGain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 3.3);

      // 3. 空を揺るがす大気リバーブ
      if (this.reverbNode && this.reverbWetGain) {
        oscGain.connect(this.reverbNode);
      }
    }
  }

  /**
   * 🪣 バケツで水を汲む音（チャプンッ…トポトポ）
   */
  public playWaterScoop() {
    if (!this.ctx || !this.sfxGain || this._isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, t);
    osc.frequency.exponentialRampToValueAtTime(680, t + 0.12);
    osc.frequency.exponentialRampToValueAtTime(340, t + 0.28);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.36);
  }

  /**
   * 🌊 バケツの水を流す／川を作る音（ザバーッ！ジャバー）
   */
  public playWaterSplash() {
    if (!this.ctx || !this.sfxGain || this._isMuted) return;
    const t = this.ctx.currentTime;

    const dur = 0.55;
    const bufSize = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.45));
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, t);
    filter.frequency.linearRampToValueAtTime(1200, t + dur);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.55, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(t);
  }

  /**
   * 🛏️ ベッドで寝る音（安らぎのシーツ音 & ヒーリングトーン）
   */
  public playSleep() {
    if (!this.ctx || !this.sfxGain || this._isMuted) return;
    const t = this.ctx.currentTime;

    // 心安らぐデュアルトーン (F# & C#)
    const freqs = [369.99, 554.37];
    freqs.forEach((freq) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      const gain = this.ctx!.createGain();
      gain.gain.setValueAtTime(0.01, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 2.5);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 2.6);
    });
  }

  private playProceduralFootstep(surface: SurfaceType) {
    if (!this.ctx || !this.sfxGain || this._isMuted) return;
    const t = this.ctx.currentTime;
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

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(surface === 'grass' ? 750 : surface === 'wood' ? 480 : 1600, t);
    stepGain.gain.setValueAtTime(0.20, t);
    stepGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    noiseSource.connect(filter);
    filter.connect(stepGain);
    stepGain.connect(this.sfxGain);

    noiseSource.start(t);
    noiseSource.stop(t + 0.06);
  }

  /**
   * 🏃 ジャンプ音 (実録風切り音 + 反響)
   */
  public playJump() {
    if (!this.ctx || !this.sfxGain || this._isMuted) return;
    const buf = this.audioBufferCache.get('/assets/audio/jump_whoosh.wav');

    if (buf) {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.setValueAtTime(0.96 + Math.random() * 0.1, this.ctx.currentTime);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      src.connect(gain);
      gain.connect(this.sfxGain);
      src.start();
    } else {
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
  }

  /**
   * 💥 着地音 (実録接地衝撃音 + リバーブ)
   */
  public playLand() {
    if (!this.ctx || !this.sfxGain || this._isMuted) return;
    const buf = this.audioBufferCache.get('/assets/audio/land_impact.ogg');

    if (buf) {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.setValueAtTime(0.94 + Math.random() * 0.12, this.ctx.currentTime);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.48, this.ctx.currentTime);
      src.connect(gain);
      gain.connect(this.sfxGain);

      if (this.reverbNode && this.reverbWetGain) {
        const revSend = this.ctx.createGain();
        revSend.gain.setValueAtTime(0.25, this.ctx.currentTime);
        gain.connect(revSend);
        revSend.connect(this.reverbNode);
      }

      src.start();
    } else {
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
  }

  /**
   * 🛋️ ベンチ着席音 (心安らぐピアノアルペジオ)
   */
  public playSit() {
    if (!this.ctx || !this.sfxGain || this._isMuted) return;
    this.playPianoNote(523.25, 0.22); // C5
    setTimeout(() => this.playPianoNote(659.25, 0.20), 120); // E5
    setTimeout(() => this.playPianoNote(783.99, 0.24), 240); // G5
  }

  /**
   * 💬 会話タイピング音 (人間が喋っているような優しいポポポ音)
   */
  public playChatTick() {
    if (!this.ctx || !this.sfxGain || this._isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // 微かにランダムなピッチで人間の抑揚をつける (480Hz 〜 620Hz)
      const pitch = 520 + (Math.random() - 0.5) * 120;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, t);
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.85, t + 0.035);

      gain.gain.setValueAtTime(0.05, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.04);
    } catch (_) {}
  }

  /**
   * 🏎️ ランボルギーニ乗車音
   */
  public playVehicleEnter() {
    if (!this.ctx || !this.sfxGain || this._isMuted) return;
    const t = this.ctx.currentTime;

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
   * 🏎️ 実機録音エンジンサウンドの連続合成ループ (ATG-Simulator VNS)
   */
  private startEngine() {
    if (this.isEngineRunning || !this.ctx || !this.sfxGain) return;
    this.isEngineRunning = true;

    const idleBuf = this.audioBufferCache.get('/assets/audio/eng_idle.wav');
    const accelBuf = this.audioBufferCache.get('/assets/audio/eng_accel.wav');
    const highrevBuf = this.audioBufferCache.get('/assets/audio/eng_highrev.wav');

    if (idleBuf && accelBuf && highrevBuf) {
      const t = this.ctx.currentTime;

      // 1. アイドリングループ
      this.engineIdleSource = this.ctx.createBufferSource();
      this.engineIdleSource.buffer = idleBuf;
      this.engineIdleSource.loop = true;
      this.engineIdleGain = this.ctx.createGain();
      this.engineIdleGain.gain.setValueAtTime(0.35, t);
      this.engineIdleSource.connect(this.engineIdleGain);
      this.engineIdleGain.connect(this.sfxGain);
      this.engineIdleSource.start();

      // 2. 加速ループ
      this.engineAccelSource = this.ctx.createBufferSource();
      this.engineAccelSource.buffer = accelBuf;
      this.engineAccelSource.loop = true;
      this.engineAccelGain = this.ctx.createGain();
      this.engineAccelGain.gain.setValueAtTime(0.001, t);
      this.engineAccelSource.connect(this.engineAccelGain);
      this.engineAccelGain.connect(this.sfxGain);
      this.engineAccelSource.start();

      // 3. 高回転レッドライン
      this.engineHighrevSource = this.ctx.createBufferSource();
      this.engineHighrevSource.buffer = highrevBuf;
      this.engineHighrevSource.loop = true;
      this.engineHighrevGain = this.ctx.createGain();
      this.engineHighrevGain.gain.setValueAtTime(0.001, t);
      this.engineHighrevSource.connect(this.engineHighrevGain);
      this.engineHighrevGain.connect(this.sfxGain);
      this.engineHighrevSource.start();
    } else {
      this.startFallbackEngine();
    }
  }

  private startFallbackEngine() {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(45, t);

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
    this.fallbackEngineGain = gain;
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

    // アクセルオフ時のアフターファイア（減速時のマフラー破裂音）
    if (this.lastWasMoving && !isMoving) {
      this.playExhaustBurble();
    }
    this.lastWasMoving = isMoving;

    // 実録サンプラーのブレンド
    if (this.engineIdleGain && this.engineAccelGain && this.engineHighrevGain) {
      if (!isMoving) {
        this.engineIdleGain.gain.setTargetAtTime(0.38, t, 0.08);
        this.engineAccelGain.gain.setTargetAtTime(0.001, t, 0.08);
        this.engineHighrevGain.gain.setTargetAtTime(0.001, t, 0.08);
        if (this.engineIdleSource) {
          this.engineIdleSource.playbackRate.setTargetAtTime(1.0, t, 0.08);
        }
      } else if (isSprint) {
        this.engineIdleGain.gain.setTargetAtTime(0.001, t, 0.06);
        this.engineAccelGain.gain.setTargetAtTime(0.15, t, 0.06);
        this.engineHighrevGain.gain.setTargetAtTime(0.42, t, 0.06);
        if (this.engineHighrevSource) {
          const rate = 0.95 + (speed / 920) * 0.35;
          this.engineHighrevSource.playbackRate.setTargetAtTime(rate, t, 0.06);
        }
      } else {
        this.engineIdleGain.gain.setTargetAtTime(0.08, t, 0.08);
        this.engineAccelGain.gain.setTargetAtTime(0.35, t, 0.08);
        this.engineHighrevGain.gain.setTargetAtTime(0.001, t, 0.08);
        if (this.engineAccelSource) {
          const rate = 0.85 + (speed / 580) * 0.40;
          this.engineAccelSource.playbackRate.setTargetAtTime(rate, t, 0.08);
        }
      }
    } else if (this.fallbackEngineGain && this.engineOsc1) {
      let targetFreq = isMoving ? (isSprint ? 260 : 120 + Math.min(speed / 10, 60)) : 45;
      this.engineOsc1.frequency.setTargetAtTime(targetFreq, t, 0.08);
    }
  }

  /**
   * 減速・シフトダウン時のアフターファイア
   */
  private playExhaustBurble() {
    if (!this.ctx || !this.sfxGain || this._isMuted) return;
    const buf = this.audioBufferCache.get('/assets/audio/exhaust_burble.ogg');
    if (buf) {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.setValueAtTime(0.92 + Math.random() * 0.15, this.ctx.currentTime);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      src.connect(gain);
      gain.connect(this.sfxGain);
      src.start();
    }
  }

  public stopEngine() {
    if (!this.isEngineRunning) return;
    this.isEngineRunning = false;

    if (this.ctx) {
      const t = this.ctx.currentTime;
      this.engineIdleGain?.gain.setTargetAtTime(0, t, 0.1);
      this.engineAccelGain?.gain.setTargetAtTime(0, t, 0.1);
      this.engineHighrevGain?.gain.setTargetAtTime(0, t, 0.1);
      this.fallbackEngineGain?.gain.setTargetAtTime(0, t, 0.1);

      setTimeout(() => {
        try {
          this.engineIdleSource?.stop();
          this.engineIdleSource?.disconnect();
          this.engineAccelSource?.stop();
          this.engineAccelSource?.disconnect();
          this.engineHighrevSource?.stop();
          this.engineHighrevSource?.disconnect();
          this.engineOsc1?.stop();
          this.engineOsc1?.disconnect();
          this.engineOsc2?.stop();
          this.engineOsc2?.disconnect();
        } catch (_) {}
        this.engineIdleSource = null;
        this.engineIdleGain = null;
        this.engineAccelSource = null;
        this.engineAccelGain = null;
        this.engineHighrevSource = null;
        this.engineHighrevGain = null;
        this.engineOsc1 = null;
        this.engineOsc2 = null;
        this.fallbackEngineGain = null;
      }, 150);
    }
  }

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

export const audioManager = new AudioManager();
