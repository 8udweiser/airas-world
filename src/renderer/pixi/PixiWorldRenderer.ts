import { Application, Container, Sprite, Graphics, Assets, Texture } from 'pixi.js';
import { AirasWorldData, WeatherType } from '../../core/types/world';
import { AirasAsset } from '../../core/types/asset';
import { IRenderer, RendererGhostEntity } from '../IRenderer';

export class PixiWorldRenderer implements IRenderer {
  private app: Application | null = null;
  private container: HTMLElement | null = null;
  
  // シーン階層
  private stageContainer: Container = new Container();
  private groundBgGraphics: Graphics = new Graphics();
  private tileContainer: Container = new Container();
  private shadowGraphics: Graphics = new Graphics();
  private selectionGraphics: Graphics = new Graphics();
  private depthContainer: Container = new Container();
  private particleGraphics: Graphics = new Graphics();
  private weatherGraphics: Graphics = new Graphics();

  // キャッシュ
  private entitySprites: Map<string, Sprite> = new Map();
  private textureCache: Map<string, Texture> = new Map();

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
    direction: 'down' as 'down' | 'up' | 'left' | 'right',
    isMoving: false,
    isJumping: false,
    isSprinting: false,
    isSneaking: false,
    assetId: 'character_schoolgirl',
  };

  // 入力キー状態
  public keys: { [key: string]: boolean } = {};

  // 操作モード
  public isPlayMode: boolean = true; // デフォルトは快適な探索モード

  // ドラッグ操作ステート
  private isDraggingCamera: boolean = false;
  private lastMousePos: { x: number; y: number } = { x: 0, y: 0 };
  private draggingEntityId: string | null = null;
  private dragOffset: { x: number; y: number } = { x: 0, y: 0 };

  // コールバック
  public onEntityClick?: (entityId: string) => void;
  public onEntityRightClick?: (entityId: string) => void;
  public onMapClick?: (worldX: number, worldY: number) => void;
  public onEntityDrag?: (entityId: string, newWorldX: number, newWorldY: number) => void;
  public onPlayerMoveTick?: (x: number, y: number, z: number, dir: string, fps: number) => void;

  // パーティクル & アニメーション
  private weatherParticles: Array<{ x: number; y: number; speed: number; length: number }> = [];
  private dustParticles: Array<{ x: number; y: number; vx: number; vy: number; life: number }> = [];
  private walkAnimTimer: number = 0;
  private currentWeather: WeatherType = 'sunset';

  async init(container: HTMLElement): Promise<void> {
    this.container = container;
    const app = new Application();
    
    await app.init({
      resizeTo: container,
      backgroundColor: 0x0f172a, // 深いレトロナイトブルー
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      antialias: false,
    });

    this.app = app;
    container.appendChild(app.canvas);

    // シーン階層の構築
    this.app.stage.addChild(this.stageContainer);
    this.stageContainer.addChild(this.groundBgGraphics); // 広大な背景
    this.stageContainer.addChild(this.tileContainer);
    this.stageContainer.addChild(this.shadowGraphics); // 接地影
    this.stageContainer.addChild(this.selectionGraphics);
    this.stageContainer.addChild(this.depthContainer); // Yソート
    this.stageContainer.addChild(this.particleGraphics); // ダッシュ土煙
    this.stageContainer.addChild(this.weatherGraphics);

    this.setupInteractions(app.canvas);
    this.centerCamera();

    // 天候パーティクル初期化 (100個に抑えて低スペックでも爆速)
    for (let i = 0; i < 90; i++) {
      this.weatherParticles.push({
        x: Math.random() * 2400 - 400,
        y: Math.random() * 1400 - 200,
        speed: 6 + Math.random() * 6,
        length: 12 + Math.random() * 10,
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

      // 1. プレイヤー物理 & 移動演算 (探索モード時)
      if (this.isPlayMode) {
        this.updatePlayerPhysics(dt);
      }

      // 2. カメラ追従
      if (this.isPlayMode && !this.isDraggingCamera) {
        this.followPlayer(this.playerState.x, this.playerState.y, 0.12);
      }

      // 3. 2.5D 深度ソート
      this.depthContainer.children.sort((a, b) => (a as any).worldFootY - (b as any).worldFootY);

      // 4. パーティクル & 天候アニメーション
      this.updateDustParticles(dt);
      this.renderWeather(this.currentWeather);

      // 5. 低頻度でReactへ座標通知 (毎フレーム再レンダリングさせない)
      this.onPlayerMoveTick?.(
        this.playerState.x,
        this.playerState.y,
        this.playerState.z,
        this.playerState.direction,
        currentFps
      );
    });
  }

  // キー入力に応じたプレイヤー物理演算
  private updatePlayerPhysics(dt: number) {
    const k = this.keys;
    // WASD と 矢印キー
    const isUp = Boolean(k['KeyW'] || k['ArrowUp'] || k['w'] || k['W']);
    const isDown = Boolean(k['KeyS'] || k['ArrowDown'] || k['s'] || k['S']);
    const isLeft = Boolean(k['KeyA'] || k['ArrowLeft'] || k['a'] || k['A']);
    const isRight = Boolean(k['KeyD'] || k['ArrowRight'] || k['d'] || k['D']);
    const isSprint = Boolean(k['ControlLeft'] || k['ControlRight'] || k['Control']);
    const isSneak = Boolean(k['ShiftLeft'] || k['ShiftRight'] || k['Shift']);
    const isJump = Boolean(k['Space'] || k[' ']);

    // 方向ベクトル
    let dx = 0;
    let dy = 0;
    if (isUp) dy -= 1;
    if (isDown) dy += 1;
    if (isLeft) dx -= 1;
    if (isRight) dx += 1;

    const isMoving = dx !== 0 || dy !== 0;
    this.playerState.isMoving = isMoving;
    this.playerState.isSprinting = isSprint && isMoving;
    this.playerState.isSneaking = isSneak;

    // キビキビ動く快適な速度設定
    let speed = 230; // 通常歩行
    if (isSprint) speed = 400; // ダッシュ (約1.75倍)
    else if (isSneak) speed = 90; // スニーク

    // ジャンプ物理
    const gravity = 800; // px/s^2
    if (isJump && this.playerState.z <= 0) {
      this.playerState.vz = 300; // 上向き初速
      this.playerState.isJumping = true;
    }

    if (this.playerState.isJumping || this.playerState.z > 0) {
      this.playerState.z += this.playerState.vz * dt;
      this.playerState.vz -= gravity * dt;
      if (this.playerState.z <= 0) {
        this.playerState.z = 0;
        this.playerState.vz = 0;
        this.playerState.isJumping = false;
      }
    }

    // 移動の適用
    if (isMoving) {
      const len = Math.sqrt(dx * dx + dy * dy);
      this.playerState.x += (dx / len) * speed * dt;
      this.playerState.y += (dy / len) * speed * dt;

      // 向きの更新
      if (Math.abs(dx) > Math.abs(dy)) {
        this.playerState.direction = dx > 0 ? 'right' : 'left';
      } else {
        this.playerState.direction = dy > 0 ? 'down' : 'up';
      }

      // 歩行アニメーションタイマー
      this.walkAnimTimer += dt * (isSprint ? 18 : 12);

      // ダッシュ時の土煙
      if (isSprint && this.playerState.z <= 0 && Math.random() < 0.4) {
        this.dustParticles.push({
          x: this.playerState.x + (Math.random() * 8 - 4),
          y: this.playerState.y + (Math.random() * 4 - 2),
          vx: (Math.random() - 0.5) * 30,
          vy: -15 - Math.random() * 20,
          life: 0.35,
        });
      }
    } else {
      this.walkAnimTimer = 0;
    }

    // プレイヤーのスプライト位置を直接更新 (Reactを介さず爆速)
    this.updatePlayerSpriteVisual();
  }

  // プレイヤーのスプライト描画更新 (4方向・ボビング・影)
  private updatePlayerSpriteVisual() {
    const sprite = this.entitySprites.get('player_main');
    if (!sprite) return;

    // 4方向スプライトテクスチャの切り替え
    const asset = this.currentAssets?.[this.playerState.assetId];
    if (asset?.sprite.directionalUrls) {
      const dirUrl = asset.sprite.directionalUrls[this.playerState.direction] || asset.sprite.url;
      if (this.textureCache.has(dirUrl)) {
        sprite.texture = this.textureCache.get(dirUrl)!;
      }
    }

    // 歩行ボビング (歩行中は上下2px揺れ、待機中はゆっくり呼吸)
    let bobbingY = 0;
    if (this.playerState.isMoving) {
      bobbingY = Math.sin(this.walkAnimTimer) * 2;
    }

    sprite.x = this.playerState.x;
    sprite.y = this.playerState.y - this.playerState.z + bobbingY;
    (sprite as any).worldFootY = this.playerState.y;

    // 接地影の更新 (足元接地Yに固定、ジャンプで縮小)
    this.shadowGraphics.clear();
    const shadowScale = Math.max(0.35, 1 - this.playerState.z / 180);
    this.shadowGraphics
      .ellipse(this.playerState.x, this.playerState.y, 8 * shadowScale, 3 * shadowScale)
      .fill({ color: 0x000000, alpha: 0.35 * shadowScale });
  }

  private centerCamera() {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
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

  public followPlayer(playerX: number, playerY: number, lerp: number = 0.12) {
    if (!this.container || this.isDraggingCamera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const targetCamX = width / 2 - playerX * this.zoom;
    const targetCamY = height / 2 - playerY * this.zoom;

    this.cameraX += (targetCamX - this.cameraX) * lerp;
    this.cameraY += (targetCamY - this.cameraY) * lerp;
    this.updateCameraTransform();
  }

  private currentAssets: Record<string, AirasAsset> | null = null;

  public async setPlayerAvatar(assetId: string) {
    this.playerState.assetId = assetId;
    if (this.currentAssets?.[assetId]) {
      const asset = this.currentAssets[assetId];
      // 4方向テクスチャのプリロード
      if (asset.sprite.directionalUrls) {
        for (const url of Object.values(asset.sprite.directionalUrls)) {
          if (url) await this.getTexture(url);
        }
      }
      this.updatePlayerSpriteVisual();
    }
  }

  private async getTexture(url: string): Promise<Texture> {
    if (this.textureCache.has(url)) {
      return this.textureCache.get(url)!;
    }
    const texture = await Assets.load(url);
    if (texture.source) {
      texture.source.scaleMode = 'nearest';
    }
    this.textureCache.set(url, texture);
    return texture;
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
      const asset = assets[entity.assetId];
      if (!asset) continue;

      await this.updateEntitySprite(
        entity.id,
        asset,
        entity.position.x,
        entity.position.y,
        entity.position.z,
        1.0
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

    // 5. 選択ハイライト
    this.renderSelectionHighlight(world, assets, selectedEntityId);
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

  private async updateEntitySprite(
    id: string,
    asset: AirasAsset,
    x: number,
    y: number,
    z: number,
    alpha: number = 1.0,
    isGhost: boolean = false
  ) {
    let sprite = this.entitySprites.get(id);
    if (!sprite) {
      const texture = await this.getTexture(asset.sprite.url);
      sprite = new Sprite(texture);
      sprite.eventMode = 'static';
      this.entitySprites.set(id, sprite);
      this.depthContainer.addChild(sprite);
    }

    const ax = asset.anchor.x / asset.sprite.width;
    const ay = asset.anchor.y / asset.sprite.height;
    sprite.anchor.set(ax, ay);

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

  private renderWeather(weather: WeatherType) {
    this.weatherGraphics.clear();
    if (weather === 'clear') return;

    if (weather === 'rain') {
      for (const p of this.weatherParticles) {
        p.y += p.speed;
        p.x -= p.speed * 0.3;
        if (p.y > 1100) p.y = -50;
        if (p.x < -200) p.x = 2200;

        this.weatherGraphics
          .moveTo(p.x, p.y)
          .lineTo(p.x - 3, p.y + p.length)
          .stroke({ color: 0x93c5fd, width: 1.5, alpha: 0.55 });
      }
    } else if (weather === 'snow') {
      for (const p of this.weatherParticles) {
        p.y += p.speed * 0.4;
        p.x += Math.sin(p.y * 0.05) * 0.8;
        if (p.y > 1100) p.y = -50;
        if (p.x < -200) p.x = 2200;

        this.weatherGraphics
          .circle(p.x, p.y, 2)
          .fill({ color: 0xffffff, alpha: 0.75 });
      }
    } else if (weather === 'sunset') {
      this.weatherGraphics
        .rect(-1000, -1000, 4000, 3000)
        .fill({ color: 0xf97316, alpha: 0.16 });
    }
  }

  private setupInteractions(canvas: HTMLCanvasElement) {
    let pointerDownPos = { x: 0, y: 0 };
    let hasMovedSignificantly = false;

    canvas.addEventListener('pointerdown', (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
      hasMovedSignificantly = false;

      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const worldPos = this.screenToWorld(screenX, screenY);

      // 右クリック: マインクラフト準拠インタラクション
      if (e.button === 2) {
        let hitId: string | null = null;
        for (const [id, sprite] of Array.from(this.entitySprites.entries()).reverse()) {
          if (id.startsWith('__ghost_') || id === 'player_main') continue;
          const bounds = sprite.getBounds();
          if (
            screenX >= bounds.x &&
            screenX <= bounds.x + bounds.width &&
            screenY >= bounds.y &&
            screenY <= bounds.y + bounds.height
          ) {
            hitId = id;
            break;
          }
        }

        if (hitId) {
          this.onEntityRightClick?.(hitId);
          return;
        }

        this.isDraggingCamera = true;
        this.lastMousePos = { x: e.clientX, y: e.clientY };
        return;
      }

      if (e.button === 1 || e.altKey) {
        this.isDraggingCamera = true;
        this.lastMousePos = { x: e.clientX, y: e.clientY };
        return;
      }

      // 左クリック: オブジェクト選択 / 移動
      let pickedId: string | null = null;
      for (const [id, sprite] of Array.from(this.entitySprites.entries()).reverse()) {
        if (id.startsWith('__ghost_') || id === 'player_main') continue;
        const bounds = sprite.getBounds();
        if (
          screenX >= bounds.x &&
          screenX <= bounds.x + bounds.width &&
          screenY >= bounds.y &&
          screenY <= bounds.y + bounds.height
        ) {
          pickedId = id;
          break;
        }
      }

      if (pickedId) {
        this.draggingEntityId = pickedId;
        const sprite = this.entitySprites.get(pickedId)!;
        this.dragOffset = {
          x: worldPos.x - sprite.x,
          y: worldPos.y - sprite.y,
        };
      } else {
        this.isDraggingCamera = true;
        this.lastMousePos = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('pointermove', (e: PointerEvent) => {
      const dx = Math.abs(e.clientX - pointerDownPos.x);
      const dy = Math.abs(e.clientY - pointerDownPos.y);
      if (dx > 4 || dy > 4) {
        hasMovedSignificantly = true;
      }

      if (this.isDraggingCamera) {
        const deltaX = e.clientX - this.lastMousePos.x;
        const deltaY = e.clientY - this.lastMousePos.y;
        this.panCamera(deltaX, deltaY);
        this.lastMousePos = { x: e.clientX, y: e.clientY };
      } else if (this.draggingEntityId) {
        const rect = canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const worldPos = this.screenToWorld(screenX, screenY);

        const newX = Math.round(worldPos.x - this.dragOffset.x);
        const newY = Math.round(worldPos.y - this.dragOffset.y);
        this.onEntityDrag?.(this.draggingEntityId, newX, newY);
      }
    });

    window.addEventListener('pointerup', (e: PointerEvent) => {
      if (!hasMovedSignificantly && e.button === 0) {
        const rect = canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const worldPos = this.screenToWorld(screenX, screenY);

        if (this.draggingEntityId) {
          this.onEntityClick?.(this.draggingEntityId);
        } else {
          this.onMapClick?.(worldPos.x, worldPos.y);
        }
      }

      this.isDraggingCamera = false;
      this.draggingEntityId = null;
    });

    canvas.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const delta = e.deltaY < 0 ? 0.12 : -0.12;
        this.zoomCamera(delta, cx, cy);
      },
      { passive: false }
    );

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  destroy(): void {
    if (this.app) {
      this.app.destroy(true, { children: true, texture: false });
      this.app = null;
    }
  }
}
