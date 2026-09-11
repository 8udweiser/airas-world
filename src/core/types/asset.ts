export type AssetCategory = 
  | 'furniture' 
  | 'infrastructure' 
  | 'nature' 
  | 'npc' 
  | 'structure' 
  | 'vehicle'
  | 'item'
  | 'tile';

export interface CollisionBox {
  enabled: boolean;
  type: 'box' | 'circle' | 'none';
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

export interface InteractionDefinition {
  type: 'sit' | 'talk' | 'inspect' | 'open_shop' | 'buy' | 'drive' | 'sleep' | 'scoop_water' | 'place_water';
  label: string;
  dialogue?: string[];
  actionScript?: string;
}

export interface AirasAsset {
  id: string;
  name: string;
  type: 'object' | 'character' | 'building_part' | 'tile';
  category: AssetCategory;
  
  // スプライト情報
  sprite: {
    url: string;           // デフォルト画像URL
    width: number;
    height: number;
    pixelArt: boolean;
    // 4方向 / 8方向スプライト (キャラクター・乗り物用)
    directionalUrls?: {
      down?: string;
      up?: string;
      left?: string;
      right?: string;
      // 将来の8方向(斜め)対応
      'down-left'?: string;
      'down-right'?: string;
      'up-left'?: string;
      'up-right'?: string;
    };
  };

  // 描画基準点 (アンカー)
  anchor: {
    x: number;
    y: number;
  };

  // 2.5D 足元当たり判定
  collision: CollisionBox;

  // 深度描画制御
  depth: {
    enabled: boolean;
    offsetY: number;
  };

  // アニメーション (オプション)
  animations?: Record<string, {
    frames: { x: number; y: number; w: number; h: number; duration: number }[];
    loop: boolean;
  }>;

  // インタラクション
  interactions?: InteractionDefinition[];

  metadata: {
    tags: string[];
    createdAt: number;
    source: 'preset' | 'ai_generated' | 'user_upload';
    promptUsed?: string;
    description?: string;
  };
}
