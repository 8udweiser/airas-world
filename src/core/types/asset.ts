export type AssetCategory = 
  | 'furniture' 
  | 'infrastructure' 
  | 'nature' 
  | 'npc' 
  | 'structure' 
  | 'vehicle'
  | 'tile';

export interface CollisionBox {
  enabled: boolean;
  type: 'box' | 'circle' | 'none';
  offsetX: number; // アンカーからの相対Xオフセット
  offsetY: number; // アンカーからの相対Yオフセット
  width: number;
  height: number;
}

export interface InteractionDefinition {
  type: 'sit' | 'talk' | 'inspect' | 'open_shop' | 'buy';
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
    url: string;           // 画像URL または Data URI (SVG/PNG)
    width: number;         // 幅 (px)
    height: number;        // 高さ (px)
    pixelArt: boolean;     // ピクセルアート補間
  };

  // 描画基準点 (アンカー: 通常は足元の接地点 (width/2, height))
  anchor: {
    x: number;
    y: number;
  };

  // 2.5D 足元当たり判定
  collision: CollisionBox;

  // 深度描画制御 (Yソート補正)
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
