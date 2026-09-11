export type WeatherType = 'clear' | 'rain' | 'heavy_rain' | 'typhoon' | 'snow' | 'fog' | 'sunset';

export interface WorldEnvironment {
  time: number;          // 0.0 - 24.0 (時刻: 例 14.5 = 14:30)
  timeSpeed: number;     // 1秒あたりの進む時間（0で停止）
  weather: WeatherType;
  ambientColor: string;  // ライティングカラー (hex または rgba)
  rainIntensity?: number; // 0.0 - 1.0
}

export interface WorldTile {
  tileId: string;        // 'road', 'sidewalk', 'grass', 'crosswalk', 'rail', etc.
  elevation: number;     // 高さ
}

export interface WorldChunk {
  cx: number;
  cy: number;
  tiles: WorldTile[][];  // 16x16
}

export interface WorldEntity {
  id: string;
  assetId: string;
  name: string;
  type: 'object' | 'building' | 'npc' | 'vehicle' | 'effect';
  position: {
    x: number; // ワールド座標 (ピクセル)
    y: number; // ワールド座標 (ピクセル)
    z: number; // 高さ (ピクセル)
  };
  rotation?: number;       // 0, 90, 180, 270 (度)
  scale?: { x: number; y: number };
  state?: Record<string, any>;
  customProperties?: Record<string, any>;
}

export type Direction = 'down' | 'up' | 'left' | 'right' | 'down-left' | 'down-right' | 'up-left' | 'up-right';

export interface PlayerState {
  id: string;
  name: string;
  assetId: string;
  position: { x: number; y: number; z: number };
  vz: number;            // 垂直速度 (ジャンプ用)
  direction: Direction;
  isMoving: boolean;
  isJumping: boolean;
  isSprinting: boolean;  // ダッシュ中
  isSneaking: boolean;   // スニーク中 (しゃがみ)
  speed: number;         // 基本速度
}

export interface AirasWorldData {
  version: string;
  id: string;
  name: string;
  metadata: {
    createdAt: number;
    updatedAt: number;
    author: string;
    description?: string;
  };
  environment: WorldEnvironment;
  map: {
    tileSize: number;
    chunkSize: number;
    chunks: Record<string, WorldChunk>; // "cx,cy"
  };
  entities: Record<string, WorldEntity>;
  player: PlayerState;
}
