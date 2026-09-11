import { Direction, AirasWorldData, WorldTile } from '../types/world';

export type FlowDirection = Direction | 'none';

export interface WaterTileState {
  waterLevel: number;           // 水深 0.0 - 1.0+
  flowDirection: FlowDirection; // 8方向または静止
  flowSpeed: number;            // 流速 (0: 静水, 1.0: 通常の流れ, 2.5+: 激流)
  elevation: number;            // 地面の標高
  isWaterfall: boolean;         // 段差による滝
}

export interface ShoreWave {
  x: number;
  y: number;
  tileX: number;
  tileY: number;
  angle: number;                // 波の進行角度 (ラジアン)
  phase: number;                // 0.0 - 1.0 の波周期
  alpha: number;
  width: number;
  crestOffset: number;          // 打ち寄せオフセット (-6px 〜 +10px)
}

export class WaterPhysicsEngine {
  private tileSize: number = 32;
  private chunkSize: number = 16;
  private minTileX: number = 0;
  private maxTileX: number = 47;
  private minTileY: number = 0;
  private maxTileY: number = 31;
  private waterMap: Map<string, WaterTileState> = new Map();
  private shoreWaves: ShoreWave[] = [];

  // 方向ベクトルマッピング (8方向)
  private readonly DIR_VECTORS: Record<Direction, { dx: number; dy: number; angle: number }> = {
    up: { dx: 0, dy: -1, angle: -Math.PI / 2 },
    'up-right': { dx: 0.7071, dy: -0.7071, angle: -Math.PI / 4 },
    right: { dx: 1, dy: 0, angle: 0 },
    'down-right': { dx: 0.7071, dy: 0.7071, angle: Math.PI / 4 },
    down: { dx: 0, dy: 1, angle: Math.PI / 2 },
    'down-left': { dx: -0.7071, dy: 0.7071, angle: (Math.PI * 3) / 4 },
    left: { dx: -1, dy: 0, angle: Math.PI },
    'up-left': { dx: -0.7071, dy: -0.7071, angle: -(Math.PI * 3) / 4 }
  };

  constructor(tileSize: number = 32) {
    this.tileSize = tileSize;
  }

  private getTileKey(gx: number, gy: number): string {
    return `${gx},${gy}`;
  }

  public getTileAt(world: AirasWorldData, gx: number, gy: number): WorldTile | null {
    const cs = world.map?.chunkSize || this.chunkSize;
    const cx = Math.floor(gx / cs);
    const cy = Math.floor(gy / cs);
    const lx = ((gx % cs) + cs) % cs;
    const ly = ((gy % cs) + cs) % cs;
    const chunk = world.map?.chunks?.[`${cx},${cy}`];
    return chunk?.tiles?.[ly]?.[lx] || null;
  }

  /**
   * ワールドデータから標高マップおよび水流グリッドを初期化・再構築
   */
  public updateWorldWaterMap(world: AirasWorldData): void {
    this.tileSize = world.map?.tileSize || 32;
    this.chunkSize = world.map?.chunkSize || 16;
    this.waterMap.clear();
    this.shoreWaves = [];

    // 全チャンクの範囲を算出
    let minGx = 0;
    let maxGx = 47;
    let minGy = 0;
    let maxGy = 31;

    for (const chunkKey of Object.keys(world.map.chunks)) {
      const [cxStr, cyStr] = chunkKey.split(',');
      const cx = parseInt(cxStr, 10);
      const cy = parseInt(cyStr, 10);
      minGx = Math.min(minGx, cx * this.chunkSize);
      maxGx = Math.max(maxGx, (cx + 1) * this.chunkSize - 1);
      minGy = Math.min(minGy, cy * this.chunkSize);
      maxGy = Math.max(maxGy, (cy + 1) * this.chunkSize - 1);
    }
    this.minTileX = minGx;
    this.maxTileX = maxGx;
    this.minTileY = minGy;
    this.maxTileY = maxGy;

    // 1. 各タイルの標高と水深を初期化
    for (let gy = minGy; gy <= maxGy; gy++) {
      for (let gx = minGx; gx <= maxGx; gx++) {
        const tile = this.getTileAt(world, gx, gy);
        if (!tile) continue;

        const tileId = tile.tileId.toLowerCase();
        const isWater = tileId.includes('water') || tileId.includes('river');
        const isSand = tileId.includes('sand');

        // デフォルト標高: 北高南低の自然な傾斜 + タイル標高
        let baseElev = (maxGy - gy) * 0.4 + (tile.elevation || 0);
        if (isWater) {
          baseElev -= 1.8;
        } else if (isSand) {
          baseElev -= 0.6;
        }

        if (isWater) {
          this.waterMap.set(this.getTileKey(gx, gy), {
            waterLevel: 1.0,
            flowDirection: 'none',
            flowSpeed: 0,
            elevation: baseElev,
            isWaterfall: false
          });
        }
      }
    }

    // 2. 水流ベクトルの計算 (低きに流れる重力シミュレーション & 8方向水流)
    const neighborOffsets: { dir: Direction; dx: number; dy: number }[] = [
      { dir: 'up', dx: 0, dy: -1 },
      { dir: 'up-right', dx: 1, dy: -1 },
      { dir: 'right', dx: 1, dy: 0 },
      { dir: 'down-right', dx: 1, dy: 1 },
      { dir: 'down', dx: 0, dy: 1 },
      { dir: 'down-left', dx: -1, dy: 1 },
      { dir: 'left', dx: -1, dy: 0 },
      { dir: 'up-left', dx: -1, dy: -1 }
    ];

    for (let gy = minGy; gy <= maxGy; gy++) {
      for (let gx = minGx; gx <= maxGx; gx++) {
        const key = this.getTileKey(gx, gy);
        const current = this.waterMap.get(key);
        if (!current) continue;

        // 特殊水路: 公園を縦断する清流 (gx: 34..37) は勢いよく南へ流れる
        if (gx >= 34 && gx <= 37) {
          current.flowDirection = 'down';
          current.flowSpeed = 2.4; // 激流
          continue;
        }

        // 南西の湖 (gx <= 18, gy >= 30) は穏やかな海流
        if (gx <= 18 && gy >= 30) {
          current.flowDirection = 'down-left';
          current.flowSpeed = 0.45; // 穏やかな水流
          continue;
        }

        // 一般水流の重力勾配計算
        let lowestElev = current.elevation;
        let flowDir: FlowDirection = 'none';

        for (const { dir, dx, dy } of neighborOffsets) {
          const nx = gx + dx;
          const ny = gy + dy;
          const nKey = this.getTileKey(nx, ny);
          const neighbor = this.waterMap.get(nKey);

          if (neighbor && neighbor.elevation < lowestElev) {
            lowestElev = neighbor.elevation;
            flowDir = dir;
          }
        }

        const elevDiff = current.elevation - lowestElev;
        if (flowDir !== 'none' && elevDiff > 0.05) {
          current.flowDirection = flowDir;
          current.flowSpeed = Math.min(3.5, 0.8 + elevDiff * 1.2);
          if (elevDiff >= 1.4) {
            current.isWaterfall = true;
          }
        } else {
          current.flowDirection = 'down';
          current.flowSpeed = 0.3;
        }
      }
    }

    // 3. 砂浜（sand）と水（water）の境界を検出し、波（ShoreWave）の発生地点を生成
    for (let gy = minGy; gy <= maxGy; gy++) {
      for (let gx = minGx; gx <= maxGx; gx++) {
        const tile = this.getTileAt(world, gx, gy);
        if (!tile || !tile.tileId.toLowerCase().includes('sand')) continue;

        // 砂浜タイルの周囲に水があるか調べる
        for (const { dir, dx, dy } of neighborOffsets) {
          const nx = gx + dx;
          const ny = gy + dy;
          if (this.waterMap.has(this.getTileKey(nx, ny))) {
            const vec = this.DIR_VECTORS[dir];
            this.shoreWaves.push({
              x: (gx + 0.5) * this.tileSize,
              y: (gy + 0.5) * this.tileSize,
              tileX: gx,
              tileY: gy,
              angle: vec.angle,
              phase: (gx * 0.45 + gy * 0.65) % 1.0,
              alpha: 0,
              width: this.tileSize * 0.85,
              crestOffset: 0
            });
            break;
          }
        }
      }
    }
  }

  /**
   * 指定のワールド座標における水流の推進力・抵抗を取得
   */
  public getWaterFlowForceAt(
    worldX: number,
    worldY: number
  ): {
    inWater: boolean;
    depth: number;
    flowVx: number;
    flowVy: number;
    speed: number;
    isWaterfall: boolean;
    flowDirection: FlowDirection;
  } {
    const tileX = Math.floor(worldX / this.tileSize);
    const tileY = Math.floor(worldY / this.tileSize);
    const state = this.waterMap.get(this.getTileKey(tileX, tileY));

    if (!state || state.waterLevel <= 0) {
      return {
        inWater: false,
        depth: 0,
        flowVx: 0,
        flowVy: 0,
        speed: 0,
        isWaterfall: false,
        flowDirection: 'none'
      };
    }

    let vx = 0;
    let vy = 0;
    if (state.flowDirection !== 'none') {
      const vec = this.DIR_VECTORS[state.flowDirection];
      if (vec) {
        // 通常の流れで約 50px/s、激流で 130px/s の流速
        const pushMag = state.flowSpeed * 52;
        vx = vec.dx * pushMag;
        vy = vec.dy * pushMag;
      }
    }

    return {
      inWater: true,
      depth: state.waterLevel,
      flowVx: vx,
      flowVy: vy,
      speed: state.flowSpeed,
      isWaterfall: state.isWaterfall,
      flowDirection: state.flowDirection
    };
  }

  /**
   * 寄せては返す砂浜の波の現在状態を更新・取得
   */
  public updateShoreWaves(timeSec: number): ShoreWave[] {
    for (const wave of this.shoreWaves) {
      // 周期 2.8 秒の波サイクル
      const cycle = ((timeSec * 0.36 + wave.phase) % 1.0);
      const sinVal = Math.sin(cycle * Math.PI * 2);
      wave.alpha = Math.max(0, sinVal) * 0.85;
      wave.crestOffset = sinVal * 8.0; // 砂浜へ最大 8px 打ち寄せて引く
    }
    return this.shoreWaves;
  }

  /**
   * 地面を掘るアクション (標高を下げて周囲から水を引き込む)
   */
  public digGround(tileX: number, tileY: number, world: AirasWorldData): boolean {
    const tile = this.getTileAt(world, tileX, tileY);
    if (!tile) return false;

    tile.elevation = (tile.elevation || 0) - 1.5;

    // 周囲に水があれば流れ込んで水タイル化
    let hasAdjacentWater = false;
    const offsets = [
      [0, -1], [1, 0], [0, 1], [-1, 0]
    ];
    for (const [dx, dy] of offsets) {
      if (this.waterMap.has(this.getTileKey(tileX + dx, tileY + dy))) {
        hasAdjacentWater = true;
        break;
      }
    }

    if (hasAdjacentWater) {
      tile.tileId = 'tile_water';
    }

    this.updateWorldWaterMap(world);
    return true;
  }
}