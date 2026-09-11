import { AirasWorldData, WorldChunk, WorldTile } from '../types/world';

export function createInitialWorld(): AirasWorldData {
  const tileSize = 32;
  const chunkSize = 16;
  // 48x32 タイル (3x2 チャンク構成)
  const mapWidthTiles = 48;
  const mapHeightTiles = 32;

  const chunks: Record<string, WorldChunk> = {};

  // 3x2 のチャンクを生成
  for (let cy = 0; cy < 2; cy++) {
    for (let cx = 0; cx < 3; cx++) {
      const tiles: WorldTile[][] = [];

      for (let localY = 0; localY < chunkSize; localY++) {
        const row: WorldTile[] = [];
        const globalY = cy * chunkSize + localY;

        for (let localX = 0; localX < chunkSize; localX++) {
          const globalX = cx * chunkSize + localX;
          let tileId = 'tile_grass';

          // y = 2..3: 線路
          if (globalY >= 2 && globalY <= 3) {
            tileId = 'tile_rail';
          }
          // y = 4..6: プラットホーム・駅前敷石
          else if (globalY >= 4 && globalY <= 6) {
            tileId = 'tile_sidewalk';
          }
          // y = 7..10: 北側商店街歩道
          else if (globalY >= 7 && globalY <= 10) {
            tileId = 'tile_sidewalk';
          }
          // y = 11..16: 車道 (アスファルト)
          else if (globalY >= 11 && globalY <= 16) {
            tileId = 'tile_asphalt';
          }
          // y = 17..19: 南側歩道
          else if (globalY >= 17 && globalY <= 19) {
            tileId = 'tile_sidewalk';
          }
          // y = 20..31: 公園・緑地 & 清流（川）
          else if (globalY >= 20) {
            // x = 34..37: 公園を縦断する清流（川）
            if (globalX >= 34 && globalX <= 37) {
              // y = 24..25 は木橋
              if (globalY >= 24 && globalY <= 25) {
                tileId = 'tile_sidewalk';
              } else {
                tileId = 'tile_water';
              }
            } else {
              tileId = 'tile_grass';
            }
          }

          row.push({ tileId, elevation: 0 });
        }
        tiles.push(row);
      }

      chunks[`${cx},${cy}`] = { cx, cy, tiles };
    }
  }

  return {
    version: '0.2.0',
    id: 'retro_showa_metropolis_01',
    name: 'あいらす昭和町（大通・駅前商店街・公園）',
    metadata: {
      createdAt: Date.now(),
      updatedAt: Date.now(),
      author: 'Airas World AI',
      description: '駅舎、線路、純喫茶、赤い自販機、噴水公園が広がる広大な昭和レトロタウン。',
    },
    environment: {
      time: 16.5, // 16:30 夕暮れ
      timeSpeed: 0.05,
      weather: 'sunset', // 夕暮れの美しいノスタルジー
      ambientColor: '#fed7aa',
    },
    map: {
      tileSize,
      chunkSize,
      chunks,
    },
    entities: {
      // 1. 北側エリア: 木造駅舎 & 駅名標
      station_building_1: {
        id: 'station_building_1',
        assetId: 'retro_station',
        name: '国鉄風木造駅舎',
        type: 'building',
        position: { x: 380, y: 175, z: 0 },
      },
      station_sign_1: {
        id: 'station_sign_1',
        assetId: 'station_sign',
        name: '駅名標「あいらす」',
        type: 'object',
        position: { x: 260, y: 185, z: 0 },
      },
      station_sign_2: {
        id: 'station_sign_2',
        assetId: 'station_sign',
        name: '駅名標「あいらす（2番線）」',
        type: 'object',
        position: { x: 580, y: 185, z: 0 },
      },

      // 2. 商店街北側: 昭和純喫茶 & 自販機 & 電柱列 & 街灯
      cafe_1: {
        id: 'cafe_1',
        assetId: 'retro_cafe',
        name: '昭和純喫茶「あいらす」',
        type: 'building',
        position: { x: 620, y: 310, z: 0 },
      },
      vending_machine_1: {
        id: 'vending_machine_1',
        assetId: 'vending_machine_retro',
        name: '昭和レトロ自販機（駅前店）',
        type: 'object',
        position: { x: 280, y: 320, z: 0 },
      },
      vending_machine_2: {
        id: 'vending_machine_2',
        assetId: 'vending_machine_retro',
        name: '昭和レトロ自販機（喫茶横）',
        type: 'object',
        position: { x: 700, y: 320, z: 0 },
      },
      pole_1: {
        id: 'pole_1',
        assetId: 'telegraph_pole',
        name: '木造電柱 1号',
        type: 'object',
        position: { x: 180, y: 325, z: 0 },
      },
      pole_2: {
        id: 'pole_2',
        assetId: 'telegraph_pole',
        name: '木造電柱 2号',
        type: 'object',
        position: { x: 480, y: 325, z: 0 },
      },
      pole_3: {
        id: 'pole_3',
        assetId: 'telegraph_pole',
        name: '木造電柱 3号',
        type: 'object',
        position: { x: 820, y: 325, z: 0 },
      },
      lamp_1: {
        id: 'lamp_1',
        assetId: 'street_lamp_warm',
        name: 'レトロ街灯（駅前通り）',
        type: 'object',
        position: { x: 360, y: 320, z: 0 },
      },
      lamp_2: {
        id: 'lamp_2',
        assetId: 'street_lamp_warm',
        name: 'レトロ街灯（中央通り）',
        type: 'object',
        position: { x: 740, y: 320, z: 0 },
      },

      // 2.5 車道中央: 黄色いランボルギーニ・ウラカン (スーパーカー)
      lamborghini_1: {
        id: 'lamborghini_1',
        assetId: 'vehicle_lamborghini',
        name: '黄色いランボルギーニ',
        type: 'object',
        position: { x: 550, y: 480, z: 0 },
      },

      // 3. 商店街南側: ベンチ & 街路樹
      bench_south_1: {
        id: 'bench_south_1',
        assetId: 'retro_bench',
        name: '木製ベンチ（商店街通り）',
        type: 'object',
        position: { x: 420, y: 590, z: 0 },
      },
      bench_south_2: {
        id: 'bench_south_2',
        assetId: 'retro_bench',
        name: '木製ベンチ（商店街東）',
        type: 'object',
        position: { x: 780, y: 590, z: 0 },
      },
      tree_street_1: {
        id: 'tree_street_1',
        assetId: 'retro_tree',
        name: 'ケヤキ並木 1',
        type: 'object',
        position: { x: 260, y: 595, z: 0 },
      },
      tree_street_2: {
        id: 'tree_street_2',
        assetId: 'retro_tree',
        name: 'ケヤキ並木 2',
        type: 'object',
        position: { x: 600, y: 595, z: 0 },
      },

      // 4. 南側大公園: 噴水 & 芝生 & ケヤキ大木 & 猫 & ベンチ
      fountain_park: {
        id: 'fountain_park',
        assetId: 'park_fountain',
        name: '公園中央の石造り噴水',
        type: 'object',
        position: { x: 500, y: 800, z: 0 },
      },
      cat_1: {
        id: 'cat_1',
        assetId: 'npc_cat',
        name: '三毛猫（ミケ）',
        type: 'npc',
        position: { x: 535, y: 810, z: 0 },
      },
      tree_park_1: {
        id: 'tree_park_1',
        assetId: 'retro_tree',
        name: '公園のケヤキ大木',
        type: 'object',
        position: { x: 300, y: 780, z: 0 },
      },
      tree_park_2: {
        id: 'tree_park_2',
        assetId: 'retro_tree',
        name: '木漏れ日のケヤキ',
        type: 'object',
        position: { x: 720, y: 790, z: 0 },
      },
      bench_park_1: {
        id: 'bench_park_1',
        assetId: 'retro_bench',
        name: '噴水前の特等席ベンチ',
        type: 'object',
        position: { x: 430, y: 840, z: 0 },
      },

      // 5. NPC女子高校生
      npc_schoolgirl_1: {
        id: 'npc_schoolgirl_1',
        assetId: 'character_schoolgirl',
        name: '女子生徒（あおい）',
        type: 'npc',
        position: { x: 460, y: 585, z: 0 },
      },

      // 6. マイホーム・リラックス用ダブルベッド（川沿い）
      bed_home_1: {
        id: 'bed_home_1',
        assetId: 'furniture_bed_double',
        name: 'ふかふかダブルベッド',
        type: 'object',
        position: { x: 920, y: 780, z: 0 },
      },
    },
    player: {
      id: 'player_main',
      name: '旅人',
      assetId: 'character_schoolgirl',
      position: { x: 480, y: 480, z: 0 }, // 車道中央・商店街
      vz: 0,
      direction: 'down',
      isMoving: false,
      isJumping: false,
      isSprinting: false,
      isSneaking: false,
      speed: 130,
    },
  };
}
