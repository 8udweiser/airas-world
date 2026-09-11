import { AirasWorldData, Direction } from '../core/types/world';
import { AirasAsset } from '../core/types/asset';

export interface RendererGhostEntity {
  assetId: string;
  x: number;
  y: number;
  name: string;
}

export interface IRenderer {
  init(container: HTMLElement): Promise<void>;
  render(
    world: AirasWorldData,
    assets: Record<string, AirasAsset>,
    selectedEntityId?: string | null,
    ghosts?: RendererGhostEntity[]
  ): void;
  destroy(): void;
  
  // 座標変換
  screenToWorld(screenX: number, screenY: number): { x: number; y: number };
  worldToScreen(worldX: number, worldY: number): { x: number; y: number };
  
  // カメラ操作
  panCamera(dx: number, dy: number): void;
  zoomCamera(delta: number, centerX?: number, centerY?: number): void;
  resetCamera(): void;
  
  // イベント登録
  onEntityClick?: (entityId: string) => void;
  onMapClick?: (worldX: number, worldY: number) => void;
  onEntityDrag?: (entityId: string, newWorldX: number, newWorldY: number, direction?: Direction) => void;
  onEntityRotate?: (entityId: string, newDir: Direction) => void;
  onEntityDragEnd?: (
    entityId: string,
    startPos: { x: number; y: number },
    endPos: { x: number; y: number },
    startDir?: Direction,
    endDir?: Direction
  ) => void;
  getEntityAtScreen?: (screenX: number, screenY: number) => string | null;
  setEntityDirection?: (entityId: string, newDir: Direction) => void;
}
