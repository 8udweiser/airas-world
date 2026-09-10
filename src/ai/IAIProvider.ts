import { AirasWorldData } from '../core/types/world';
import { IWorldCommand } from '../core/types/command';
import { AirasAsset } from '../core/types/asset';

export interface WorldEditContext {
  world: AirasWorldData;
  availableAssets: Record<string, AirasAsset>;
  selectedEntityId?: string | null;
  cursorPosition?: { x: number; y: number };
}

export interface ProposedPlan {
  title: string;
  thought: string;             // AIの推論過程・説明
  commands: IWorldCommand[];   // 提案コマンド群
  assetsToRegister?: AirasAsset[]; // 新規作成されたアセット
  previewGhostEntities?: Array<{
    assetId: string;
    x: number;
    y: number;
    name: string;
  }>;
}

export interface IAIProvider {
  readonly id: string;
  readonly name: string;
  
  // 自然言語指示からワールド変更プランを提案
  planWorldEdit(prompt: string, context: WorldEditContext): Promise<ProposedPlan>;
}
