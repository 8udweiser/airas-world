import { Application, Container, Sprite, Graphics, Assets, Texture } from 'pixi.js';
import { AirasWorldData, WeatherType, Direction } from '../../core/types/world';
import { AirasAsset } from '../../core/types/asset';
import { IRenderer, RendererGhostEntity } from '../IRenderer';
import { audioManager, SurfaceType } from '../../audio/AudioManager';
import { RemotePlayerInfo } from '../../core/multiplayer/MultiplayerManager';
import { resolveAssetUrl } from '../../core/utils/url';

export const ROTATION_DIRECTIONS: Direction[] = [
  'down',        // 0: 下 (正面)
  'down-left',   // 1: 斜め左下
  'left',        // 2: 左
  'up-left',     // 3: 左上
  'up',          // 4: 上 (背面)
  'up-right',    // 5: 右上
  'right',       // 6: 右
  'down-right',  // 7: 右下
];

export const DIRECTION_LABELS: Record<Direction, string> = {
  'down': '正面（下）',
  'down-left': '斜め左下',
  'left': '左',
  'up-left': '左上',
  'up': '背面（上）',
  'up-right': '右上',
  'right': '右',
  'down-right': '右下',
};

export class PixiWorldRenderer implements IRenderer {
  private app: Application | null = null;
  private container: HTMLElement | null = null;
  private currentWorld: AirasWorldData | null = null;
  private currentAssets: Record<string, AirasAsset> | null = null;
  private stepTimer: number = 0;
  
  // シーン階層
  private stageContainer: Container = new Container();
  private groundBgGraphics: Graphics = new Graphics();
  private tileContainer: Container = new Container();
  private waterFlowGraphics: Graphics = new Graphics(); // 自動水流 & コースティクス
  private staticShadowGraphics: Graphics = new Graphics(); // 建物・街路樹の静的接地影（キャッシュ）
  private shadowGraphics: Graphics = new Graphics(); // プレイヤー動的指向性投影影
  private remoteShadowGraphics: Graphics = new Graphics(); // 👥 リモートプレイヤー動的接地影
  private selectionGraphics: Graphics = new Graphics();
  private depthContainer: Container = new Container();
  private ambientLightingGraphics: Graphics = new Graphics(); // 🌅 早朝・朝・夕方・夜のリアルタイム環境光オーバーレイ
  private particleGraphics: Graphics = new Graphics(); // ダッシュ土煙 & 水しぶき
  private staticLightingGraphics: Graphics = new Graphics(); // 💡 街灯・自販機・喫茶店・車の夜景環境光（キャッシュ）
  private lightingGraphics: Graphics = new Graphics(); // プレイヤー動的ランタン
  private weatherGraphics: Graphics = new Graphics();
  private thunderFlashGraphics: Graphics = new Graphics(); // 落雷閃光スクリーンフラッシュ

  // 環境ライティングキャッシュ (無駄な再描画を完全防止)
  private lastRenderedLightingTime: number = -999;
  private lastRenderedLightingWeather: WeatherType | null = null;

  // キャッシュ
  private entitySprites: Map<string, Sprite> = new Map();
  private textureCache: Map<string, Texture> = new Map();
  private textureLoadingPromises: Map<string, Promise<Texture>> = new Map();

  // カメラ状態 (広大な街が見渡せるよう初期ズームは 1.05x)
  private cameraX: number = 0;
  private cameraY: number = 0;
  private zoom: number = 1.05;
  private minZoom: number = 0.4;
  private maxZoom: number = 2.8;

  // プレイヤーの物理・移動状態 (Pixi内部で直接駆動)
  public playerState = {
    x: 480,
    y: 480,
    z: 0,
    vz: 0,
    direction: 'down' as Direction,
    isMoving: false,
    isJumping: false,
    isSprinting: false,
    isSneaking: false,
    isSitting: false,
    sittingEntityId: null as string | null,
    isSleeping: false,
    sleepingBedEntityId: null as string | null,
    assetId: 'character_schoolgirl',
    isDriving: false,
    drivingVehicleAssetId: null as string | null,
    drivingEntityId: null as string | null,
    originalAvatarId: 'character_schoolgirl',
  };

  // 入力キー状態
  public keys: { [key: string]: boolean } = {};
  public playerMoveTier: 'walk' | 'jog' | 'dash' = 'walk';
  private lastTapKey: string | null = null;
  private lastTapTime: number = 0;
  private sameKeyTapCount: number = 0;

  public onKeyDown(code: string, isRepeat: boolean = false) {
    const wasAlreadyPressed = Boolean(this.keys[code]);
    this.keys[code] = true;

    // ⚠️ OSのキーリピート（長押しによる連続イベント発火）や、すでに押下状態のキーは無視！
    // これにより「同じ方向キー押しっぱなしで勝手に小走りやダッシュに昇格してしまう現象」を100%防止
    if (isRepeat || wasAlreadyPressed) {
      return;
    }

    // 移動キー (WASD / 矢印キー) の連打判定 (650ms以内の物理的な連打でゆったり判定)
    const isMoveKey = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code);
    const now = performance.now();

    if (isMoveKey) {
      if (this.lastTapKey === code && now - this.lastTapTime < 650) {
        this.sameKeyTapCount = Math.min(3, this.sameKeyTapCount + 1);
      } else {
        this.sameKeyTapCount = 1;
      }
      this.lastTapKey = code;
      this.lastTapTime = now;

      // 1. 方向キーで歩き ➜ 同じ方向キー2回連続入力で小走り
      // 2. 同じ方向キー3回連続入力でダッシュに切り替え
      if (this.sameKeyTapCount === 2) {
        if (this.playerMoveTier === 'walk') {
          this.playerMoveTier = 'jog';
        } else if (this.playerMoveTier === 'jog') {
          // すでにCtrl等で小走りになっていた場合は2回連打でダッシュに昇格
          this.playerMoveTier = 'dash';
        }
      } else if (this.sameKeyTapCount >= 3) {
        this.playerMoveTier = 'dash';
      }
    }

    // Ctrl キー または Shift キーの組み合わせ判定
    const isCtrl = Boolean(this.keys['ControlLeft'] || this.keys['ControlRight'] || this.keys['Control']);
    const isShift = Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.keys['Shift']);

    if (isCtrl && isShift) {
      // 方向キーで歩き ➜ CTRLキーを押しながらSHIFTキーでいきなりダッシュ
      // 方向キーで歩き ➜ CTRLキーで小走り ➜ CTRLキーを押しながらSHIFTキーでダッシュ
      this.playerMoveTier = 'dash';
    } else if (code === 'ControlLeft' || code === 'ControlRight' || code === 'Control') {
      // 方向キーで歩き ➜ CTRLキーで小走り
      if (this.playerMoveTier === 'walk') {
        this.playerMoveTier = 'jog';
      } else if (this.playerMoveTier === 'jog') {
        // 同じ方向キー2回連続入力で小走り ➜ CTRLキーでダッシュに切り替え
        this.playerMoveTier = 'dash';
      }
    }
  }

  public onKeyUp(code: string) {
    this.keys[code] = false;

    // 移動キーがすべて離されたら通常歩行に戻る
    // （小走りもダッシュも一度切り替えればCTRLキーとSHIFTキーどちらを離してもその状態を維持）
    const k = this.keys;
    const isAnyMoveKeyPressed = Boolean(
      k['KeyW'] || k['ArrowUp'] || k['w'] || k['W'] ||
      k['KeyS'] || k['ArrowDown'] || k['s'] || k['S'] ||
      k['KeyA'] || k['ArrowLeft'] || k['a'] || k['A'] ||
      k['KeyD'] || k['ArrowRight'] || k['d'] || k['D']
    );
    if (!isAnyMoveKeyPressed) {
      this.playerMoveTier = 'walk';
      // 注意: sameKeyTapCount はここではリセットしない
      // （指を離して650ms以内に再度同じキーを押した時に「2回連続入力」「3回連続入力」として正しく認識するため）
    }
  }

  // 操作モード
  public isPlayMode: boolean = true; // デフォルトは快適な探索モード
  public isSnapToGrid: boolean = true; // デフォルトはマス吸着ON (32pxスナップ)

  public setLowPerformanceMode(enabled: boolean) {
    this.isLowPerformanceMode = enabled;
  }

  // ドラッグ操作ステート
  private isDraggingCamera: boolean = false;
  private lastMousePos: { x: number; y: number } = { x: 0, y: 0 };
  private draggingEntityId: string | null = null;
  private dragOffset: { x: number; y: number } = { x: 0, y: 0 };
  private dragStartEntityPos: { x: number; y: number } | null = null;

  // 全画面スワイプ移動ステート (タッチ端末対応)
  private isSwipingMovement: boolean = false;
  private swipePointerId: number | null = null;
  private swipeStartPos: { x: number; y: number } = { x: 0, y: 0 };
  private swipeStartTime: number = 0;
  private swipeRecentPoints: Array<{ x: number; y: number; t: number }> = [];
  private swipeActiveTier: 'walk' | 'jog' | 'dash' = 'walk';
  private swipeAnalogDir: { x: number; y: number } = { x: 0, y: 0 };
  private swipeDist: number = 0;

  // 🏃‍♂️💨 物理移動ベクトル & スムーズ大回り旋回ステート (ダッシュ・乗車時の慣性コーナリング)
  private currentMoveAngle: number = Math.PI / 2; // 現在の移動角度 (ラジアン)
  private isMoveAngleInitialized: boolean = false;
  private movingDuration: number = 0; // 連続移動時間（秒）

  // 🔄 立ち止まりからのクイック反転ターン（ピボットターン演出）
  private isPivotTurning: boolean = false;
  private pivotTurnTimer: number = 0;
  private pivotTurnSequence: Direction[] = [];

  // コールバック
  public onEntityClick?: (entityId: string) => void;
  public onEntityRightClick?: (entityId: string) => void;
  public onMapClick?: (worldX: number, worldY: number) => void;
  public onEntityDrag?: (entityId: string, newWorldX: number, newWorldY: number, direction?: Direction) => void;
  public onEntityRotate?: (entityId: string, newDir: Direction) => void;
  public onEntityDragEnd?: (
    entityId: string,
    startPos: { x: number; y: number },
    endPos: { x: number; y: number },
    startDir?: Direction,
    endDir?: Direction
  ) => void;
  public onAutoSitTriggered?: (benchId: string) => void;
  public onPlayerMoveTick?: (x: number, y: number, z: number, dir: Direction, fps: number) => void;

  private dragPointerId: number | null = null;
  private dragStartEntityDirection: Direction = 'down';
  public currentDraggingDirection: Direction = 'down';

  // パーティクル & アニメーション
  private weatherParticles: Array<{ x: number; y: number; speed: number; length: number }> = [];
  private dustParticles: Array<{ x: number; y: number; vx: number; vy: number; life: number }> = [];
  private walkAnimTimer: number = 0;
  private waterAnimationTime: number = 0;
  private thunderFlashTimer: number = 0;
  private currentWeather: WeatherType = 'sunset';
  private lastRenderedWeather: WeatherType | null = null;
  private depthSortTimer: number = 0;
  public isLowPerformanceMode: boolean = false; // 低スペックマシン用軽量化モード

  async init(container: HTMLElement): Promise<void> {
    this.container = container;
    const app = new Application();
    
    await app.init({
      resizeTo: container,
      backgroundColor: 0x0f172a, // 深いレトロナイトブルー
      resolution: 1.0, // ピクセルアート用に1.0に最適化（低スペックGPUの4倍負荷を解消）
      autoDensity: true,
      antialias: false,
      preference: 'webgl',
      powerPreference: 'high-performance',
    });

    this.app = app;
    container.appendChild(app.canvas);

    // シーン階層の構築 (静的レイヤーと動的レイヤーを完全分離しCPU負荷を最小化)
    this.app.stage.addChild(this.stageContainer);
    this.stageContainer.addChild(this.groundBgGraphics); // 広大な背景
    this.stageContainer.addChild(this.tileContainer);
    this.stageContainer.addChild(this.waterFlowGraphics); // 🌊 リアルな水流 & コースティクス
    this.stageContainer.addChild(this.staticShadowGraphics); // 🏛️ 建物・街路樹の静的接地影 (CPU負荷ゼロ)
    this.stageContainer.addChild(this.shadowGraphics); // 👤 プレイヤー光源連動リアル投影影
    this.stageContainer.addChild(this.remoteShadowGraphics); // 👥 リモートプレイヤー動的接地影
    this.stageContainer.addChild(this.selectionGraphics);
    this.stageContainer.addChild(this.depthContainer); // Yソート
    this.stageContainer.addChild(this.ambientLightingGraphics); // 🌅 早朝・朝・夕方・夜の環境光オーバーレイ
    this.stageContainer.addChild(this.particleGraphics); // ダッシュ土煙 & 水しぶき
    this.stageContainer.addChild(this.staticLightingGraphics); // 💡 街灯・自販機・喫茶店・車の夜景環境光 (CPU負荷ゼロ)
    this.stageContainer.addChild(this.lightingGraphics); // 🔦 プレイヤー足元ランタン
    this.stageContainer.addChild(this.weatherGraphics);
    this.stageContainer.addChild(this.thunderFlashGraphics); // ⚡ 落雷ホワイトフラッシュ

    this.setupInteractions(app.canvas);
    this.centerCamera();

    // 天候パーティクル初期化 (140個に最適化)
    for (let i = 0; i < 140; i++) {
      this.weatherParticles.push({
        x: Math.random() * 2400 - 400,
        y: Math.random() * 1400 - 200,
        speed: 7 + Math.random() * 8,
        length: 14 + Math.random() * 12,
      });
    }

    // 広大な背景グラウンドを描画 (画面外が黒宇宙にならないように)
    this.groundBgGraphics
      .rect(-2000, -2000, 6000, 6000)
      .fill({ color: 0x14532d }); // 豊かな濃い芝生グリーン

    // 🚀 超高速ゲームループ (PixiネイティブTicker)
    this.startEngineLoop();
  }

  private startEngineLoop() {
    if (!this.app) return;

    let fpsTimer = 0;
    let frameCount = 0;
    let currentFps = 60;

    this.app.ticker.add((ticker) => {
      const dt = Math.min(ticker.deltaTime / 60, 0.05);

      // FPS計測
      frameCount++;
      fpsTimer += dt;
      if (fpsTimer >= 0.5) {
        currentFps = Math.round(frameCount / fpsTimer);
        frameCount = 0;
        fpsTimer = 0;
      }

      // 1. プレイヤー物理 & 移動演算 (キー入力 & クリック移動)
      this.updatePlayerPhysics(dt);

      // 2. カメラ追従 (マウス手動ドラッグ中でない限り、dt指数平滑化追従)
      if (!this.isDraggingCamera) {
        this.followPlayer(this.playerState.x, this.playerState.y, dt);
      }

      // 3. 2.5D 深度ソート (移動中またはジャンプ中のみ、かつ50ms間隔でソートしてCPU負荷激減)
      this.depthSortTimer += dt;
      if ((this.playerState.isMoving || this.playerState.isJumping) && this.depthSortTimer >= 0.05) {
        this.depthSortTimer = 0;
        this.depthContainer.children.sort((a, b) => (a as any).worldFootY - (b as any).worldFootY);
      }

      // 4. 🌊 リアル水流アニメーション & コースティクス反射
      this.updateWaterAnimation(dt);

      // 5. 👤 光源連動リアル動的投影影
      this.renderDynamicShadows();

      // 6. 💡 🌅 時間帯別環境光 ＆ 夜の街灯・夜景ライティング
      this.updateAmbientAndNightLighting();
      this.renderLighting();

      // 7. パーティクル & 天候アニメーション
      this.updateDustParticles(dt);
      this.renderWeather(this.currentWeather, dt);
      this.updateThunderFlash(dt);

      // 8. 低頻度でReactへ座標通知 (毎フレーム再レンダリングさせない)
      this.onPlayerMoveTick?.(
        this.playerState.x,
        this.playerState.y,
        this.playerState.z,
        this.playerState.direction,
        currentFps
      );
    });
  }

  // 🧱 オブジェクト当たり判定 & 天面高さ判定 (すり抜け防止 & 屋根乗り)
  private getCollidingObjects(testPx: number, testPy: number, excludeEntityId?: string | null) {
    if (!this.currentWorld || !this.currentAssets) return [];
    const results: Array<{ id: string; topZ: number; bounds: { l: number; r: number; t: number; b: number } }> = [];

    for (const ent of Object.values(this.currentWorld.entities)) {
      if (this.playerState.isDriving && ent.id === this.playerState.drivingEntityId) continue;
      if (excludeEntityId && ent.id === excludeEntityId) continue;

      const asset = this.currentAssets[ent.assetId];
      if (!asset || !asset.collision || !asset.collision.enabled) continue;

      const col = asset.collision;
      const l = ent.position.x + col.offsetX;
      const t = ent.position.y + col.offsetY;
      const r = l + col.width;
      const b = t + col.height;

      // プレイヤー足元当たり判定 (幅12px, 高さ6px)
      const pl = testPx - 6;
      const pr = testPx + 6;
      const pt = testPy - 3;
      const pb = testPy + 3;

      if (!(pr < l || pl > r || pb < t || pt > b)) {
        // 天面高さの算出 (上に登れる高さ)
        let topZ = 36;
        if (asset.category === 'furniture') topZ = 14;
        else if (asset.category === 'vehicle') topZ = 24;
        else if (asset.category === 'structure' || asset.category === 'infrastructure') topZ = 42;
        results.push({ id: ent.id, topZ, bounds: { l, r, t, b } });
      }
    }
    return results;
  }

  // プレイヤーが現在立っている足場の高さ（地面=0、または乗っかっているオブジェクトの天面）
  public getElevatedFloorZ(px: number, py: number): number {
    const overlapping = this.getCollidingObjects(px, py);
    let highestZ = 0;
    for (const obj of overlapping) {
      if (this.playerState.z >= obj.topZ - 5) {
        if (obj.topZ > highestZ) highestZ = obj.topZ;
      }
    }
    return highestZ;
  }

  // 🛋️ ベンチ着席トグル
  public toggleSit(targetEntityId?: string): boolean {
    if (this.playerState.isSitting) {
      // 立ち上がる
      this.playerState.isSitting = false;
      this.playerState.sittingEntityId = null;
      this.playerState.y += 12;
      this.playerState.z = 0;
      return false;
    } else {
      if (!this.currentWorld || !this.currentAssets) return false;
      const px = this.playerState.x;
      const py = this.playerState.y;

      let benchEnt: any = null;
      if (targetEntityId) {
        benchEnt = this.currentWorld.entities[targetEntityId];
      } else {
        // 最寄りの座れるベンチを探す (55px以内)
        let minDist = 55;
        for (const ent of Object.values(this.currentWorld.entities)) {
          const a = this.currentAssets[ent.assetId];
          if (a?.interactions?.some((i) => i.type === 'sit')) {
            const d = Math.hypot(ent.position.x - px, ent.position.y - py);
            if (d < minDist) {
              minDist = d;
              benchEnt = ent;
            }
          }
        }
      }

      if (benchEnt) {
        this.playerState.isSitting = true;
        this.playerState.sittingEntityId = benchEnt.id;
        this.playerState.x = benchEnt.position.x;
        this.playerState.y = benchEnt.position.y - 2;
        this.playerState.z = 6;
        this.playerState.direction = 'down';
        audioManager.playSit();
        this.updatePlayerSpriteVisual();
        return true;
      }
      return false;
    }
  }

  // 🛏️ ベッド就寝トグル（一緒に寝る）
  public toggleSleep(targetEntityId?: string): boolean {
    if (this.playerState.isSleeping) {
      // 起きる
      this.playerState.isSleeping = false;
      this.playerState.sleepingBedEntityId = null;
      this.playerState.y += 18;
      this.playerState.z = 0;
      return false;
    } else {
      if (!this.currentWorld || !this.currentAssets) return false;
      const px = this.playerState.x;
      const py = this.playerState.y;

      let bedEnt: any = null;
      if (targetEntityId) {
        bedEnt = this.currentWorld.entities[targetEntityId];
      } else {
        // 最寄りのベッドを探す (60px以内)
        let minDist = 60;
        for (const ent of Object.values(this.currentWorld.entities)) {
          const a = this.currentAssets[ent.assetId];
          if (a?.interactions?.some((i) => i.type === 'sleep') || a?.category === 'furniture' && ent.assetId.includes('bed')) {
            const d = Math.hypot(ent.position.x - px, ent.position.y - py);
            if (d < minDist) {
              minDist = d;
              bedEnt = ent;
            }
          }
        }
      }

      if (bedEnt) {
        this.playerState.isSleeping = true;
        this.playerState.sleepingBedEntityId = bedEnt.id;
        // ベッド中央（または横）に安らぎの姿勢で横たわる
        this.playerState.x = bedEnt.position.x;
        this.playerState.y = bedEnt.position.y - 6;
        this.playerState.z = 8;
        this.playerState.direction = 'down';
        audioManager.playSleep();
        return true;
      }
      return false;
    }
  }

  // 🧭 キャラクターの向きに対応するラジアン角度を取得
  private getDirectionAngle(dir: Direction): number {
    switch (dir) {
      case 'right': return 0;
      case 'down-right': return Math.PI / 4;
      case 'down': return Math.PI / 2;
      case 'down-left': return (3 * Math.PI) / 4;
      case 'left': return Math.PI;
      case 'up-left': return (-3 * Math.PI) / 4;
      case 'up': return -Math.PI / 2;
      case 'up-right': return -Math.PI / 4;
      default: return Math.PI / 2;
    }
  }

  // 🔄 立ち止まりからのクイック反転ターン（ピボットターン）の向き遷移シーケンスを生成
  private createPivotSequence(fromDir: Direction, toDir: Direction, isSprint: boolean): Direction[] {
    const fromIdx = ROTATION_DIRECTIONS.indexOf(fromDir);
    const toIdx = ROTATION_DIRECTIONS.indexOf(toDir);
    if (fromIdx < 0 || toIdx < 0 || fromDir === toDir) return [toDir];

    let diff = toIdx - fromIdx;

    // 180度反転 (4ステップ離れている) の場合
    if (Math.abs(diff) === 4) {
      // 左右の反転時は下（手前正面）側を経由（キャラクターの表情が見えて自然で美しい）
      if (fromDir === 'left' && toDir === 'right') {
        // 小走り: 左下 ➜ 下 ➜ 右下 ➜ 右 / ダッシュ: 下 ➜ 右
        return isSprint ? ['down', 'right'] : ['down-left', 'down', 'down-right', 'right'];
      }
      if (fromDir === 'right' && toDir === 'left') {
        // 小走り: 右下 ➜ 下 ➜ 左下 ➜ 左 / ダッシュ: 下 ➜ 左
        return isSprint ? ['down', 'left'] : ['down-right', 'down', 'down-left', 'left'];
      }
      // 上下の反転時は右側を経由
      if (fromDir === 'up' && toDir === 'down') {
        return isSprint ? ['right', 'down'] : ['up-right', 'right', 'down-right', 'down'];
      }
      if (fromDir === 'down' && toDir === 'up') {
        return isSprint ? ['right', 'up'] : ['down-right', 'right', 'up-right', 'up'];
      }
    }

    // 最短回転方向の算出 (-4 〜 +4)
    if (diff > 4) diff -= 8;
    if (diff < -4) diff += 8;

    const step = Math.sign(diff);
    const seq: Direction[] = [];

    if (isSprint) {
      // ダッシュ時は約90度刻みで素早くスパッと切り返す
      if (Math.abs(diff) >= 3) {
        const midIdx = (fromIdx + step * 2 + 8) % 8;
        seq.push(ROTATION_DIRECTIONS[midIdx]);
      }
      seq.push(toDir);
    } else {
      // 小走りは45度刻みでパラパラと素早く回転
      let cur = fromIdx;
      while (cur !== toIdx) {
        cur = (cur + step + 8) % 8;
        seq.push(ROTATION_DIRECTIONS[cur]);
      }
    }
    return seq;
  }

  // キー入力に応じたプレイヤー物理演算
  private updatePlayerPhysics(dt: number) {
    const k = this.keys;
    // WASD と 矢印キー
    const isUp = Boolean(k['KeyW'] || k['ArrowUp'] || k['w'] || k['W']);
    const isDown = Boolean(k['KeyS'] || k['ArrowDown'] || k['s'] || k['S']);
    const isLeft = Boolean(k['KeyA'] || k['ArrowLeft'] || k['a'] || k['A']);
    const isRight = Boolean(k['KeyD'] || k['ArrowRight'] || k['d'] || k['D']);
    const isCtrl = Boolean(k['ControlLeft'] || k['ControlRight'] || k['Control']);
    const isShift = Boolean(k['ShiftLeft'] || k['ShiftRight'] || k['Shift']);
    // CTRLキーが押されている間はSHIFTキーでしゃがめない（ダッシュ移行や操作競合を防止）
    const isSneak = isShift && !isCtrl;
    const isJump = Boolean(k['Space'] || k[' ']);

    // 方向ベクトル
    let dx = 0;
    let dy = 0;
    if (this.isSwipingMovement && this.swipeDist >= 6) {
      // 📱 スワイプ操作時は360度シームレスなアナログ方向ベクトルを直接採用！
      dx = this.swipeAnalogDir.x;
      dy = this.swipeAnalogDir.y;
    } else {
      // ⌨️ キーボード操作時はWASD / 矢印キー
      if (isUp) dy -= 1;
      if (isDown) dy += 1;
      if (isLeft) dx -= 1;
      if (isRight) dx += 1;
    }

    const isMoving = dx !== 0 || dy !== 0;
    this.playerState.isMoving = isMoving;
    this.playerState.isSprinting = (this.playerMoveTier === 'dash' || this.playerMoveTier === 'jog') && isMoving;
    this.playerState.isSneaking = isSneak;

    // 🛋️ ベンチ近くでしゃがむ（Shift / スマホしゃがみボタン）を押した際の自動着席
    if (isSneak && !this.playerState.isSitting && !this.playerState.isDriving && !this.playerState.isSleeping) {
      if (this.currentWorld && this.currentAssets) {
        const px = this.playerState.x;
        const py = this.playerState.y;
        for (const ent of Object.values(this.currentWorld.entities)) {
          const a = this.currentAssets[ent.assetId];
          if (a?.interactions?.some((i) => i.type === 'sit')) {
            const d = Math.hypot(ent.position.x - px, ent.position.y - py);
            if (d < 55) {
              const sat = this.toggleSit(ent.id);
              if (sat) {
                this.onAutoSitTriggered?.(ent.id);
                this.keys['ShiftLeft'] = false;
                this.keys['ShiftRight'] = false;
                this.keys['Shift'] = false;
                break;
              }
            }
          }
        }
      }
    }

    // 就寝中の処理 (WASDやSpaceで自然に起き上がる)
    if (this.playerState.isSleeping) {
      if (isMoving || isJump) {
        this.playerState.isSleeping = false;
        this.playerState.sleepingBedEntityId = null;
        this.playerState.y += 18;
        this.playerState.z = 0;
      } else {
        this.updatePlayerSpriteVisual();
        return;
      }
    }

    // 着席中の処理 (WASDやSpaceで自然に立ち上がる)
    if (this.playerState.isSitting) {
      if (isMoving || isJump) {
        this.playerState.isSitting = false;
        this.playerState.sittingEntityId = null;
        this.playerState.y += 10;
        this.playerState.z = 0;
      } else {
        this.updatePlayerSpriteVisual();
        return;
      }
    }

    // 癒し空間と快適性を両立した3段階速度設定 (歩き: 120, 小走り: 190, ダッシュ: 280)
    const isSprint = this.playerMoveTier === 'dash';
    let speed = 120; // 通常歩行 (昭和レトロタウンをゆったり散策できる癒し速度)
    if (this.playerState.isDriving) {
      speed = 500; // ランボルギーニ巡航速度 (徒歩の4倍以上で明確に優位)
      if (this.playerMoveTier === 'dash') speed = 880; // ターボ・ニトロ猛加速
      else if (this.playerMoveTier === 'jog') speed = 650; // 高速クルージング
      else if (isSneak) speed = 180; // 慎重な車庫入れ速度
    } else {
      if (isSneak) speed = 70; // スニーク (静かに忍び足)
      else if (this.playerMoveTier === 'dash') speed = 280; // ダッシュ (しっかり走る爽快ダッシュ)
      else if (this.playerMoveTier === 'jog') speed = 190; // 小走り (軽快なジョギング)
      else speed = 120; // 歩き
    }

    // 現在の足場高さ (地面=0、またはオブジェクトの天面)
    const floorZ = this.getElevatedFloorZ(this.playerState.x, this.playerState.y);

    // ジャンプ物理 (歩きジャンプ=小ジャンプ、小走りジャンプ=中ジャンプ、ダッシュジャンプ=大ジャンプ)
    const gravity = 800; // px/s^2
    if (isJump && this.playerState.z <= floorZ + 2) {
      let jumpVz = 240; // 歩き時: 小ジャンプ (到達高さ 約36px)
      if (this.playerMoveTier === 'dash') {
        jumpVz = 410; // ダッシュ時: 大ジャンプ (到達高さ 約105px、ダイナミックな跳躍)
      } else if (this.playerMoveTier === 'jog') {
        jumpVz = 320; // 小走り時: 中ジャンプ (到達高さ 約64px、バランスの良い跳躍)
      } else if (isSneak) {
        jumpVz = 180; // スニーク時: 極小ジャンプ (到達高さ 約20px)
      }
      if (this.playerState.isDriving) {
        jumpVz = this.playerMoveTier === 'dash' ? 440 : 340;
      }

      this.playerState.vz = jumpVz;
      this.playerState.isJumping = true;
      if (!this.playerState.isDriving) {
        audioManager.playJump();
      }
    }

    if (this.playerState.isJumping || this.playerState.z > floorZ) {
      this.playerState.z += this.playerState.vz * dt;
      this.playerState.vz -= gravity * dt;
      if (this.playerState.z <= floorZ) {
        this.playerState.z = floorZ;
        this.playerState.vz = 0;
        if (this.playerState.isJumping && !this.playerState.isDriving) {
          audioManager.playLand();
        }
        this.playerState.isJumping = false;
      }
    }

    // 移動の適用（衝突判定 ＆ ピボット反転ターン ＆ 大回り慣性コーナリング ＆ スライディング移動）
    if (isMoving) {
      this.movingDuration += dt;
      const targetLen = Math.hypot(dx, dy);
      const targetAngle = Math.atan2(dy, dx);
      const targetDeg = (targetAngle * 180) / Math.PI;

      // 目標の8方向向きを算出
      let targetDirection: Direction = 'down';
      if (targetDeg >= -22.5 && targetDeg < 22.5) targetDirection = 'right';
      else if (targetDeg >= 22.5 && targetDeg < 67.5) targetDirection = 'down-right';
      else if (targetDeg >= 67.5 && targetDeg < 112.5) targetDirection = 'down';
      else if (targetDeg >= 112.5 && targetDeg < 157.5) targetDirection = 'down-left';
      else if (targetDeg >= 157.5 || targetDeg < -157.5) targetDirection = 'left';
      else if (targetDeg >= -157.5 && targetDeg < -112.5) targetDirection = 'up-left';
      else if (targetDeg >= -112.5 && targetDeg < -67.5) targetDirection = 'up';
      else if (targetDeg >= -67.5 && targetDeg < -22.5) targetDirection = 'up-right';

      // 🔄 立ち止まり（または動き出し直後）からの急反転判定
      const isStartingFromIdle = !this.isMoveAngleInitialized || this.movingDuration <= dt * 1.5;

      if (isStartingFromIdle) {
        const fromDir = this.playerState.direction;
        const fromIdx = ROTATION_DIRECTIONS.indexOf(fromDir);
        const toIdx = ROTATION_DIRECTIONS.indexOf(targetDirection);
        let dirDiff = Math.abs(toIdx - fromIdx);
        if (dirDiff > 4) dirDiff = 8 - dirDiff;

        // 90度以上の大きな方向転換かつ徒歩・ダッシュ時（非乗車時）
        if (dirDiff >= 2 && !this.playerState.isDriving && (this.playerMoveTier === 'dash' || this.playerMoveTier === 'jog')) {
          // 🔄 ピボット反転ターン開始！
          this.isPivotTurning = true;
          this.pivotTurnTimer = 0;
          this.pivotTurnSequence = this.createPivotSequence(fromDir, targetDirection, this.playerMoveTier === 'dash');
          // 移動角度は最初から即座に目標方向へ直進！大回り慣性で逆走するのを100%防止
          this.currentMoveAngle = targetAngle;
          this.isMoveAngleInitialized = true;
        } else {
          // 通常の歩き出し
          this.isPivotTurning = false;
          this.currentMoveAngle = this.getDirectionAngle(this.playerState.direction);
          this.isMoveAngleInitialized = true;
        }
      }

      // 旋回レート (rad/s):
      // ピボットターン中は大回り慣性を適用せず即時目標角へ直進
      // 走行中のコーナリング:
      //   - ダッシュ (dash): 7.2 (スピードに乗った気持ちのいい大回り旋回！)
      //   - 小走り (jog): 15.0 (自然で軽快なコーナリング)
      //   - 歩き・スニーク: 28.0 (小回りが利きキビキビ即時反応)
      //   - 車両運転: 通常 5.2 / ダッシュ時 3.8 (ハイスピードな大回りドリフト旋回)
      if (this.isPivotTurning) {
        this.currentMoveAngle = targetAngle;
      } else {
        let turnRate = 28.0;
        if (this.playerState.isDriving) {
          turnRate = this.playerMoveTier === 'dash' ? 3.8 : 5.2;
        } else {
          if (this.playerMoveTier === 'dash') {
            turnRate = 7.2;
          } else if (this.playerMoveTier === 'jog') {
            turnRate = 15.0;
          } else {
            turnRate = 28.0;
          }
        }

        // 最短角度差分 (-PI 〜 PI) を計算
        let angleDiff = targetAngle - this.currentMoveAngle;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

        // dt に応じた旋回ステップ
        const maxTurn = turnRate * dt;
        if (Math.abs(angleDiff) <= maxTurn) {
          this.currentMoveAngle = targetAngle;
        } else {
          this.currentMoveAngle += Math.sign(angleDiff) * maxTurn;
        }
      }

      // 実際の進行方向ベクトル
      const actualDirX = Math.cos(this.currentMoveAngle);
      const actualDirY = Math.sin(this.currentMoveAngle);

      const moveDistX = actualDirX * speed * dt;
      const moveDistY = actualDirY * speed * dt;

      // X方向の移動検証 (天面より下にいる時のみ壁としてブロック)
      const nextX = this.playerState.x + moveDistX;
      const collidersX = this.getCollidingObjects(nextX, this.playerState.y);
      const isBlockedX = collidersX.some((c) => this.playerState.z < c.topZ - 4);
      if (!isBlockedX) {
        this.playerState.x = nextX;
      }

      // Y方向の移動検証 (Xと独立して滑らかに壁沿いをスライド移動)
      const nextY = this.playerState.y + moveDistY;
      const collidersY = this.getCollidingObjects(this.playerState.x, nextY);
      const isBlockedY = collidersY.some((c) => this.playerState.z < c.topZ - 4);
      if (!isBlockedY) {
        this.playerState.y = nextY;
      }

      // 向きの更新:
      // 1. ピボットターン中: シーケンスに沿って素早く向きを切り替え
      //    (ダッシュ: 40msでスパッと下・右 / 小走り: 35msでパラパラと左下・下・右下・右)
      // 2. 通常移動中: 進行角度からリアルタイムに滑らかに更新
      if (this.isPivotTurning && this.pivotTurnSequence.length > 0) {
        this.pivotTurnTimer += dt;
        const stepDuration = this.playerMoveTier === 'dash' ? 0.040 : 0.035;
        const currentStepIndex = Math.floor(this.pivotTurnTimer / stepDuration);
        if (currentStepIndex < this.pivotTurnSequence.length) {
          this.playerState.direction = this.pivotTurnSequence[currentStepIndex];
        } else {
          this.isPivotTurning = false;
          this.pivotTurnSequence = [];
          this.playerState.direction = targetDirection;
        }
      } else {
        const deg = (this.currentMoveAngle * 180) / Math.PI;

        if (this.playerState.isDriving) {
          if (deg >= -45 && deg <= 45) {
            this.playerState.direction = 'right';
          } else if (deg >= 135 || deg <= -135) {
            this.playerState.direction = 'left';
          } else if (deg > 45 && deg < 135) {
            this.playerState.direction = 'down';
          } else {
            this.playerState.direction = 'up';
          }
        } else {
          if (deg >= -22.5 && deg < 22.5) {
            this.playerState.direction = 'right';
          } else if (deg >= 22.5 && deg < 67.5) {
            this.playerState.direction = 'down-right';
          } else if (deg >= 67.5 && deg < 112.5) {
            this.playerState.direction = 'down';
          } else if (deg >= 112.5 && deg < 157.5) {
            this.playerState.direction = 'down-left';
          } else if (deg >= 157.5 || deg < -157.5) {
            this.playerState.direction = 'left';
          } else if (deg >= -157.5 && deg < -112.5) {
            this.playerState.direction = 'up-left';
          } else if (deg >= -112.5 && deg < -67.5) {
            this.playerState.direction = 'up';
          } else if (deg >= -67.5 && deg < -22.5) {
            this.playerState.direction = 'up-right';
          }
        }
      }

      // 歩行アニメーションタイマー
      const animSpeed = isSneak ? 6 : (this.playerMoveTier === 'dash' ? 20 : (this.playerMoveTier === 'jog' ? 14 : 9));
      this.walkAnimTimer += dt * animSpeed;

      // 足音SE再生 (歩行時かつ接地中かつ非乗車時)
      if (!this.playerState.isDriving && this.playerState.z <= floorZ + 2) {
        const stepInterval = isSneak ? 0.52 : (this.playerMoveTier === 'dash' ? 0.20 : (this.playerMoveTier === 'jog' ? 0.28 : 0.40));
        const prevStepCount = Math.floor(this.stepTimer / stepInterval);
        this.stepTimer += dt;
        const curStepCount = Math.floor(this.stepTimer / stepInterval);
        if (curStepCount > prevStepCount) {
          const surface = this.getSurfaceAt(this.playerState.x, this.playerState.y);
          audioManager.playFootstep(surface, this.playerMoveTier === 'dash');
        }
      } else {
        this.stepTimer = 0;
      }

      // ダッシュ時 または 乗車爆走時の土煙・タイヤスモーク
      const shouldEmitDust = this.playerState.isDriving
        ? (Math.random() < (isSprint ? 0.85 : 0.45))
        : (isSprint && this.playerState.z <= 0 && Math.random() < 0.4);

      if (shouldEmitDust) {
        const pSpread = this.playerState.isDriving ? 14 : 8;
        this.dustParticles.push({
          x: this.playerState.x + (Math.random() * pSpread - pSpread / 2),
          y: this.playerState.y + (Math.random() * 6 - 3),
          vx: (Math.random() - 0.5) * (this.playerState.isDriving ? 50 : 30),
          vy: -15 - Math.random() * (this.playerState.isDriving ? 35 : 20),
          life: this.playerState.isDriving ? (isSprint ? 0.45 : 0.35) : 0.35,
        });
      }
    } else {
      this.isMoveAngleInitialized = false;
      this.walkAnimTimer = 0;
      this.stepTimer = 0;
    }

    // 車両エンジン音 (乗車時はリアルタイムに回転数・ニトロ反映)
    if (this.playerState.isDriving) {
      audioManager.updateEngine(isMoving, isSprint, speed);
    } else {
      audioManager.stopEngine();
    }

    // 空間音響（駅前・屋外などの反響度）の動的更新
    this.updateAcoustics(this.playerState.x, this.playerState.y);

    // プレイヤーのスプライト位置を直接更新 (Reactを介さず爆速)
    this.updatePlayerSpriteVisual();
  }

  // プレイヤーのスプライト描画更新 (8方向/4方向・ボビング・影)
  private updatePlayerSpriteVisual() {
    const sprite = this.entitySprites.get('player_main');
    if (!sprite) return;

    // スプライトテクスチャの切り替え (8方向 / 4方向フォールバック対応)
    const asset = this.currentAssets?.[this.playerState.assetId];
    if (asset) {
      const dir = this.playerState.direction;
      let dirUrl = asset.sprite.directionalUrls?.[dir];
      if (!dirUrl && asset.sprite.directionalUrls) {
        if (dir === 'down-right') dirUrl = asset.sprite.directionalUrls['right'] || asset.sprite.directionalUrls['down'];
        else if (dir === 'down-left') dirUrl = asset.sprite.directionalUrls['left'] || asset.sprite.directionalUrls['down'];
        else if (dir === 'up-right') dirUrl = asset.sprite.directionalUrls['right'] || asset.sprite.directionalUrls['up'];
        else if (dir === 'up-left') dirUrl = asset.sprite.directionalUrls['left'] || asset.sprite.directionalUrls['up'];
      }
      if (!dirUrl) dirUrl = asset.sprite.url;
      const resolvedDir = resolveAssetUrl(dirUrl);

      if (this.textureCache.has(resolvedDir) || this.textureCache.has(dirUrl)) {
        sprite.texture = (this.textureCache.get(resolvedDir) || this.textureCache.get(dirUrl))!;
      } else {
        this.getTexture(dirUrl).then((tex) => {
          if (sprite && !sprite.destroyed) {
            sprite.texture = tex;
            if (this.playerState.isDriving) {
              const aspect = tex.height > 0 ? tex.width / tex.height : 1.5;
              const targetH = 36;
              sprite.height = targetH;
              sprite.width = Math.round(targetH * aspect);
            }
          }
        });
      }

      if (this.playerState.isDriving) {
        // 🚗 車両の自然なアスペクト比を動的計算（スマホの斜め入力や横向きでも絶対に潰れない！）
        const tex = sprite.texture;
        const texW = tex?.width || 58;
        const texH = tex?.height || 38;
        const aspect = texH > 0 ? texW / texH : 1.5;
        const targetH = 36;
        sprite.height = targetH;
        sprite.width = Math.round(targetH * aspect);
        sprite.anchor.set(0.5, 0.85);
      } else {
        if (this.playerState.isSneaking) {
          // 🏃 しゃがみ（愛らしく腰を落として低姿勢になる）
          sprite.width = asset.sprite.width * 1.08;
          sprite.height = asset.sprite.height * 0.76;
          sprite.anchor.set(0.5, 0.92);
        } else if (this.playerState.isSitting) {
          // 🛋️ ベンチ着席（座面に自然に腰掛ける）
          sprite.width = asset.sprite.width * 0.95;
          sprite.height = asset.sprite.height * 0.82;
          sprite.anchor.set(0.5, 0.84);
        } else {
          sprite.width = asset.sprite.width;
          sprite.height = asset.sprite.height;
          if (asset.sprite.width > 0 && asset.sprite.height > 0) {
            sprite.anchor.set(asset.anchor.x / asset.sprite.width, asset.anchor.y / asset.sprite.height);
          }
        }
      }
    }

    // 歩行ボビング (車運転中または着席中はボビングさせず静止)
    let bobbingY = 0;
    if (this.playerState.isMoving && !this.playerState.isDriving && !this.playerState.isSitting) {
      bobbingY = Math.sin(this.walkAnimTimer) * 2;
    }

    sprite.x = this.playerState.x;
    sprite.y = this.playerState.y - this.playerState.z + bobbingY;
    (sprite as any).worldFootY = this.playerState.y;

    // 接地影の更新 (足元接地Yに固定、乗車時は大型シャドウ、しゃがみ時は低く広がる)
    this.shadowGraphics.clear();
    if (this.playerState.isDriving) {
      const isHorizontal = this.playerState.direction === 'left' || this.playerState.direction === 'right';
      const rx = isHorizontal ? 42 : 24;
      const ry = isHorizontal ? 9 : 14;
      this.shadowGraphics
        .ellipse(this.playerState.x, this.playerState.y, rx, ry)
        .fill({ color: 0x000000, alpha: 0.45 });
    } else {
      const floorZ = this.getElevatedFloorZ(this.playerState.x, this.playerState.y);
      const airHeight = Math.max(0, this.playerState.z - floorZ);
      const shadowScale = Math.max(0.35, 1 - airHeight / 180);
      const isCrouch = this.playerState.isSneaking;
      const rx = (isCrouch ? 11 : 8) * shadowScale;
      const ry = (isCrouch ? 4.5 : 3) * shadowScale;
      const alpha = (isCrouch ? 0.45 : 0.35) * shadowScale;
      this.shadowGraphics
        .ellipse(this.playerState.x, this.playerState.y, rx, ry)
        .fill({ color: 0x000000, alpha });
    }
  }

  private centerCamera() {
    if (!this.container) return;
    const width = this.container.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1280);
    const height = this.container.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 720);
    this.cameraX = width / 2 - this.playerState.x * this.zoom;
    this.cameraY = height / 2 - this.playerState.y * this.zoom;
    this.updateCameraTransform();
  }

  private updateCameraTransform() {
    this.stageContainer.position.set(this.cameraX, this.cameraY);
    this.stageContainer.scale.set(this.zoom);
  }

  public screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.cameraX) / this.zoom,
      y: (screenY - this.cameraY) / this.zoom,
    };
  }

  public worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: worldX * this.zoom + this.cameraX,
      y: worldY * this.zoom + this.cameraY,
    };
  }

  public panCamera(dx: number, dy: number): void {
    this.cameraX += dx;
    this.cameraY += dy;
    this.updateCameraTransform();
  }

  public zoomCamera(delta: number, centerX?: number, centerY?: number): void {
    if (!this.container) return;
    const cx = centerX ?? this.container.clientWidth / 2;
    const cy = centerY ?? this.container.clientHeight / 2;

    const oldZoom = this.zoom;
    const newZoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoom * (1 + delta)));

    const worldPos = this.screenToWorld(cx, cy);
    this.zoom = newZoom;
    this.cameraX = cx - worldPos.x * newZoom;
    this.cameraY = cy - worldPos.y * newZoom;
    this.updateCameraTransform();
  }

  public resetCamera(): void {
    this.zoom = 1.05;
    this.centerCamera();
  }

  public followPlayer(playerX: number, playerY: number, dt: number = 0.016) {
    if (!this.container || this.isDraggingCamera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const targetCamX = width / 2 - playerX * this.zoom;
    const targetCamY = height / 2 - playerY * this.zoom;

    // dt を考慮した指数平滑化 (フレームレート非依存の超滑らかなカメラワーク)
    // 乗車爆走中はカメラ遅延ジッターを防ぐため追従係数を高める
    const decay = this.playerState.isDriving ? 22 : 12;
    const t = 1 - Math.exp(-decay * dt);

    this.cameraX += (targetCamX - this.cameraX) * t;
    this.cameraY += (targetCamY - this.cameraY) * t;
    this.updateCameraTransform();
  }

  public async setPlayerAvatar(assetId: string) {
    this.playerState.assetId = assetId;
    if (this.currentAssets?.[assetId]) {
      const asset = this.currentAssets[assetId];
      // 4方向・8方向テクスチャのプリロード
      if (asset.sprite.directionalUrls) {
        for (const url of Object.values(asset.sprite.directionalUrls)) {
          if (url) await this.getTexture(url);
        }
      }
      await this.updateEntitySprite(
        'player_main',
        asset,
        this.playerState.x,
        this.playerState.y,
        this.playerState.z,
        1.0
      );
      this.updatePlayerSpriteVisual();
    }
  }

  // 🏎️ 乗り物に乗る
  public async enterVehicle(entityId: string, vehicleAssetId: string) {
    if (this.playerState.isDriving) return;
    this.playerState.isDriving = true;
    this.playerState.drivingEntityId = entityId;
    this.playerState.drivingVehicleAssetId = vehicleAssetId;
    this.playerState.originalAvatarId = this.playerState.assetId;

    // 乗車SE再生
    audioManager.playVehicleEnter();

    // プレイヤーのスプライトを車両に変更
    await this.setPlayerAvatar(vehicleAssetId);

    // 車両エンティティのスプライトを非表示（プレイヤー自身が運転するため）
    const vehicleSprite = this.entitySprites.get(entityId);
    if (vehicleSprite) {
      vehicleSprite.visible = false;
    }

    // 🏛️ 静的接地影を即時再描画（元の場所に影が焼き付いて残るのを完全に防ぐ）
    this.renderStaticShadows();
  }

  // 🏎️ 乗り物から降りる
  public async exitVehicle(): Promise<{ entityId: string | null; x: number; y: number } | null> {
    if (!this.playerState.isDriving) return null;
    const entityId = this.playerState.drivingEntityId;
    const originalAvatar = this.playerState.originalAvatarId || 'character_schoolgirl';
    const currentX = this.playerState.x;
    const currentY = this.playerState.y;

    // 降車SE再生
    audioManager.playVehicleExit();

    // 降車位置（車の横に降りる）
    const exitOffsetX = this.playerState.direction === 'left' ? 46 : -46;
    const exitX = currentX + exitOffsetX;
    const exitY = currentY;

    this.playerState.isDriving = false;
    this.playerState.drivingEntityId = null;
    this.playerState.drivingVehicleAssetId = null;

    // プレイヤーアバターを元の人間に戻す
    await this.setPlayerAvatar(originalAvatar);
    this.playerState.x = exitX;
    this.playerState.y = exitY;

    // 車両スプライトを現在位置（停車位置）に再表示
    if (entityId) {
      const vehicleSprite = this.entitySprites.get(entityId);
      if (vehicleSprite) {
        vehicleSprite.visible = true;
        vehicleSprite.x = currentX;
        vehicleSprite.y = currentY;
        (vehicleSprite as any).worldFootY = currentY;
      }
    }

    this.updatePlayerSpriteVisual();

    // 🏛️ 静的接地影を即時再描画（降車位置に影を正しく再配置）
    this.renderStaticShadows();

    return { entityId, x: currentX, y: currentY };
  }

  private async getTexture(url: string): Promise<Texture> {
    const targetUrl = resolveAssetUrl(url);
    if (this.textureCache.has(url)) {
      return this.textureCache.get(url)!;
    }
    if (this.textureCache.has(targetUrl)) {
      return this.textureCache.get(targetUrl)!;
    }
    if (this.textureLoadingPromises.has(targetUrl)) {
      return this.textureLoadingPromises.get(targetUrl)!;
    }

    const loadPromise = (async () => {
      try {
        const texture = await Assets.load(targetUrl);
        if (texture.source) {
          texture.source.scaleMode = 'nearest';
        }
        this.textureCache.set(url, texture);
        this.textureCache.set(targetUrl, texture);
        return texture;
      } catch (err) {
        console.error('[PixiWorldRenderer] Failed to load texture:', targetUrl, err);
        throw err;
      } finally {
        this.textureLoadingPromises.delete(targetUrl);
      }
    })();

    this.textureLoadingPromises.set(targetUrl, loadPromise);
    return loadPromise;
  }

  // ワールド同期 (マップタイル・エンティティ配置)
  public async render(
    world: AirasWorldData,
    assets: Record<string, AirasAsset>,
    selectedEntityId?: string | null,
    ghosts?: RendererGhostEntity[]
  ): Promise<void> {
    if (!this.app) return;
    this.currentAssets = assets;
    this.currentWorld = world;
    this.currentWeather = world.environment.weather;

    // 1. 静的マップタイルの初期化（一度だけ実行）
    if (this.tileContainer.children.length === 0) {
      await this.renderTiles(world, assets);
    }

    // 2. プレイヤーの登録・テクスチャプリロード
    const playerAsset = assets[this.playerState.assetId] || assets[world.player.assetId];
    if (playerAsset) {
      if (playerAsset.sprite.directionalUrls) {
        for (const url of Object.values(playerAsset.sprite.directionalUrls)) {
          if (url) await this.getTexture(url);
        }
      }
      await this.updateEntitySprite(
        'player_main',
        playerAsset,
        this.playerState.x,
        this.playerState.y,
        this.playerState.z,
        1.0
      );
    }

    // 3. ワールドオブジェクト・NPC描画
    const renderedIds = new Set<string>(['player_main']);

    for (const entity of Object.values(world.entities)) {
      // 運転中の車両はプレイヤー自身が描画するため、ワールドエンティティとしては非表示
      if (this.playerState.isDriving && entity.id === this.playerState.drivingEntityId) {
        const vSprite = this.entitySprites.get(entity.id);
        if (vSprite) vSprite.visible = false;
        renderedIds.add(entity.id);
        continue;
      }

      const asset = assets[entity.assetId];
      if (!asset) continue;

      if (asset.sprite.directionalUrls) {
        for (const url of Object.values(asset.sprite.directionalUrls)) {
          if (url) await this.getTexture(url);
        }
      }

      await this.updateEntitySprite(
        entity.id,
        asset,
        entity.position.x,
        entity.position.y,
        entity.position.z,
        1.0,
        false,
        entity.direction
      );
      renderedIds.add(entity.id);
    }

    // 4. ゴーストプレビュー
    if (ghosts && ghosts.length > 0) {
      for (let i = 0; i < ghosts.length; i++) {
        const g = ghosts[i];
        const gAsset = assets[g.assetId];
        if (!gAsset) continue;
        const gId = `__ghost_${i}`;
        await this.updateEntitySprite(gId, gAsset, g.x, g.y, 0, 0.65, true);
        renderedIds.add(gId);
      }
    }

    // 不要スプライト削除
    for (const [id, sprite] of this.entitySprites.entries()) {
      if (!renderedIds.has(id)) {
        this.depthContainer.removeChild(sprite);
        this.entitySprites.delete(id);
      }
    }

    // 🛡️ 安全装置: depthContainer 内に entitySprites に登録されていない孤立スプライト（残留キャラ等）があれば完全排除
    const registeredSprites = new Set(this.entitySprites.values());
    for (let i = this.depthContainer.children.length - 1; i >= 0; i--) {
      const child = this.depthContainer.children[i];
      if (!registeredSprites.has(child as any)) {
        this.depthContainer.removeChild(child);
      }
    }

    // 5. 選択ハイライト
    this.renderSelectionHighlight(world, assets, selectedEntityId);

    // 6. 🏛️ 静的接地影 & 静的街灯ライティング（エンティティ配置時・天候変更時のみ更新し毎フレーム走査を完全排除）
    this.renderStaticShadows(world, assets);
    this.renderStaticLighting(world);
  }

  // 👥 リモートプレイヤー（スマホや他PCの参加者）のリアルタイム描画同期
  public async updateRemotePlayers(players: RemotePlayerInfo[]) {
    if (!this.currentAssets) return;
    const activeIds = new Set<string>();

    this.remoteShadowGraphics.clear();

    for (const p of players) {
      const spriteId = `__remote_${p.id}`;
      activeIds.add(spriteId);
      const asset = this.currentAssets[p.assetId] || this.currentAssets['character_schoolgirl'];
      if (!asset) continue;

      let targetUrl = asset.sprite.url;
      if (asset.sprite.directionalUrls) {
        targetUrl = asset.sprite.directionalUrls[p.direction]
          || asset.sprite.directionalUrls['down']
          || asset.sprite.url;
      }

      const texture = await this.getTexture(targetUrl);
      let sprite = this.entitySprites.get(spriteId);

      if (!sprite) {
        sprite = new Sprite(texture);
        sprite.eventMode = 'none';
        this.entitySprites.set(spriteId, sprite);
        this.depthContainer.addChild(sprite);
      } else {
        sprite.texture = texture;
      }

      if (p.isDriving) {
        const tex = sprite.texture;
        const texW = tex?.width || 58;
        const texH = tex?.height || 38;
        const aspect = texH > 0 ? texW / texH : 1.5;
        const targetH = 36;
        sprite.height = targetH;
        sprite.width = Math.round(targetH * aspect);
        sprite.anchor.set(0.5, 0.85);
      } else {
        const ax = asset.sprite.width > 0 ? asset.anchor.x / asset.sprite.width : 0.5;
        const ay = asset.sprite.height > 0 ? asset.anchor.y / asset.sprite.height : 1.0;
        sprite.anchor.set(ax, ay);
        sprite.width = asset.sprite.width;
        sprite.height = asset.sprite.height;
      }

      // 歩行ボビング
      const bobY = p.isMoving ? Math.sin(Date.now() / 120) * 2 : 0;
      sprite.x = p.x;
      sprite.y = p.y - p.z + bobY;
      (sprite as any).worldFootY = p.y;

      // 👤 リモートプレイヤーのリアル接地影（ジャンプ z による影の拡縮）
      if (p.isDriving) {
        const isHorizontal = p.direction === 'left' || p.direction === 'right';
        const rx = isHorizontal ? 42 : 24;
        const ry = isHorizontal ? 9 : 14;
        this.remoteShadowGraphics
          .ellipse(p.x, p.y, rx, ry)
          .fill({ color: 0x000000, alpha: 0.45 });
      } else {
        const airHeight = Math.max(0, p.z);
        const shadowScale = Math.max(0.3, 1 - airHeight / 160);
        const rx = 8 * shadowScale;
        const ry = 3 * shadowScale;
        const alpha = 0.35 * shadowScale;
        this.remoteShadowGraphics
          .ellipse(p.x, p.y, rx, ry)
          .fill({ color: 0x000000, alpha });
      }

      // 💨 リモートプレイヤーがダッシュしている時は足元から土煙を発生
      if (p.isSprinting && p.isMoving && Math.random() < 0.25) {
        this.dustParticles.push({
          x: p.x + (Math.random() - 0.5) * 8,
          y: p.y - 2,
          vx: (Math.random() - 0.5) * 0.6,
          vy: -Math.random() * 0.6,
          life: 1.0,
        });
      }
    }

    // 退室したリモートプレイヤーの削除
    for (const [id, sprite] of this.entitySprites.entries()) {
      if (id.startsWith('__remote_') && !activeIds.has(id)) {
        this.depthContainer.removeChild(sprite);
        this.entitySprites.delete(id);
      }
    }
  }

  // プレイヤー足元の材質判定（芝生・石畳・アスファルト・木床）
  private getSurfaceAt(x: number, y: number): SurfaceType {
    if (!this.currentWorld) return 'stone';
    const tileSize = this.currentWorld.map.tileSize || 32;
    const chunkSize = this.currentWorld.map.chunkSize || 16;
    const tileX = Math.floor(x / tileSize);
    const tileY = Math.floor(y / tileSize);
    const cx = Math.floor(tileX / chunkSize);
    const cy = Math.floor(tileY / chunkSize);
    const chunk = this.currentWorld.map.chunks[`${cx},${cy}`];
    if (!chunk || !chunk.tiles) return 'stone';

    const lx = ((tileX % chunkSize) + chunkSize) % chunkSize;
    const ly = ((tileY % chunkSize) + chunkSize) % chunkSize;
    const tile = chunk.tiles[ly]?.[lx];
    if (!tile) return 'stone';

    const tileId = tile.tileId.toLowerCase();
    if (tileId.includes('water') || tileId.includes('river')) return 'water';
    if (tileId.includes('grass') || tileId.includes('dirt')) return 'grass';
    if (tileId.includes('road') || tileId.includes('asphalt')) return 'road';
    if (tileId.includes('wood') || tileId.includes('floor')) return 'wood';
    return 'stone';
  }

  // 空間リバーブの動的制御
  private updateAcoustics(_x: number, y: number) {
    // 駅舎・ホーム・線路（y <= 240）付近では反響を深める
    if (y < 240) {
      audioManager.setReverbWet(0.42);
    } else {
      audioManager.setReverbWet(0.18);
    }
  }

  public async refreshTiles(world?: AirasWorldData, assets?: Record<string, AirasAsset>) {
    const targetWorld = world || this.currentWorld;
    const targetAssets = assets || this.currentAssets;
    if (!targetWorld || !targetAssets) return;
    this.tileContainer.removeChildren();
    await this.renderTiles(targetWorld, targetAssets);
  }

  private async renderTiles(world: AirasWorldData, assets: Record<string, AirasAsset>) {
    const tileSize = world.map.tileSize;
    for (const chunk of Object.values(world.map.chunks)) {
      const offsetX = chunk.cx * world.map.chunkSize * tileSize;
      const offsetY = chunk.cy * world.map.chunkSize * tileSize;

      for (let y = 0; y < chunk.tiles.length; y++) {
        for (let x = 0; x < chunk.tiles[y].length; x++) {
          const tile = chunk.tiles[y][x];
          const asset = assets[tile.tileId];
          if (!asset) continue;

          const texture = await this.getTexture(asset.sprite.url);
          const sprite = new Sprite(texture);
          sprite.x = offsetX + x * tileSize;
          sprite.y = offsetY + y * tileSize;
          sprite.width = tileSize;
          sprite.height = tileSize;
          this.tileContainer.addChild(sprite);
        }
      }
    }
  }

  public async updateEntitySprite(
    id: string,
    asset: AirasAsset,
    x: number,
    y: number,
    z: number,
    alpha: number = 1.0,
    isGhost: boolean = false,
    direction?: Direction
  ) {
    let sprite = this.entitySprites.get(id);
    if (!sprite) {
      // 🚀 同期的に即座にスプライトを生成・登録し、非同期ロード中の重複生成レースコンディションを完全排除！
      sprite = new Sprite();
      sprite.eventMode = 'static';
      this.entitySprites.set(id, sprite);
      this.depthContainer.addChild(sprite);
    }

    let targetUrl = asset.sprite.url;

    const dir: Direction = (id === 'player_main')
      ? this.playerState.direction
      : (direction || this.currentWorld?.entities[id]?.direction || 'down');

    if (asset.sprite.directionalUrls) {
      targetUrl = asset.sprite.directionalUrls[dir]
        || (dir === 'down-right' ? asset.sprite.directionalUrls['right'] || asset.sprite.directionalUrls['down'] : null)
        || (dir === 'down-left' ? asset.sprite.directionalUrls['left'] || asset.sprite.directionalUrls['down'] : null)
        || (dir === 'up-right' ? asset.sprite.directionalUrls['right'] || asset.sprite.directionalUrls['up'] : null)
        || (dir === 'up-left' ? asset.sprite.directionalUrls['left'] || asset.sprite.directionalUrls['up'] : null)
        || asset.sprite.directionalUrls['down']
        || asset.sprite.url;
    }
    const texture = await this.getTexture(targetUrl);

    if (sprite && !sprite.destroyed) {
      sprite.texture = texture;
    }

    if (asset.sprite.directionalUrls && id !== 'player_main') {
      const baseHeight = asset.sprite.height || 36;
      const aspect = (texture.width || 1) / (texture.height || 1);
      sprite.height = baseHeight;
      sprite.width = Math.round(baseHeight * aspect);
      sprite.anchor.set(0.5, 0.92);
    } else {
      const ax = asset.sprite.width > 0 ? asset.anchor.x / asset.sprite.width : 0.5;
      const ay = asset.sprite.height > 0 ? asset.anchor.y / asset.sprite.height : 1.0;
      sprite.anchor.set(ax, ay);
      sprite.width = asset.sprite.width;
      sprite.height = asset.sprite.height;
    }

    sprite.x = x;
    sprite.y = y - z;
    (sprite as any).worldFootY = y;

    sprite.alpha = isGhost ? 0.65 : alpha;
    if (isGhost) {
      sprite.tint = 0x38bdf8;
    } else {
      sprite.tint = 0xffffff;
    }
  }

  private updateDustParticles(dt: number) {
    this.particleGraphics.clear();
    for (let i = this.dustParticles.length - 1; i >= 0; i--) {
      const p = this.dustParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

      if (p.life <= 0) {
        this.dustParticles.splice(i, 1);
        continue;
      }

      this.particleGraphics
        .circle(p.x, p.y, Math.max(1, p.life * 6))
        .fill({ color: 0xe2e8f0, alpha: p.life * 0.75 });
    }
  }

  private renderSelectionHighlight(
    world: AirasWorldData,
    assets: Record<string, AirasAsset>,
    selectedEntityId?: string | null
  ) {
    this.selectionGraphics.clear();
    if (!selectedEntityId) return;

    const entity = world.entities[selectedEntityId];
    if (!entity) return;
    const asset = assets[entity.assetId];
    if (!asset) return;

    const footX = entity.position.x;
    const footY = entity.position.y;
    const colW = Math.max(24, asset.collision.width);
    const colH = Math.max(12, asset.collision.height);

    this.selectionGraphics
      .ellipse(footX, footY, colW / 2 + 4, colH / 2 + 2)
      .fill({ color: 0x38bdf8, alpha: 0.25 })
      .stroke({ color: 0x38bdf8, width: 2, alpha: 0.9 });
  }

  private waterFrameSkip: number = 0;

  // 🌊 リアルな水流アニメーション & コースティクス反射 & 水面波紋 (ビューポートカリング & 30Hz間引き)
  private updateWaterAnimation(dt: number) {
    if (!this.currentWorld) return;
    this.waterAnimationTime += dt;
    this.waterFrameSkip++;
    // 低負荷モード時は3フレームに1回、通常時は2フレームに1回（30FPS）更新でCPU頂点計算を半減
    const skipThreshold = this.isLowPerformanceMode ? 3 : 2;
    if (this.waterFrameSkip % skipThreshold !== 0) return;

    this.waterFlowGraphics.clear();

    const tileSize = this.currentWorld.map.tileSize || 32;
    const chunkSize = this.currentWorld.map.chunkSize || 16;
    const t = this.waterAnimationTime;

    // 画面の可視範囲（ビューポートカリング）で画面外の水タイル走査を完全スキップ
    const viewW = this.container ? this.container.clientWidth : 1280;
    const viewH = this.container ? this.container.clientHeight : 720;
    const minVx = -this.cameraX / this.zoom - 64;
    const maxVx = minVx + viewW / this.zoom + 128;
    const minVy = -this.cameraY / this.zoom - 64;
    const maxVy = minVy + viewH / this.zoom + 128;

    for (const chunk of Object.values(this.currentWorld.map.chunks)) {
      const offsetX = chunk.cx * chunkSize * tileSize;
      const offsetY = chunk.cy * chunkSize * tileSize;
      const chunkW = chunkSize * tileSize;
      if (offsetX + chunkW < minVx || offsetX > maxVx || offsetY + chunkW < minVy || offsetY > maxVy) {
        continue;
      }

      for (let y = 0; y < chunk.tiles.length; y++) {
        const wy = offsetY + y * tileSize;
        if (wy + tileSize < minVy || wy > maxVy) continue;

        for (let x = 0; x < chunk.tiles[y].length; x++) {
          const wx = offsetX + x * tileSize;
          if (wx + tileSize < minVx || wx > maxVx) continue;

          const tile = chunk.tiles[y][x];
          if (!tile.tileId.toLowerCase().includes('water') && !tile.tileId.toLowerCase().includes('river')) continue;

          const flowShift1 = (t * 24 + wx * 0.35) % tileSize;
          const flowShift2 = (t * 18 + wy * 0.25) % tileSize;

          this.waterFlowGraphics
            .moveTo(wx + 2, wy + flowShift1)
            .lineTo(wx + tileSize - 4, wy + ((flowShift1 + 4) % tileSize))
            .stroke({ color: 0xbae6fd, width: 1.2, alpha: 0.45 });

          if (!this.isLowPerformanceMode) {
            this.waterFlowGraphics
              .moveTo(wx + 4, wy + flowShift2)
              .lineTo(wx + tileSize - 2, wy + ((flowShift2 + 3) % tileSize))
              .stroke({ color: 0x7dd3fc, width: 0.9, alpha: 0.35 });

            const sparkPhase = Math.sin(t * 3.5 + x * 1.5 + y * 2.0);
            if (sparkPhase > 0.70) {
              const sx = wx + ((x * 11 + y * 7) % 24) + 4;
              const sy = wy + ((x * 13 + y * 5) % 24) + 4;
              this.waterFlowGraphics
                .circle(sx, sy, 1.2)
                .fill({ color: 0xffffff, alpha: (sparkPhase - 0.70) * 3.0 });
            }
          }
        }
      }
    }

    // プレイヤーが川に入っている時の足元波紋リング (Ripple)
    const surface = this.getSurfaceAt(this.playerState.x, this.playerState.y);
    if (surface === 'water') {
      const rippleR = 8 + (Math.sin(t * 6) + 1) * 5;
      const rippleAlpha = 0.6 - (rippleR - 8) / 14;
      this.waterFlowGraphics
        .ellipse(this.playerState.x, this.playerState.y, rippleR, rippleR * 0.45)
        .stroke({ color: 0xe0f2fe, width: 1.2, alpha: Math.max(0.1, rippleAlpha) });
    }
  }

  // 🏛️ 建物・街路樹の静的接地影：ワールド変更時・配置時のみ描画し毎フレーム走査を完全排除！
  public renderStaticShadows(world?: AirasWorldData, assets?: Record<string, AirasAsset>) {
    const w = world || this.currentWorld;
    const a = assets || this.currentAssets;
    if (!w || !a) return;
    this.staticShadowGraphics.clear();

    for (const ent of Object.values(w.entities)) {
      if (ent.id === this.playerState.drivingEntityId) continue;
      const asset = a[ent.assetId];
      if (!asset || asset.category === 'tile') continue;
      const ex = ent.position.x;
      const ey = ent.position.y;
      const sw = Math.min(48, Math.max(16, asset.sprite.width * 0.5));
      const sh = sw * 0.32;
      this.staticShadowGraphics
        .ellipse(ex, ey, sw, sh)
        .fill({ color: 0x020617, alpha: 0.32 });
    }
  }

  // 👤 プレイヤーの指向性投影影のみ毎フレーム描画（最寄り街灯のみ超高速参照・CPU負荷激減）
  private renderDynamicShadows() {
    if (!this.currentWorld) return;
    this.shadowGraphics.clear();

    const px = this.playerState.x;
    const py = this.playerState.y;

    if (this.playerState.isDriving) {
      const isHorizontal = this.playerState.direction === 'left' || this.playerState.direction === 'right';
      this.shadowGraphics
        .ellipse(px, py, isHorizontal ? 44 : 26, isHorizontal ? 10 : 16)
        .fill({ color: 0x000000, alpha: 0.5 });
      return;
    }

    const floorZ = this.getElevatedFloorZ(px, py);
    const airHeight = Math.max(0, this.playerState.z - floorZ);
    const shadowScale = Math.max(0.35, 1 - airHeight / 180);

    // 最寄りの街灯探索 (260px以内)
    let nearestLight: { x: number; y: number; dist: number } | null = null;
    let minDist = 260;

    for (const ent of Object.values(this.currentWorld.entities)) {
      if (ent.assetId.includes('lamp') || ent.assetId.includes('light') || ent.assetId.includes('vending')) {
        const d = Math.hypot(ent.position.x - px, ent.position.y - py);
        if (d < minDist) {
          minDist = d;
          nearestLight = { x: ent.position.x, y: ent.position.y, dist: d };
        }
      }
    }

    if (nearestLight) {
      const ldx = px - nearestLight.x;
      const ldy = py - nearestLight.y;
      const angle = Math.atan2(ldy, ldx);
      const distRatio = Math.min(1.0, nearestLight.dist / 220);
      const shadowLen = (14 + distRatio * 28) * shadowScale;
      const tipX = px + Math.cos(angle) * shadowLen;
      const tipY = py + Math.sin(angle) * shadowLen * 0.45;
      const shadowAlpha = Math.max(0.2, (1.0 - distRatio * 0.55)) * 0.55 * shadowScale;

      this.shadowGraphics
        .ellipse((px + tipX) / 2, (py + tipY) / 2, shadowLen * 0.55, 5 * shadowScale)
        .fill({ color: 0x050a14, alpha: shadowAlpha });
    } else {
      const envAngle = this.currentWeather === 'sunset' ? 0.65 : 0.4;
      const shadowLen = (this.currentWeather === 'sunset' ? 26 : 14) * shadowScale;
      const tipX = px + Math.cos(envAngle) * shadowLen;
      const tipY = py + Math.sin(envAngle) * shadowLen * 0.5;

      this.shadowGraphics
        .ellipse((px + tipX) / 2, (py + tipY) / 2, shadowLen * 0.55, 4.5 * shadowScale)
        .fill({ color: 0x050a14, alpha: 0.38 * shadowScale });
    }
  }

  // 💡 🌅 時間帯別環境光 ＆ 夜景ライティングの統合更新（差分時のみ再描画でCPU負荷ゼロ）
  private updateAmbientAndNightLighting() {
    const time = this.currentWorld?.environment.time ?? 12.0;
    const weather = this.currentWeather;

    // 0.01時間（約36秒）以上の変化、または天候変更時のみ再計算
    if (
      Math.abs(time - this.lastRenderedLightingTime) < 0.01 &&
      weather === this.lastRenderedLightingWeather
    ) {
      return;
    }

    this.lastRenderedLightingTime = time;
    this.lastRenderedLightingWeather = weather;

    // 1. 環境光（空の色・早朝/朝/昼/夕方/夜の空気感）を描画
    this.renderAmbientLighting(time, weather);

    // 2. 街灯・自販機・喫茶店・車の夜景環境光を描画
    this.renderStaticLighting(this.currentWorld || undefined);
  }

  // 🌅 時間帯に応じた環境色オーバーレイ（早朝・朝・昼・夕方・夜：透明感重視でドット絵を一切邪魔しない）
  private renderAmbientLighting(time: number, weather: WeatherType) {
    this.ambientLightingGraphics.clear();

    const bgX = -3000;
    const bgY = -3000;
    const bgW = 9000;
    const bgH = 9000;

    let baseColor = 0x000000;
    let baseAlpha = 0;

    if (weather === 'sunset') {
      // 夕焼け天候: 柔らかな琥珀ゴールド
      baseColor = 0xd97706;
      baseAlpha = 0.08;
    } else if (time >= 4.5 && time < 7.0) {
      // 🌄 早朝 (4:30〜7:00): 澄んだ清涼感のある薄青紫
      baseColor = 0x4338ca;
      baseAlpha = 0.08;
    } else if (time >= 7.0 && time < 11.0) {
      // ☀️ 朝 (7:00〜11:00): 爽やかな朝の淡い黄金光
      baseColor = 0xfef08a;
      baseAlpha = 0.03;
    } else if (time >= 11.0 && time < 16.5) {
      // 🌤️ 昼 (11:00〜16:30): 自然光 (透明)
      baseAlpha = 0;
    } else if (time >= 16.5 && time < 19.0) {
      // 🌇 夕方 (16:30〜19:00): オブジェクトがはっきり見える温かい琥珀色（濁りを完全排除）
      baseColor = 0xd97706;
      baseAlpha = 0.07;
    } else {
      // 🌙 夜 (19:00〜4:30): しっとりとした静寂とロマンチックなムードの夜空
      // 時間帯によって宵の口から真夜中、夜明け前へと自然に暗さが変化
      baseColor = 0x070c1b; // 深みのある澄んだミッドナイトインディゴ
      if (time >= 19.0 && time < 21.0) {
        // 宵の口 (19:00〜21:00): 0.25 〜 0.52 へ徐々に深まる
        const progress = (time - 19.0) / 2.0;
        baseAlpha = 0.25 + progress * 0.27;
      } else if (time >= 21.0 || time < 3.5) {
        // 真夜中 (21:00〜3:30): 静けさとロマンチックなムードが漂う深みのある夜空
        // ドット絵がくっきり見えつつ、街灯やネオンが最高に美しく映える黄金比率
        baseAlpha = 0.52;
      } else {
        // 明け方前 (3:30〜4:30): 0.52 から 0.20 へ徐々に明るくなる
        const progress = (time - 3.5) / 1.0;
        baseAlpha = 0.52 - progress * 0.32;
      }
    }

    // 悪天候による微補正（暗すぎないよう調整）
    if (weather === 'rain') {
      baseAlpha = Math.min(0.35, baseAlpha + 0.08);
      baseColor = 0x1e293b;
    } else if (weather === 'heavy_rain' || weather === 'typhoon') {
      baseAlpha = Math.min(0.48, baseAlpha + 0.14);
      baseColor = 0x0f172a;
    } else if (weather === 'fog') {
      baseAlpha = Math.min(0.25, baseAlpha + 0.06);
      baseColor = 0x64748b;
    }

    if (baseAlpha > 0.005) {
      this.ambientLightingGraphics
        .rect(bgX, bgY, bgW, bgH)
        .fill({ color: baseColor, alpha: baseAlpha });
    }
  }

  // 💡 街灯・自販機・喫茶店の夜景環境光：ふんわりと足元を照らす上品なムードライティング
  public renderStaticLighting(world?: AirasWorldData) {
    const w = world || this.currentWorld;
    if (!w) return;
    this.staticLightingGraphics.clear();

    const time = w.environment.time ?? 12.0;
    const weather = this.currentWeather;
    const isNight = time >= 17.5 || time < 6.0;
    const isDarkWeather = weather === 'sunset' || weather === 'rain' || weather === 'heavy_rain' || weather === 'typhoon';

    if (!isNight && !isDarkWeather) return;

    for (const ent of Object.values(w.entities)) {
      const assetId = ent.assetId.toLowerCase();

      // 1. 街灯：電球の温かい光 ＆ 足元の柔らかな3段照り返しグラデーション
      if (assetId.includes('lamp') || assetId.includes('light')) {
        const lx = ent.position.x;
        const ly = ent.position.y - 18;

        // 電球部分の温光（中心は明るく、外側へ滑らかにフェード）
        this.staticLightingGraphics
          .circle(lx, ly, 6).fill({ color: 0xfffbeb, alpha: 0.55 })
          .circle(lx, ly, 14).fill({ color: 0xfef08a, alpha: 0.28 })
          .circle(lx, ly, 28).fill({ color: 0xf59e0b, alpha: 0.12 })
          .circle(lx, ly, 46).fill({ color: 0xd97706, alpha: 0.03 });

        // 足元の地面への照り返し（夜の街灯の下に立っている感覚を演出）
        const groundY = ent.position.y + 12;
        this.staticLightingGraphics
          .ellipse(lx, groundY, 24, 10).fill({ color: 0xfef08a, alpha: 0.18 })
          .ellipse(lx, groundY, 44, 18).fill({ color: 0xf59e0b, alpha: 0.07 })
          .ellipse(lx, groundY, 64, 26).fill({ color: 0xd97706, alpha: 0.02 });
      }
      // 2. 🥤 自販機 (vending): 夜道に浮かぶクールでエモい電光パネルの明かり
      else if (assetId.includes('vending')) {
        const vx = ent.position.x;
        const vy = ent.position.y + 12;
        this.staticLightingGraphics
          .ellipse(vx, vy, 20, 9).fill({ color: 0xbae6fd, alpha: 0.15 })
          .ellipse(vx, vy, 36, 16).fill({ color: 0x38bdf8, alpha: 0.05 });
      }
      // 3. ☕ 喫茶店・カフェ・住宅: 窓辺から漏れる温もりあるオレンジ光
      else if (assetId.includes('cafe') || assetId.includes('coffee') || assetId.includes('house') || assetId.includes('shop')) {
        const hx = ent.position.x;
        const hy = ent.position.y + 16;
        this.staticLightingGraphics
          .ellipse(hx, hy, 32, 14).fill({ color: 0xfef08a, alpha: 0.13 })
          .ellipse(hx, hy, 52, 22).fill({ color: 0xf59e0b, alpha: 0.05 });
      }
    }
  }

  // 💡 動的ライティング（夜間の車両ヘッドライト等）
  private renderLighting() {
    this.lightingGraphics.clear();

    const time = this.currentWorld?.environment.time ?? 12.0;
    const isNight = time >= 17.5 || time < 6.0;
    if (!isNight) return;

    // 🚗 車両乗車時のリアルなヘッドライト照射
    if (this.playerState.isDriving) {
      const px = this.playerState.x;
      const py = this.playerState.y;
      const dir = this.playerState.direction;

      let offsetX = 0;
      let offsetY = 0;
      let radiusX = 35;
      let radiusY = 20;

      if (dir === 'down' || dir === 'down-left' || dir === 'down-right') {
        offsetX = 0;
        offsetY = 36;
        radiusX = 38;
        radiusY = 22;
      } else if (dir === 'up' || dir === 'up-left' || dir === 'up-right') {
        offsetX = 0;
        offsetY = -34;
        radiusX = 38;
        radiusY = 20;
      } else if (dir === 'right') {
        offsetX = 45;
        offsetY = 2;
        radiusX = 46;
        radiusY = 22;
      } else if (dir === 'left') {
        offsetX = -45;
        offsetY = 2;
        radiusX = 46;
        radiusY = 22;
      }

      const hx = px + offsetX;
      const hy = py + offsetY;

      // ヘッドライトの柔らかいビーム照射
      this.lightingGraphics
        .ellipse(hx, hy, radiusX * 0.5, radiusY * 0.5).fill({ color: 0xfffbeb, alpha: 0.28 })
        .ellipse(hx, hy, radiusX, radiusY).fill({ color: 0xfef08a, alpha: 0.14 })
        .ellipse(hx, hy, radiusX * 1.4, radiusY * 1.3).fill({ color: 0xf59e0b, alpha: 0.04 });
    }
  }

  // ⚡ 落雷ホワイトフラッシュの更新
  public triggerThunderFlash() {
    this.thunderFlashTimer = 0.40;
    audioManager.playThunder(false);
  }

  private updateThunderFlash(dt: number) {
    this.thunderFlashGraphics.clear();
    if (this.thunderFlashTimer <= 0) return;

    this.thunderFlashTimer -= dt;
    const alpha = Math.min(0.85, this.thunderFlashTimer * 2.5);

    // 画面全体を覆う強烈な落雷閃光
    this.thunderFlashGraphics
      .rect(-2000, -2000, 6000, 6000)
      .fill({ color: 0xffffff, alpha });
  }

  // 🌧️ 天候レンダリング（雨・大雨・台風・雪・落雷）
  private renderWeather(weather: WeatherType, dt: number = 0.016) {
    if (weather === 'clear') {
      if (this.lastRenderedWeather !== 'clear') {
        this.weatherGraphics.clear();
        this.lastRenderedWeather = 'clear';
      }
      return;
    }

    if (weather === 'sunset') {
      if (this.lastRenderedWeather !== 'sunset') {
        this.weatherGraphics.clear();
        this.weatherGraphics
          .rect(-2000, -2000, 6000, 6000)
          .fill({ color: 0xf97316, alpha: 0.16 });
        this.lastRenderedWeather = 'sunset';
      }
      return;
    }

    this.lastRenderedWeather = weather;
    this.weatherGraphics.clear();

    const particles = this.isLowPerformanceMode
      ? this.weatherParticles.slice(0, 45)
      : this.weatherParticles;

    if (weather === 'rain') {
      // しとしと雨
      for (const p of particles) {
        p.y += p.speed;
        p.x -= p.speed * 0.25;
        if (p.y > 1200) p.y = -50;
        if (p.x < -300) p.x = 2400;

        this.weatherGraphics
          .moveTo(p.x, p.y)
          .lineTo(p.x - 3, p.y + p.length)
          .stroke({ color: 0x93c5fd, width: 1.4, alpha: 0.55 });
      }
    } else if (weather === 'heavy_rain') {
      // ⛈️ 大雨（激しい雨足）
      this.weatherGraphics
        .rect(-2000, -2000, 6000, 6000)
        .fill({ color: 0x0f172a, alpha: 0.22 }); // 薄暗い雨空

      for (const p of particles) {
        p.y += p.speed * 1.55;
        p.x -= p.speed * 0.65;
        if (p.y > 1200) p.y = -50;
        if (p.x < -300) p.x = 2400;

        this.weatherGraphics
          .moveTo(p.x, p.y)
          .lineTo(p.x - 7, p.y + p.length * 1.5)
          .stroke({ color: 0xa5b4fc, width: 2.0, alpha: 0.72 });
      }
    } else if (weather === 'typhoon') {
      // 🌀 台風（暴風・超大雨・突風・落雷）
      this.weatherGraphics
        .rect(-2000, -2000, 6000, 6000)
        .fill({ color: 0x030712, alpha: 0.42 }); // 荒れ狂う暗黒空

      // 台風時の不定期落雷フラッシュトリガー（毎秒約1.5%確率）
      if (Math.random() < 0.008) {
        this.triggerThunderFlash();
      }

      for (const p of particles) {
        p.y += p.speed * 1.85;
        p.x -= p.speed * 1.45; // 強烈な横殴りの風
        if (p.y > 1200) p.y = -50;
        if (p.x < -300) p.x = 2400;

        this.weatherGraphics
          .moveTo(p.x, p.y)
          .lineTo(p.x - 14, p.y + p.length * 1.8)
          .stroke({ color: 0xc7d2fe, width: 2.4, alpha: 0.85 });
      }

      // 唸る風のうねりライン
      const windY1 = (this.waterAnimationTime * 180) % 1000;
      this.weatherGraphics
        .moveTo(2200, windY1)
        .lineTo(-200, windY1 + 120)
        .stroke({ color: 0xffffff, width: 1.5, alpha: 0.22 });
    } else if (weather === 'snow') {
      for (const p of particles) {
        p.y += p.speed * 0.4;
        p.x += Math.sin(p.y * 0.05) * 0.8;
        if (p.y > 1200) p.y = -50;
        if (p.x < -300) p.x = 2400;

        this.weatherGraphics
          .circle(p.x, p.y, 2)
          .fill({ color: 0xffffff, alpha: 0.75 });
      }
    }
  }

  // 🎯 画面座標 (screenX, screenY) にあるオブジェクト（エンティティ）を取得
  public getEntityAtScreen(screenX: number, screenY: number): string | null {
    if (!this.app || !this.app.renderer) return null;
    for (const [id, sprite] of Array.from(this.entitySprites.entries()).reverse()) {
      if (id.startsWith('__ghost_') || id === 'player_main' || id.startsWith('remote_player_')) continue;
      const bounds = sprite.getBounds();
      if (
        screenX >= bounds.x &&
        screenX <= bounds.x + bounds.width &&
        screenY >= bounds.y &&
        screenY <= bounds.y + bounds.height
      ) {
        return id;
      }
    }
    return null;
  }

  // 移動キーとダッシュキーの全解除
  public clearDirectionKeys(): void {
    this.keys['KeyW'] = false;
    this.keys['KeyS'] = false;
    this.keys['KeyA'] = false;
    this.keys['KeyD'] = false;
    this.keys['ControlLeft'] = false;
    this.keys['ControlRight'] = false;
    this.keys['Control'] = false;
  }

  private setupInteractions(canvas: HTMLCanvasElement) {
    let pointerDownPos = { x: 0, y: 0 };
    let hasMovedSignificantly = false;

    // 📦 オブジェクトドラッグ終了＆確定共通関数
    const finishEntityDrag = (e?: PointerEvent | MouseEvent) => {
      if (!this.draggingEntityId) return;
      const draggedId = this.draggingEntityId;
      const sprite = this.entitySprites.get(draggedId);
      const startDir = this.dragStartEntityDirection;
      const endDir = this.currentDraggingDirection;

      if (e && 'pointerId' in e) {
        try {
          if (canvas.hasPointerCapture(e.pointerId)) {
            canvas.releasePointerCapture(e.pointerId);
          }
        } catch {}
      }

      if (!hasMovedSignificantly && startDir === endDir && (!e || ('button' in e && e.button === 0))) {
        // 動かさずに向きも変えずにタップしただけなら選択 / インタラクション
        this.onEntityClick?.(draggedId);
      } else if (this.dragStartEntityPos && sprite) {
        // 移動または向き変更が行われた場合は開始位置から最終位置への単一コミットを発行（1 Undo化）
        const startPos = this.dragStartEntityPos;
        const endPos = { x: Math.round(sprite.x), y: Math.round(sprite.y) };
        if (startPos.x !== endPos.x || startPos.y !== endPos.y || startDir !== endDir) {
          this.onEntityDragEnd?.(draggedId, startPos, endPos, startDir, endDir);
        }
      }
      this.draggingEntityId = null;
      this.dragPointerId = null;
      this.dragStartEntityPos = null;
    };

    canvas.addEventListener('pointerdown', (e: PointerEvent) => {
      // 確実なキーボード入力受付のためCanvasにフォーカス
      canvas.focus();

      pointerDownPos = { x: e.clientX, y: e.clientY };
      hasMovedSignificantly = false;

      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const worldPos = this.screenToWorld(screenX, screenY);

      // 0. 🔄 すでにオブジェクトを掴んでいる最中に、別のクリックやタップが発生した場合:
      if (this.draggingEntityId) {
        // 右クリック: マウスでの時計回り回転
        if (e.button === 2) {
          this.rotateDraggedEntity('cw');
          hasMovedSignificantly = true;
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        // マルチタッチまたは別ポインタでの画面タップ回転:
        // 画面右側タップは左回転 (ccw)、画面左側タップは右回転 (cw)！
        if (this.dragPointerId === null || e.pointerId !== this.dragPointerId) {
          const isRightSide = e.clientX >= window.innerWidth / 2;
          this.rotateDraggedEntity(isRightSide ? 'ccw' : 'cw');
          hasMovedSignificantly = true;
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      // 右クリック: マインクラフト準拠インタラクション (乗車・就寝・会話など)
      if (e.button === 2) {
        const hitId = this.getEntityAtScreen(screenX, screenY);
        if (hitId) {
          this.onEntityRightClick?.(hitId);
          return;
        }

        this.isDraggingCamera = true;
        this.lastMousePos = { x: e.clientX, y: e.clientY };
        return;
      }

      // 中クリック or Altキー: カメラパン
      if (e.button === 1 || e.altKey) {
        this.isDraggingCamera = true;
        this.lastMousePos = { x: e.clientX, y: e.clientY };
        return;
      }

      // 1. 編集モード（!this.isPlayMode）の場合のみ、オブジェクト判定とドラッグを有効化
      // 探索モード（this.isPlayMode）の時はオブジェクトを掴まず、オブジェクト上からでもスムーズにスワイプ移動できる
      if (!this.isPlayMode) {
        const hitId = this.getEntityAtScreen(screenX, screenY);
        if (hitId) {
          this.draggingEntityId = hitId;
          this.dragPointerId = e.pointerId;
          try {
            canvas.setPointerCapture(e.pointerId);
          } catch {
            // pointer capture not supported or invalid pointer
          }
          const targetEntity = this.currentWorld?.entities[hitId];
          this.dragStartEntityDirection = targetEntity?.direction || 'down';
          this.currentDraggingDirection = this.dragStartEntityDirection;

          const sprite = this.entitySprites.get(hitId)!;
          this.dragOffset = {
            x: worldPos.x - sprite.x,
            y: worldPos.y - sprite.y,
          };
          this.dragStartEntityPos = { x: sprite.x, y: sprite.y };
          return;
        }
      }

      // 2. オブジェクト以外の地面・空間（または探索モード中のオブジェクト上）:
      if (e.pointerType === 'touch') {
        // 🏃💨 タッチ端末での全画面スワイプ移動開始（画面のどこからでもスワイプ可能）
        this.isSwipingMovement = true;
        this.swipePointerId = e.pointerId;
        this.swipeStartPos = { x: e.clientX, y: e.clientY };
        const now = performance.now();
        this.swipeStartTime = now;
        this.swipeRecentPoints = [{ x: e.clientX, y: e.clientY, t: now }];
        this.swipeActiveTier = 'walk';
        this.playerMoveTier = 'walk';
        return;
      }

      // マウス操作時の地面ドラッグ: カメラパン
      this.isDraggingCamera = true;
      this.lastMousePos = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('pointermove', (e: PointerEvent) => {
      const dxTotal = Math.abs(e.clientX - pointerDownPos.x);
      const dyTotal = Math.abs(e.clientY - pointerDownPos.y);
      if (dxTotal > 4 || dyTotal > 4) {
        hasMovedSignificantly = true;
      }

      // 1. カメラドラッグ (マウス)
      if (this.isDraggingCamera) {
        const deltaX = e.clientX - this.lastMousePos.x;
        const deltaY = e.clientY - this.lastMousePos.y;
        this.panCamera(deltaX, deltaY);
        this.lastMousePos = { x: e.clientX, y: e.clientY };
        return;
      }

      // 2. オブジェクトドラッグ (編集モード時: 画面のどこにあるオブジェクトでも自由にドラッグ移動！)
      if (this.draggingEntityId) {
        // マウス操作時、左クリック(1)が押されていなければゴーストドラッグを即座に強制解除
        if (e.pointerType === 'mouse' && (e.buttons & 1) === 0) {
          finishEntityDrag(e);
          return;
        }

        if (this.dragPointerId === null || this.dragPointerId === e.pointerId) {
          const rect = canvas.getBoundingClientRect();
          const screenX = e.clientX - rect.left;
          const screenY = e.clientY - rect.top;
          const worldPos = this.screenToWorld(screenX, screenY);

          const rawX = worldPos.x - this.dragOffset.x;
          const rawY = worldPos.y - this.dragOffset.y;

          let newX = Math.round(rawX);
          let newY = Math.round(rawY);

          // 🧲 グリッド吸着（マス吸着ON時は32px単位にスナップ）
          if (this.isSnapToGrid) {
            const tileSize = 32;
            newX = Math.round(rawX / tileSize) * tileSize;
            newY = Math.round(rawY / tileSize) * tileSize;
          }

          const sprite = this.entitySprites.get(this.draggingEntityId);
          if (sprite) {
            sprite.x = newX;
            sprite.y = newY;
            (sprite as any).worldFootY = newY;
          }
          this.onEntityDrag?.(this.draggingEntityId, newX, newY, this.currentDraggingDirection);
          return;
        }
      }

      // 3. 全画面スワイプ移動 (オブジェクトやボタン以外の画面どこからでもスワイプ移動！)
      if (this.isSwipingMovement && (this.swipePointerId === null || this.swipePointerId === e.pointerId)) {
        let deltaX = e.clientX - this.swipeStartPos.x;
        let deltaY = e.clientY - this.swipeStartPos.y;
        let dist = Math.hypot(deltaX, deltaY);

        // 🎯 動的アンカー追従 (Follow Drag / Dynamic Floating Anchor):
        // 指がアンカー（swipeStartPos）から遠く離れすぎないよう、最大半径（75px）でアンカーを指に追従させる！
        // これにより、指が画面右端まで行っても、少し上や左に戻すだけで即座に方向転換が可能になる！
        const maxRadius = 75;
        if (dist > maxRadius) {
          const excess = dist - maxRadius;
          const dirX = deltaX / dist;
          const dirY = deltaY / dist;
          this.swipeStartPos.x += dirX * excess;
          this.swipeStartPos.y += dirY * excess;
          deltaX = e.clientX - this.swipeStartPos.x;
          deltaY = e.clientY - this.swipeStartPos.y;
          dist = maxRadius;
        }

        const now = performance.now();
        this.swipeRecentPoints.push({ x: e.clientX, y: e.clientY, t: now });
        while (this.swipeRecentPoints.length > 1 && now - this.swipeRecentPoints[0].t > 150) {
          this.swipeRecentPoints.shift();
        }

        const oldestPoint = this.swipeRecentPoints[0];
        const pointDt = Math.max(1, now - oldestPoint.t);
        const pointDist = Math.hypot(e.clientX - oldestPoint.x, e.clientY - oldestPoint.y);
        const recentVelocity = pointDist / pointDt; // px / ms

        // デッドゾーン (6px) 未満は停止
        if (dist < 6) {
          this.swipeDist = 0;
          this.swipeAnalogDir = { x: 0, y: 0 };
          this.clearDirectionKeys();
          return;
        }

        // 速度と移動距離によるティア昇格:
        // ・素早くスワイプ (> 0.40 px/ms) ➜ 小走り (jog)
        // ・勢いよく素早くスワイプ (> 0.65 px/ms) または開始直後のフリック ➜ ダッシュ (dash)
        // ⚠️ 一度ダッシュ (dash) や小走り (jog) になったら、旋回中も指を画面から離さない限りティアを絶対に維持！
        const isFastSwipe = recentVelocity > 0.40 || (now - this.swipeStartTime < 300 && dist >= 25);
        const isVeryFastSwipe = recentVelocity > 0.65 || (now - this.swipeStartTime < 250 && dist >= 40);

        if (this.swipeActiveTier === 'walk') {
          if (isVeryFastSwipe) {
            this.swipeActiveTier = 'dash';
          } else if (isFastSwipe) {
            this.swipeActiveTier = 'jog';
          }
        } else if (this.swipeActiveTier === 'jog') {
          if (isVeryFastSwipe) {
            this.swipeActiveTier = 'dash';
          }
        }
        // dash の時は絶対にティアを落とさない！

        this.playerMoveTier = this.swipeActiveTier;

        // 360度シームレスなアナログ方向ベクトルを保存 (物理演算で大回り旋回に使用)
        const analogDirX = deltaX / dist;
        const analogDirY = deltaY / dist;
        this.swipeDist = dist;
        this.swipeAnalogDir = { x: analogDirX, y: analogDirY };

        // 8方向判定 (-180° 〜 180°) キーフォールバック
        const angle = Math.atan2(deltaY, deltaX);
        const deg = (angle * 180) / Math.PI;

        const isRight = deg >= -67.5 && deg <= 67.5;
        const isLeft = deg >= 112.5 || deg <= -112.5;
        const isDown = deg >= 22.5 && deg <= 157.5;
        const isUp = deg <= -22.5 && deg >= -157.5;

        this.keys['KeyD'] = isRight;
        this.keys['KeyA'] = isLeft;
        this.keys['KeyS'] = isDown;
        this.keys['KeyW'] = isUp;
        return;
      }
    });

    const handlePointerUp = (e: PointerEvent) => {
      // 🏃💨 スワイプ移動終了処理
      if (this.isSwipingMovement && (this.swipePointerId === null || this.swipePointerId === e.pointerId)) {
        this.isSwipingMovement = false;
        this.swipePointerId = null;
        this.swipeRecentPoints = [];
        this.swipeActiveTier = 'walk';
        this.playerMoveTier = 'walk';
        this.swipeDist = 0;
        this.swipeAnalogDir = { x: 0, y: 0 };
        this.isMoveAngleInitialized = false;
        this.clearDirectionKeys();

        // タップ時の処理（クリック自動歩行 targetMovePos は完全廃止）
        if (!hasMovedSignificantly && e.button === 0) {
          const rect = canvas.getBoundingClientRect();
          const screenX = e.clientX - rect.left;
          const screenY = e.clientY - rect.top;
          const worldPos = this.screenToWorld(screenX, screenY);
          this.onMapClick?.(worldPos.x, worldPos.y);
        }
      }

      // 📦 オブジェクト操作終了処理
      // ⚠️ マルチタッチ保護: オブジェクトを掴んだ特定のポインタ（指・マウスクリック）が離されるまで絶対に離さない！
      // 別の指で画面をタップして離しても、掴んでいる指を離すまで維持する！
      if (this.draggingEntityId) {
        if (e.pointerType === 'mouse') {
          // マウスの場合: 左クリック（0）が離された場合、またはどのボタンも押されていない場合のみ終了
          if (e.button === 0 || (e.buttons & 1) === 0) {
            finishEntityDrag(e);
          }
        } else {
          // タッチの場合: 掴んだ指（dragPointerId）そのものが離された時のみ終了！
          if (this.dragPointerId !== null && e.pointerId === this.dragPointerId) {
            finishEntityDrag(e);
          }
        }
      }

      // 📷 カメラドラッグ終了処理
      if (this.isDraggingCamera) {
        if (!hasMovedSignificantly && e.button === 0 && e.pointerType === 'mouse') {
          const rect = canvas.getBoundingClientRect();
          const screenX = e.clientX - rect.left;
          const screenY = e.clientY - rect.top;
          const worldPos = this.screenToWorld(screenX, screenY);
          this.onMapClick?.(worldPos.x, worldPos.y);
        }
        this.isDraggingCamera = false;
      }
    };

    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', (e: PointerEvent) => {
      // 掴んでいる指以外のポインタのキャンセルは完全無視！
      if (this.draggingEntityId && this.dragPointerId !== null && e.pointerId === this.dragPointerId) {
        finishEntityDrag(e);
      }
      if (this.isSwipingMovement && this.swipePointerId !== null && e.pointerId === this.swipePointerId) {
        handlePointerUp(e);
      }
    });

    window.addEventListener('mouseup', (e: MouseEvent) => {
      // マウスの左ボタンが離されたとき、ドラッグ中なら確実に終了
      if (e.button === 0 && this.draggingEntityId) {
        finishEntityDrag(e);
      }
    });

    window.addEventListener('blur', () => {
      // ウィンドウフォーカスが外れた場合、安全のため全ドラッグ/スワイプ状態を解除
      if (this.draggingEntityId) {
        finishEntityDrag();
      }
      this.isSwipingMovement = false;
      this.isDraggingCamera = false;
      this.clearDirectionKeys();
    });

    window.addEventListener('touchend', (e: TouchEvent) => {
      // 画面上の全指が離された場合、ドラッグ状態が残っていれば確実に終了
      if (e.touches.length === 0 && this.draggingEntityId) {
        finishEntityDrag();
      }
    });

    canvas.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        e.preventDefault();
        // 🔄 オブジェクトドラッグ中のホイール回転: 下スクロールで時計回り、上スクロールで反時計回り
        if (this.draggingEntityId) {
          const dir = e.deltaY > 0 ? 'cw' : 'ccw';
          this.rotateDraggedEntity(dir);
          hasMovedSignificantly = true;
          return;
        }

        const rect = canvas.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const delta = e.deltaY < 0 ? 0.12 : -0.12;
        this.zoomCamera(delta, cx, cy);
      },
      { passive: false }
    );

    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      // 🔄 オブジェクトドラッグ中の右クリック: 時計回り回転
      if (this.draggingEntityId) {
        this.rotateDraggedEntity('cw');
        hasMovedSignificantly = true;
      }
    });

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (this.draggingEntityId) {
        if (e.code === 'KeyR' || e.code === 'KeyE') {
          e.preventDefault();
          this.rotateDraggedEntity('cw');
          hasMovedSignificantly = true;
        } else if (e.code === 'KeyQ') {
          e.preventDefault();
          this.rotateDraggedEntity('ccw');
          hasMovedSignificantly = true;
        }
      }
    });
  }

  // 🔄 ドラッグ中オブジェクトの回転 (cw: 時計回り, ccw: 反時計回り)
  public rotateDraggedEntity(directionType: 'cw' | 'ccw' = 'cw') {
    if (!this.draggingEntityId) return;
    const currentDir = this.currentDraggingDirection || 'down';
    const currentIndex = ROTATION_DIRECTIONS.indexOf(currentDir);
    const validIndex = currentIndex >= 0 ? currentIndex : 0;

    let nextIndex: number;
    if (directionType === 'cw') {
      nextIndex = (validIndex + 1) % ROTATION_DIRECTIONS.length;
    } else {
      nextIndex = (validIndex - 1 + ROTATION_DIRECTIONS.length) % ROTATION_DIRECTIONS.length;
    }

    const newDir = ROTATION_DIRECTIONS[nextIndex];
    this.currentDraggingDirection = newDir;

    // スプライトの向きテクスチャを即時更新
    const entity = this.currentWorld?.entities[this.draggingEntityId];
    const asset = this.currentAssets?.[entity?.assetId || ''];
    const sprite = this.entitySprites.get(this.draggingEntityId);
    if (asset && sprite) {
      this.updateEntitySprite(
        this.draggingEntityId,
        asset,
        sprite.x,
        sprite.y,
        0,
        1.0,
        false,
        newDir
      );
    }

    // 軽やかな設置音・回転フィードバック
    audioManager.playPlace();

    // コールバック通知
    this.onEntityRotate?.(this.draggingEntityId, newDir);
  }

  // 🔄 任意のエンティティの回転（UIボタン等からの呼び出し用）
  public rotateEntity(entityId: string, directionType: 'cw' | 'ccw' = 'cw'): Direction | null {
    const entity = this.currentWorld?.entities[entityId];
    if (!entity) return null;
    const currentDir = entity.direction || 'down';
    const currentIndex = ROTATION_DIRECTIONS.indexOf(currentDir);
    const validIndex = currentIndex >= 0 ? currentIndex : 0;

    let nextIndex: number;
    if (directionType === 'cw') {
      nextIndex = (validIndex + 1) % ROTATION_DIRECTIONS.length;
    } else {
      nextIndex = (validIndex - 1 + ROTATION_DIRECTIONS.length) % ROTATION_DIRECTIONS.length;
    }

    const newDir = ROTATION_DIRECTIONS[nextIndex];
    entity.direction = newDir;

    const asset = this.currentAssets?.[entity.assetId];
    const sprite = this.entitySprites.get(entityId);
    if (asset && sprite) {
      this.updateEntitySprite(
        entityId,
        asset,
        sprite.x,
        sprite.y,
        0,
        1.0,
        false,
        newDir
      );
    }

    audioManager.playPlace();
    this.onEntityRotate?.(entityId, newDir);
    return newDir;
  }

  // 🔄 任意のエンティティの向きを直接設定（UIボタン等からの呼び出し用）
  public setEntityDirection(entityId: string, newDir: Direction): void {
    const entity = this.currentWorld?.entities[entityId];
    if (!entity) return;
    entity.direction = newDir;

    const asset = this.currentAssets?.[entity.assetId];
    const sprite = this.entitySprites.get(entityId);
    if (asset && sprite) {
      this.updateEntitySprite(
        entityId,
        asset,
        sprite.x,
        sprite.y,
        0,
        1.0,
        false,
        newDir
      );
    }
    audioManager.playPlace();
  }

  destroy(): void {
    if (this.app) {
      this.app.destroy(true, { children: true, texture: false });
      this.app = null;
    }
  }
}
