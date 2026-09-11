import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const imgPath = 'nanobanana/Gemini_Generated_Image_1t7j351t7j351t7j.jpg';
const outDir = 'public/assets/buildings';

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 各オブジェクトの精密な抽出領域
const targets = [
  { name: 'station_wooden',       bounds: { minX: 69, minY: 109, maxX: 1229, maxY: 843 } },
  { name: 'cafe_retro',           bounds: { minX: 1412, minY: 101, maxX: 2478, maxY: 826 } },
  { name: 'dagashi_shop',         bounds: { minX: 107, minY: 833, maxX: 1056, maxY: 1451 } },
  { name: 'vending_machine_retro_1', bounds: { minX: 1194, minY: 1026, maxX: 1425, maxY: 1442 } },
  { name: 'vending_machine_retro_2', bounds: { minX: 1470, minY: 1001, maxX: 1716, maxY: 1442 } },
  { name: 'vending_machine_retro_3', bounds: { minX: 1740, minY: 1011, maxX: 1998, maxY: 1442 } },
  { name: 'vending_machine_retro_4', bounds: { minX: 2040, minY: 1019, maxX: 2293, maxY: 1446 } },
  { name: 'phone_booth_retro',    bounds: { minX: 2455, minY: 945, maxX: 2700, maxY: 1470 } },
];

for (const item of targets) {
  const b = item.bounds;
  const pad = 2;
  const left = Math.max(0, b.minX - pad);
  const top = Math.max(0, b.minY - pad);
  const width = b.maxX - b.minX + 1 + pad * 2;
  const height = b.maxY - b.minY + 1 + pad * 2;

  const cropped = await sharp(imgPath)
    .extract({ left, top, width, height })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rawData = cropped.data;
  const cW = cropped.info.width;
  const cH = cropped.info.height;

  // マゼンタ背景の透過処理
  for (let y = 0; y < cH; y++) {
    for (let x = 0; x < cW; x++) {
      const idx = (y * cW + x) * 4;
      const r = rawData[idx];
      const g = rawData[idx + 1];
      const b = rawData[idx + 2];

      // マゼンタ判定: 赤と青が強く、緑が極端に低い
      const isMagentaPure = (r > 165 && b > 165 && g < 80);
      const isMagentaEdge = (r > 140 && b > 140 && g < 110 && (r + b) > g * 2.8);

      if (isMagentaPure) {
        rawData[idx + 3] = 0;
      } else if (isMagentaEdge) {
        // アンチエイリアス境界のブレンド
        const diff = (r + b) / 2 - g;
        if (diff > 80) {
          const factor = Math.max(0, Math.min(1, (160 - diff) / 80));
          rawData[idx + 3] = Math.round(255 * factor);
        }
      }
    }
  }

  // PNGとして書き出し
  const outPath = path.join(outDir, `${item.name}.png`);
  await sharp(rawData, {
    raw: {
      width: cW,
      height: cH,
      channels: 4,
    }
  }).png().toFile(outPath);

  console.log(`Saved: ${outPath} (${cW}x${cH}px)`);
}

console.log('All retro buildings successfully exported!');
