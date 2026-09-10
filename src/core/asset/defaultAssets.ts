import { AirasAsset } from '../types/asset';

// SVGをDataURIに変換するヘルパー
function svgToUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

// 1. 昭和レトロ赤い自販機 (32x56)
const vendingMachineSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 56" shape-rendering="crispEdges">
  <!-- 自販機本体 -->
  <rect x="2" y="2" width="28" height="50" fill="#b91c1c" />
  <rect x="4" y="4" width="24" height="4" fill="#ef4444" />
  <rect x="2" y="2" width="28" height="2" fill="#fca5a5" />
  <rect x="2" y="2" width="2" height="50" fill="#f87171" />
  <rect x="28" y="4" width="2" height="48" fill="#7f1d1d" />
  
  <!-- 上部看板 "COLD / HOT" -->
  <rect x="6" y="8" width="20" height="6" fill="#1e293b" />
  <rect x="8" y="10" width="7" height="2" fill="#38bdf8" />
  <rect x="17" y="10" width="7" height="2" fill="#f97316" />
  
  <!-- ドリンク展示棚 -->
  <rect x="6" y="16" width="20" height="18" fill="#0f172a" />
  <rect x="7" y="17" width="18" height="16" fill="#1e293b" />
  <!-- ボトル列 1段目 -->
  <rect x="8" y="19" width="3" height="5" fill="#ef4444" />
  <rect x="12" y="19" width="3" height="5" fill="#3b82f6" />
  <rect x="16" y="19" width="3" height="5" fill="#10b981" />
  <rect x="20" y="19" width="3" height="5" fill="#eab308" />
  <!-- ボタン -->
  <rect x="8" y="25" width="3" height="1" fill="#67e8f9" />
  <rect x="12" y="25" width="3" height="1" fill="#67e8f9" />
  <rect x="16" y="25" width="3" height="1" fill="#fca5a5" />
  <rect x="20" y="25" width="3" height="1" fill="#fca5a5" />

  <!-- ボトル列 2段目 -->
  <rect x="8" y="27" width="3" height="4" fill="#a855f7" />
  <rect x="12" y="27" width="3" height="4" fill="#f97316" />
  <rect x="16" y="27" width="3" height="4" fill="#06b6d4" />
  <rect x="20" y="27" width="3" height="4" fill="#ec4899" />

  <!-- コイン投入口 & おつりレバー -->
  <rect x="8" y="37" width="3" height="1" fill="#000" />
  <rect x="8" y="39" width="2" height="3" fill="#cbd5e1" />
  <rect x="14" y="37" width="8" height="4" fill="#0284c7" />

  <!-- 取り出し口 -->
  <rect x="6" y="44" width="20" height="6" fill="#0f172a" />
  <rect x="8" y="46" width="16" height="3" fill="#334155" />

  <!-- 足元スタンド -->
  <rect x="5" y="52" width="5" height="3" fill="#334155" />
  <rect x="22" y="52" width="5" height="3" fill="#334155" />
</svg>
`;

// 2. 電柱 (24x80)
const telegraphPoleSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 80" shape-rendering="crispEdges">
  <!-- 電柱本体（コンクリート柱） -->
  <rect x="10" y="4" width="4" height="74" fill="#94a3b8" />
  <rect x="10" y="4" width="1" height="74" fill="#cbd5e1" />
  <rect x="13" y="4" width="1" height="74" fill="#64748b" />
  
  <!-- 最上部アーム -->
  <rect x="2" y="8" width="20" height="2" fill="#475569" />
  <rect x="4" y="6" width="2" height="2" fill="#f8fafc" />
  <rect x="18" y="6" width="2" height="2" fill="#f8fafc" />
  
  <!-- トランス（変圧器・グレーの円筒） -->
  <rect x="6" y="16" width="12" height="14" fill="#475569" />
  <rect x="7" y="17" width="10" height="12" fill="#64748b" />
  <rect x="8" y="16" width="4" height="1" fill="#94a3b8" />
  
  <!-- 2段目アーム -->
  <rect x="4" y="34" width="16" height="2" fill="#475569" />
  <rect x="5" y="32" width="2" height="2" fill="#f8fafc" />
  <rect x="17" y="32" width="2" height="2" fill="#f8fafc" />

  <!-- 街灯アーム (黄色い光) -->
  <path d="M12 44 L18 44 L20 48" stroke="#334155" stroke-width="1" fill="none" />
  <rect x="18" y="48" width="4" height="3" fill="#fef08a" />

  <!-- 足元根元 -->
  <rect x="9" y="76" width="6" height="4" fill="#475569" />
</svg>
`;

// 3. レトロ街灯 (16x48)
const streetLampSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 48" shape-rendering="crispEdges">
  <!-- ポール -->
  <rect x="7" y="12" width="2" height="34" fill="#1e293b" />
  <rect x="7" y="12" width="1" height="34" fill="#334155" />
  <!-- ランプ笠 -->
  <polygon points="3,10 13,10 11,4 5,4" fill="#0f172a" />
  <!-- ランタン部 -->
  <rect x="5" y="8" width="6" height="5" fill="#fef08a" />
  <rect x="6" y="9" width="4" height="3" fill="#ffffff" />
  <!-- 土台 -->
  <rect x="5" y="44" width="6" height="3" fill="#0f172a" />
</svg>
`;

// 4. 木 (48x56)
const retroTreeSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 56" shape-rendering="crispEdges">
  <!-- 幹 -->
  <rect x="21" y="34" width="6" height="20" fill="#78350f" />
  <rect x="21" y="34" width="2" height="20" fill="#92400e" />
  <rect x="25" y="34" width="2" height="20" fill="#451a03" />
  
  <!-- 葉っぱ（レイヤー1: 暗い緑） -->
  <circle cx="24" cy="22" r="20" fill="#14532d" />
  <!-- 葉っぱ（レイヤー2: 中間緑） -->
  <circle cx="22" cy="19" r="16" fill="#15803d" />
  <!-- 葉っぱ（レイヤー3: 明るい緑） -->
  <circle cx="19" cy="15" r="11" fill="#22c55e" />
  <circle cx="27" cy="16" r="9" fill="#16a34a" />
  <!-- ハイライト -->
  <circle cx="17" cy="13" r="5" fill="#86efac" />
</svg>
`;

// 5. 木製ベンチ (36x24)
const retroBenchSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 24" shape-rendering="crispEdges">
  <!-- 背もたれ板 -->
  <rect x="4" y="4" width="28" height="4" fill="#b45309" />
  <rect x="4" y="4" width="28" height="1" fill="#d97706" />
  <rect x="4" y="9" width="28" height="4" fill="#b45309" />
  <rect x="4" y="9" width="28" height="1" fill="#d97706" />

  <!-- 座面 -->
  <polygon points="2,14 34,14 32,18 4,18" fill="#92400e" />
  <line x1="2" y1="14" x2="34" y2="14" stroke="#d97706" stroke-width="1" />

  <!-- 脚 (アイアン) -->
  <rect x="6" y="16" width="2" height="7" fill="#1e293b" />
  <rect x="28" y="16" width="2" height="7" fill="#1e293b" />
</svg>
`;

// 6. 昭和レトロ駅名標 (40x36)
const stationSignSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 36" shape-rendering="crispEdges">
  <!-- 支柱 -->
  <rect x="8" y="18" width="2" height="17" fill="#64748b" />
  <rect x="30" y="18" width="2" height="17" fill="#64748b" />
  
  <!-- 看板フレーム -->
  <rect x="4" y="4" width="32" height="18" fill="#f8fafc" stroke="#334155" stroke-width="1" />
  <!-- 青帯 -->
  <rect x="5" y="17" width="30" height="3" fill="#0284c7" />
  <!-- 駅名もじ風 -->
  <rect x="12" y="8" width="16" height="5" fill="#0f172a" />
  <!-- ひらがな風下部 -->
  <rect x="14" y="14" width="12" height="2" fill="#475569" />
</svg>
`;

// 7. キャラクター: 高校生の女の子（制服・黒髪）(24x36)
const schoolgirlSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" shape-rendering="crispEdges">
  <!-- 影 (足元) -->
  <ellipse cx="12" cy="34" rx="7" ry="2" fill="rgba(0,0,0,0.3)" />

  <!-- 脚・ソックス・ローファー -->
  <rect x="9" y="27" width="2" height="5" fill="#fed7aa" />
  <rect x="13" y="27" width="2" height="5" fill="#fed7aa" />
  <rect x="9" y="29" width="2" height="4" fill="#1e293b" />
  <rect x="13" y="29" width="2" height="4" fill="#1e293b" />
  <rect x="8" y="33" width="3" height="2" fill="#78350f" />
  <rect x="13" y="33" width="3" height="2" fill="#78350f" />

  <!-- スカート (紺プリーツ) -->
  <polygon points="7,23 17,23 19,28 5,28" fill="#1e3a8a" />
  <rect x="9" y="23" width="1" height="5" fill="#172554" />
  <rect x="14" y="23" width="1" height="5" fill="#172554" />

  <!-- 上着（セーラー服 / 白シャツ） -->
  <rect x="8" y="16" width="8" height="7" fill="#ffffff" />
  <!-- セーラー襟（紺） & 赤スカーフ -->
  <polygon points="7,16 17,16 14,20 10,20" fill="#1e3a8a" />
  <polygon points="11,18 13,18 12,22" fill="#dc2626" />

  <!-- 腕 -->
  <rect x="6" y="17" width="2" height="7" fill="#fed7aa" />
  <rect x="16" y="17" width="2" height="7" fill="#fed7aa" />

  <!-- 顔・首 -->
  <rect x="11" y="14" width="2" height="2" fill="#fcd34d" />
  <rect x="8" y="8" width="8" height="7" fill="#fed7aa" />
  <!-- 目 (黒) -->
  <rect x="9" y="11" width="1" height="2" fill="#1e293b" />
  <rect x="14" y="11" width="1" height="2" fill="#1e293b" />
  <!-- ほっぺ (ピンク) -->
  <rect x="9" y="13" width="1" height="1" fill="#f43f5e" />
  <rect x="14" y="13" width="1" height="1" fill="#f43f5e" />

  <!-- 髪（黒髪ボブ・ハイライト） -->
  <rect x="7" y="5" width="10" height="4" fill="#0f172a" />
  <rect x="6" y="7" width="3" height="8" fill="#0f172a" />
  <rect x="15" y="7" width="3" height="8" fill="#0f172a" />
  <rect x="8" y="7" width="8" height="3" fill="#0f172a" />
  <rect x="9" y="6" width="6" height="1" fill="#334155" />
</svg>
`;

// 8. タイル: アスファルト道路 (32x32)
const asphaltTileSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges">
  <rect width="32" height="32" fill="#334155" />
  <rect x="4" y="6" width="2" height="2" fill="#475569" />
  <rect x="18" y="14" width="2" height="2" fill="#1e293b" />
  <rect x="26" y="24" width="2" height="2" fill="#475569" />
  <rect x="8" y="22" width="2" height="2" fill="#1e293b" />
</svg>
`;

// 9. タイル: 歩道敷石 (32x32)
const sidewalkTileSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges">
  <rect width="32" height="32" fill="#94a3b8" />
  <!-- タイル目地 -->
  <line x1="0" y1="16" x2="32" y2="16" stroke="#64748b" stroke-width="1" />
  <line x1="16" y1="0" x2="16" y2="16" stroke="#64748b" stroke-width="1" />
  <line x1="0" y1="32" x2="32" y2="32" stroke="#64748b" stroke-width="1" />
  <line x1="8" y1="16" x2="8" y2="32" stroke="#64748b" stroke-width="1" />
  <line x1="24" y1="16" x2="24" y2="32" stroke="#64748b" stroke-width="1" />
</svg>
`;

// 10. タイル: 芝生 (32x32)
const grassTileSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges">
  <rect width="32" height="32" fill="#15803d" />
  <rect x="6" y="8" width="2" height="3" fill="#16a34a" />
  <rect x="20" y="18" width="2" height="3" fill="#22c55e" />
  <rect x="12" y="24" width="2" height="2" fill="#166534" />
  <rect x="24" y="6" width="2" height="2" fill="#166534" />
</svg>
`;

export const DEFAULT_ASSETS: Record<string, AirasAsset> = {
  vending_machine_retro: {
    id: 'vending_machine_retro',
    name: '昭和レトロ自販機',
    type: 'object',
    category: 'furniture',
    sprite: {
      url: svgToUri(vendingMachineSvg),
      width: 32,
      height: 56,
      pixelArt: true,
    },
    anchor: { x: 16, y: 54 },
    collision: {
      enabled: true,
      type: 'box',
      offsetX: -14,
      offsetY: -12,
      width: 28,
      height: 12,
    },
    depth: { enabled: true, offsetY: 0 },
    interactions: [
      {
        type: 'buy',
        label: 'ジュースを買う',
        dialogue: ['ガコン！冷たい瓶コーラが出てきた！'],
      },
    ],
    metadata: {
      tags: ['昭和', 'レトロ', '自販機', '街並み'],
      createdAt: Date.now(),
      source: 'preset',
      description: 'ノスタルジックな赤の飲料自動販売機。',
    },
  },

  telegraph_pole: {
    id: 'telegraph_pole',
    name: '木造・コンクリート電柱',
    type: 'object',
    category: 'infrastructure',
    sprite: {
      url: svgToUri(telegraphPoleSvg),
      width: 24,
      height: 80,
      pixelArt: true,
    },
    anchor: { x: 12, y: 78 },
    collision: {
      enabled: true,
      type: 'box',
      offsetX: -6,
      offsetY: -8,
      width: 12,
      height: 8,
    },
    depth: { enabled: true, offsetY: 0 },
    metadata: {
      tags: ['電柱', 'インフラ', '昭和', 'レトロ'],
      createdAt: Date.now(),
      source: 'preset',
      description: '変圧器と碍子がついた電柱。',
    },
  },

  street_lamp_warm: {
    id: 'street_lamp_warm',
    name: 'ノスタルジック街灯',
    type: 'object',
    category: 'infrastructure',
    sprite: {
      url: svgToUri(streetLampSvg),
      width: 16,
      height: 48,
      pixelArt: true,
    },
    anchor: { x: 8, y: 46 },
    collision: {
      enabled: true,
      type: 'box',
      offsetX: -4,
      offsetY: -4,
      width: 8,
      height: 4,
    },
    depth: { enabled: true, offsetY: 0 },
    metadata: {
      tags: ['街灯', '夜景', '明かり'],
      createdAt: Date.now(),
      source: 'preset',
      description: '夜になると暖色の光を灯す街灯。',
    },
  },

  retro_tree: {
    id: 'retro_tree',
    name: '街路樹（ケヤキ）',
    type: 'object',
    category: 'nature',
    sprite: {
      url: svgToUri(retroTreeSvg),
      width: 48,
      height: 56,
      pixelArt: true,
    },
    anchor: { x: 24, y: 54 },
    collision: {
      enabled: true,
      type: 'box',
      offsetX: -6,
      offsetY: -8,
      width: 12,
      height: 8,
    },
    depth: { enabled: true, offsetY: 0 },
    metadata: {
      tags: ['木', '自然', '公園', '街路樹'],
      createdAt: Date.now(),
      source: 'preset',
      description: '温かい緑の木。',
    },
  },

  retro_bench: {
    id: 'retro_bench',
    name: '木製ベンチ',
    type: 'object',
    category: 'furniture',
    sprite: {
      url: svgToUri(retroBenchSvg),
      width: 36,
      height: 24,
      pixelArt: true,
    },
    anchor: { x: 18, y: 22 },
    collision: {
      enabled: true,
      type: 'box',
      offsetX: -16,
      offsetY: -10,
      width: 32,
      height: 10,
    },
    depth: { enabled: true, offsetY: 0 },
    interactions: [
      {
        type: 'sit',
        label: '座ってひと休み',
        dialogue: ['ベンチに座って心地よい風を感じた。'],
      },
    ],
    metadata: {
      tags: ['ベンチ', '公園', '休憩'],
      createdAt: Date.now(),
      source: 'preset',
      description: '駅前や商店街にぴったりの木製ベンチ。',
    },
  },

  station_sign: {
    id: 'station_sign',
    name: '国鉄風駅名標',
    type: 'object',
    category: 'infrastructure',
    sprite: {
      url: svgToUri(stationSignSvg),
      width: 40,
      height: 36,
      pixelArt: true,
    },
    anchor: { x: 20, y: 34 },
    collision: {
      enabled: true,
      type: 'box',
      offsetX: -16,
      offsetY: -6,
      width: 32,
      height: 6,
    },
    depth: { enabled: true, offsetY: 0 },
    interactions: [
      {
        type: 'inspect',
        label: '駅名標を読む',
        dialogue: ['「あいらす」駅。次の駅は「みらい」。'],
      },
    ],
    metadata: {
      tags: ['駅', '看板', '鉄道'],
      createdAt: Date.now(),
      source: 'preset',
      description: '「あいらす」と書かれた昭和レトロな駅看板。',
    },
  },

  character_schoolgirl: {
    id: 'character_schoolgirl',
    name: '女子高校生',
    type: 'character',
    category: 'npc',
    sprite: {
      url: svgToUri(schoolgirlSvg),
      width: 24,
      height: 36,
      pixelArt: true,
    },
    anchor: { x: 12, y: 34 },
    collision: {
      enabled: true,
      type: 'box',
      offsetX: -6,
      offsetY: -6,
      width: 12,
      height: 6,
    },
    depth: { enabled: true, offsetY: 0 },
    interactions: [
      {
        type: 'talk',
        label: '話しかける',
        dialogue: ['こんにちは！この街、なんだか懐かしい香りがするね。'],
      },
    ],
    metadata: {
      tags: ['NPC', '高校生', 'キャラクター'],
      createdAt: Date.now(),
      source: 'preset',
      description: '黒髪セーラー服の高校生NPC。',
    },
  },

  // タイル類
  tile_asphalt: {
    id: 'tile_asphalt',
    name: 'アスファルト道路',
    type: 'tile',
    category: 'tile',
    sprite: {
      url: svgToUri(asphaltTileSvg),
      width: 32,
      height: 32,
      pixelArt: true,
    },
    anchor: { x: 0, y: 0 },
    collision: { enabled: false, type: 'none', offsetX: 0, offsetY: 0, width: 0, height: 0 },
    depth: { enabled: false, offsetY: 0 },
    metadata: { tags: ['道路'], createdAt: Date.now(), source: 'preset' },
  },

  tile_sidewalk: {
    id: 'tile_sidewalk',
    name: '歩道敷石',
    type: 'tile',
    category: 'tile',
    sprite: {
      url: svgToUri(sidewalkTileSvg),
      width: 32,
      height: 32,
      pixelArt: true,
    },
    anchor: { x: 0, y: 0 },
    collision: { enabled: false, type: 'none', offsetX: 0, offsetY: 0, width: 0, height: 0 },
    depth: { enabled: false, offsetY: 0 },
    metadata: { tags: ['歩道'], createdAt: Date.now(), source: 'preset' },
  },

  tile_grass: {
    id: 'tile_grass',
    name: '草地',
    type: 'tile',
    category: 'tile',
    sprite: {
      url: svgToUri(grassTileSvg),
      width: 32,
      height: 32,
      pixelArt: true,
    },
    anchor: { x: 0, y: 0 },
    collision: { enabled: false, type: 'none', offsetX: 0, offsetY: 0, width: 0, height: 0 },
    depth: { enabled: false, offsetY: 0 },
    metadata: { tags: ['草地', '自然'], createdAt: Date.now(), source: 'preset' },
  },
};
