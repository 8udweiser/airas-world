export type WeatherType = 'clear' | 'rain' | 'snow' | 'fog' | 'sunset';

export interface WorldEnvironment {
  time: number;          // 0.0 - 24.0 (時刻: 例 14.5 = 14:30)
  timeSpeed: number;     // 1秒あたりの進む時間（0で停止）
  weather: WeatherType;
  ambientColor: string;  // ライティングカラー (hex または rgba)
  rainIntensity?: number; // 0.0 - 1.0
}

export interface WorldTile {
  tileId: string;        // 'road', 'sidewalk', 'grass', 'crosswalk', 'tatami', etc.
  elevation: number;     // 高さ
}

export interface WorldChunk {
  cx: number;
  cy: number;
  tiles: WorldTile[][];  // CHUNK_SIZE x CHUNK_SIZE (例: 16x16)
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

export interface PlayerState {
  id: string;
  name: string;
  assetId: string;
  position: { x: number; y: number; z: number };
  direction: 'down' | 'up' | 'left' | 'right';
  isMoving: boolean;
  speed: number;
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
