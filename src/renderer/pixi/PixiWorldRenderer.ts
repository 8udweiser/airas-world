import { Application, Container, Sprite, Graphics, Assets, Texture } from 'pixi.js';
import { AirasWorldData, WeatherType } from '../../core/types/world';
import { AirasAsset } from '../../core/types/asset';
import { IRenderer, RendererGhostEntity } from '../IRenderer';

export class PixiWorldRenderer implements IRenderer {
  private app: Application | null = null;
  private container: HTMLElement | null = null;
  
  // シーン階層
  private stageContainer: Container = new Container();
  private tileContainer: Container = new Container();
  private shadowGraphics: Graphics = new Graphics();
  private selectionGraphics: Graphics = new Graphics();
  private depthContainer: Container = new Container();
  private particleGraphics: Graphics = new Graphics();
  private weatherGraphics: Graphics = new Graphics();

  // キャッシュ
  private entitySprites: Map<string, Sprite> = new Map();
  private textureCache: Map<string, Texture> = new Map();

  // カメラ状態 (広大な街が見渡せるよう初期ズームは 1.1x)
  private cameraX: number = 0;
  private cameraY: number = 0;
  private zoom: number = 1.1;
  private minZoom: number = 0.4;
  private maxZoom: number = 3.0;

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

  // パーティクル
  private weatherParticles: Array<{ x: number; y: number; speed: number; length: number }> = [];
  private dustParticles: Array<{ x: number; y: number; vx: number; vy: number; life: number }> = [];

  async init(container: HTMLElement): Promise<void> {
    this.container = container;
    const app = new Application();
    
    await app.init({
      resizeTo: container,
      backgroundColor: 0x090d16,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: false,
    });

    this.app = app;
    container.appendChild(app.canvas);

    // シーン階層の構築
    this.app.stage.addChild(this.stageContainer);
    this.stageContainer.addChild(this.tileContainer);
    this.stageContainer.addChild(this.shadowGraphics); // 足元影レイヤー
    this.stageContainer.addChild(this.selectionGraphics);
    this.stageContainer.addChild(this.depthContainer); // Yソート対象
    this.stageContainer.addChild(this.particleGraphics); // ダッシュ土煙
    this.stageContainer.addChild(this.weatherGraphics);

    this.setupInteractions(app.canvas);
    this.centerCamera();

    // 天候パーティクル
    for (let i = 0; i < 200; i++) {
      this.weatherParticles.push({
        x: Math.random() * 2000 - 300,
        y: Math.random() * 1200 - 200,
        speed: 5 + Math.random() * 6,
        length: 10 + Math.random() * 12,
      });
    }
  }

  private centerCamera() {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    // プレイヤー初期位置 (480, 480) を中心に配置
    this.cameraX = width / 2 - 480 * this.zoom;
    this.cameraY = height / 2 - 480 * this.zoom;
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
    this.zoom = 1.1;
    this.centerCamera();
  }

  // 探索モード時のカメラ追従 (Lerp補間)
  public followPlayer(playerX: number, playerY: number, lerp: number = 0.1) {
    if (!this.container || this.isDraggingCamera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const targetCamX = width / 2 - playerX * this.zoom;
    const targetCamY = height / 2 - playerY * this.zoom;

    this.cameraX += (targetCamX - this.cameraX) * lerp;
    this.cameraY += (targetCamY - this.cameraY) * lerp;
    this.updateCameraTransform();
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

  public async render(
    world: AirasWorldData,
    assets: Record<string, AirasAsset>,
    selectedEntityId?: string | null,
    ghosts?: RendererGhostEntity[],
    isPlayMode: boolean = false
  ): Promise<void> {
    if (!this.app) return;

    // 探索モード時はプレイヤーへスムーズにカメラ追従
    if (isPlayMode) {
      this.followPlayer(world.player.position.x, world.player.position.y);
    }

    // 1. マップタイル
    await this.renderTiles(world, assets);

    // 2. 影レイヤーのクリア
    this.shadowGraphics.clear();

    const renderedIds = new Set<string>();

    // プレイヤー描画
    const player = world.player;
    const playerAsset = assets[player.assetId];
    if (playerAsset) {
      await this.updateEntitySprite(
        player.id,
        playerAsset,
        player.position.x,
        player.position.y,
        player.position.z,
        1.0
      );
      renderedIds.add(player.id);

      // ジャンプ中の足元影の接地描画 (Z軸の高さに応じて影が縮小)
      const shadowScale = Math.max(0.4, 1 - player.position.z / 150);
      const shadowAlpha = Math.max(0.15, 0.35 * shadowScale);
      this.shadowGraphics
        .ellipse(player.position.x, player.position.y, 8 * shadowScale, 3 * shadowScale)
        .fill({ color: 0x000000, alpha: shadowAlpha });

      // ダッシュ時の土煙パーティクル発生
      if (player.isSprinting && player.isMoving && player.position.z <= 0) {
        if (Math.random() < 0.4) {
          this.dustParticles.push({
            x: player.position.x + (Math.random() * 8 - 4),
            y: player.position.y + (Math.random() * 4 - 2),
            vx: (Math.random() - 0.5) * 20,
            vy: -10 - Math.random() * 15,
            life: 0.4,
          });
        }
      }
    }

    // オブジェクト・NPC描画
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

    // ゴーストプレビュー
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

    // 不要スプライト破棄
    for (const [id, sprite] of this.entitySprites.entries()) {
      if (!renderedIds.has(id)) {
        this.depthContainer.removeChild(sprite);
        this.entitySprites.delete(id);
      }
    }

    // 3. 2.5D 深度ソート (足元接地位置 Y を基準にソート)
    // 接地点のY座標が手前にあるものほど手前に描画
    this.depthContainer.children.sort((a, b) => (a as any).worldFootY - (b as any).worldFootY);

    // 4. ダッシュ土煙パーティクル描画
    this.renderDustParticles();

    // 5. 選択ハイライト
    this.renderSelectionHighlight(world, assets, selectedEntityId);

    // 6. 天候
    this.renderWeather(world.environment.weather);
  }

  private async renderTiles(world: AirasWorldData, assets: Record<string, AirasAsset>) {
    if (this.tileContainer.children.length > 0) return;

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
    sprite.y = y - z; // 2.5D空中浮上 (ジャンプ)
    (sprite as any).worldFootY = y; // ソート用足元接地Y

    sprite.alpha = isGhost ? 0.65 : alpha;
    if (isGhost) {
      sprite.tint = 0x38bdf8;
    } else {
      sprite.tint = 0xffffff;
    }
  }

  private renderDustParticles() {
    this.particleGraphics.clear();
    for (let i = this.dustParticles.length - 1; i >= 0; i--) {
      const p = this.dustParticles[i];
      p.x += p.vx * 0.016;
      p.y += p.vy * 0.016;
      p.life -= 0.016;

      if (p.life <= 0) {
        this.dustParticles.splice(i, 1);
        continue;
      }

      this.particleGraphics
        .circle(p.x, p.y, Math.max(1, p.life * 5))
        .fill({ color: 0xe2e8f0, alpha: p.life * 0.8 });
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
        if (p.x < -200) p.x = 1800;

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
        if (p.x < -200) p.x = 1800;

        this.weatherGraphics
          .circle(p.x, p.y, 2)
          .fill({ color: 0xffffff, alpha: 0.75 });
      }
    } else if (weather === 'sunset') {
      this.weatherGraphics
        .rect(-500, -500, 2600, 2000)
        .fill({ color: 0xf97316, alpha: 0.18 });
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

      // 右クリック: マインクラフト準拠のオブジェクト使用/インタラクション
      if (e.button === 2) {
        // オブジェクトのヒットテスト
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

        // 何もない場所の右ドラッグはカメラパン
        this.isDraggingCamera = true;
        this.lastMousePos = { x: e.clientX, y: e.clientY };
        return;
      }

      // 中ボタンまたはAltキー
      if (e.button === 1 || e.altKey) {
        this.isDraggingCamera = true;
        this.lastMousePos = { x: e.clientX, y: e.clientY };
        return;
      }

      // 左クリック: オブジェクト選択 / 移動開始
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
