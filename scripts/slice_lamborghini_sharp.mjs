import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const imgPath = 'nanobanana/Gemini_Generated_Image_lakgjylakgjylakg.jpg';
const outDir = 'public/assets/vehicles';

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 測定された各方向のセルバウンディングボックス
const mappings = [
  { key: 'down',       bounds: { minX: 30, minY: 46, maxX: 378, maxY: 299 } },
  { key: 'up',         bounds: { minX: 1006, minY: 46, maxX: 1369, maxY: 301 } },
  { key: 'right',      bounds: { minX: 1432, minY: 54, maxX: 2094, maxY: 303 } },
  { key: 'left',       bounds: { minX: 23, minY: 439, maxX: 687, maxY: 682 } },
  { key: 'down_left',  bounds: { minX: 39, minY: 782, maxX: 661, maxY: 1140 } },
  { key: 'down_right', bounds: { minX: 1448, minY: 782, maxX: 2071, maxY: 1140 } },
  { key: 'up_right',   bounds: { minX: 2155, minY: 782, maxX: 2778, maxY: 1139 } },
  { key: 'up_left',    bounds: { minX: 35, minY: 1175, maxX: 664, maxY: 1521 } },
];

for (const item of mappings) {
  const b = item.bounds;
  const pad = 2;
  const left = Math.max(0, b.minX - pad);
  const top = Math.max(0, b.minY - pad);
  const width = b.maxX - b.minX + 1 + pad * 2;
  const height = b.maxY - b.minY + 1 + pad * 2;

  // 1. クロップして生RGBAバッファを取得
  const cropped = await sharp(imgPath)
    .extract({ left, top, width, height })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rawData = cropped.data;
  const cW = cropped.info.width;
  const cH = cropped.info.height;

  // 2. 白背景を透明化 (RGB各値が232以上のピクセルを透過、220〜232は滑らかにフェード)
  for (let y = 0; y < cH; y++) {
    for (let x = 0; x < cW; x++) {
      const idx = (y * cW + x) * 4;
      const r = rawData[idx];
      const g = rawData[idx + 1];
      const b = rawData[idx + 2];

      const brightness = (r + g + b) / 3;
      const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(b - r));

      // 白〜明るいグレー（かつ色差が少ない）ピクセルを透過
      if (brightness > 235 && maxDiff < 18) {
        rawData[idx + 3] = 0;
      } else if (brightness > 220 && maxDiff < 14) {
        const factor = (235 - brightness) / 15;
        rawData[idx + 3] = Math.round(255 * Math.max(0, Math.min(1, factor)));
      }
    }
  }

  // 3. PNGとして出力
  const outPath = path.join(outDir, `lamborghini_${item.key}.png`);
  await sharp(rawData, {
    raw: {
      width: cW,
      height: cH,
      channels: 4,
    }
  }).png().toFile(outPath);

  console.log(`Exported ${item.key}: ${outPath} (${cW}x${cH}px)`);
}

console.log('Finished exporting all 8 directions!');
