import { AirasWorldData, WorldChunk, WorldTile } from '../types/world';

export function createInitialWorld(): AirasWorldData {
  const tileSize = 32;
  const chunkSize = 16; // 16x16 タイル (512x512 px)

  // チャンク (0, 0) を作成
  // レトロ商店街 / 駅前通り風のマップ
  const tiles: WorldTile[][] = [];
  for (let y = 0; y < chunkSize; y++) {
    const row: WorldTile[] = [];
    for (let x = 0; x < chunkSize; x++) {
      let tileId = 'tile_grass';

      // y = 4..5: 北側の歩道
      if (y >= 4 && y <= 5) {
        tileId = 'tile_sidewalk';
      }
      // y = 6..9: 道路 (車道)
      else if (y >= 6 && y <= 9) {
        tileId = 'tile_asphalt';
      }
      // y = 10..11: 南側の歩道
      else if (y >= 10 && y <= 11) {
        tileId = 'tile_sidewalk';
      }
      // y = 12..15: 公園・緑地エリア
      else if (y >= 12) {
        tileId = 'tile_grass';
      }

      row.push({ tileId, elevation: 0 });
    }
    tiles.push(row);
  }

  const chunk00: WorldChunk = {
    cx: 0,
    cy: 0,
    tiles,
  };

  return {
    version: '0.1.0',
    id: 'retro_showa_town_01',
    name: 'あいらす昭和商店街',
    metadata: {
      createdAt: Date.now(),
      updatedAt: Date.now(),
      author: 'Airas World AI',
      description: 'どこか懐かしい、温かみのある昭和レトロな駅前通り。',
    },
    environment: {
      time: 16.5, // 16:30 (夕暮れの温かい光)
      timeSpeed: 0.1,
      weather: 'clear',
      ambientColor: '#fed7aa', // 暖色イエロー・オレンジ
    },
    map: {
      tileSize,
      chunkSize,
      chunks: {
        '0,0': chunk00,
      },
    },
    entities: {
      // 駅名標 (北側歩道西寄り)
      station_sign_1: {
        id: 'station_sign_1',
        assetId: 'station_sign',
        name: '駅名標「あいらす」',
        type: 'object',
        position: { x: 80, y: 150, z: 0 },
      },
      // 昭和レトロ赤い自販機
      vending_machine_1: {
        id: 'vending_machine_1',
        assetId: 'vending_machine_retro',
        name: '昭和レトロ自販機',
        type: 'object',
        position: { x: 160, y: 155, z: 0 },
      },
      // 電柱
      telegraph_pole_1: {
        id: 'telegraph_pole_1',
        assetId: 'telegraph_pole',
        name: '木造電柱',
        type: 'object',
        position: { x: 250, y: 158, z: 0 },
      },
      // 街灯
      street_lamp_1: {
        id: 'street_lamp_1',
        assetId: 'street_lamp_warm',
        name: 'レトロ街灯',
        type: 'object',
        position: { x: 380, y: 155, z: 0 },
      },
      // 南側歩道のベンチ
      bench_1: {
        id: 'bench_1',
        assetId: 'retro_bench',
        name: '木製ベンチ',
        type: 'object',
        position: { x: 180, y: 340, z: 0 },
      },
      // 公園の木々
      tree_1: {
        id: 'tree_1',
        assetId: 'retro_tree',
        name: 'ケヤキの木',
        type: 'object',
        position: { x: 100, y: 420, z: 0 },
      },
      tree_2: {
        id: 'tree_2',
        assetId: 'retro_tree',
        name: 'ケヤキの木',
        type: 'object',
        position: { x: 320, y: 440, z: 0 },
      },
      // 歩道のNPC女子高校生
      npc_schoolgirl_1: {
        id: 'npc_schoolgirl_1',
        assetId: 'character_schoolgirl',
        name: '女子生徒（あおい）',
        type: 'npc',
        position: { x: 230, y: 345, z: 0 },
      },
    },
    player: {
      id: 'player_main',
      name: '旅人',
      assetId: 'character_schoolgirl', // プロトタイプでは同モデル
      position: { x: 240, y: 250, z: 0 }, // 道路中央
      direction: 'down',
      isMoving: false,
      speed: 120, // px per sec
    },
  };
}
