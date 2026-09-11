import sharp from 'sharp';
import path from 'path';

const imgPath = 'nanobanana/Gemini_Generated_Image_1t7j351t7j351t7j.jpg';
const outDir = 'public/assets/buildings';

// station_wooden の下端の駄菓子屋屋根のゴミが入らないよう maxY を 795 に設定
const b = { minX: 69, minY: 109, maxX: 1229, maxY: 795 };
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

for (let y = 0; y < cH; y++) {
  for (let x = 0; x < cW; x++) {
    const idx = (y * cW + x) * 4;
    const r = rawData[idx];
    const g = rawData[idx + 1];
    const b = rawData[idx + 2];

    const isMagentaPure = (r > 165 && b > 165 && g < 80);
    const isMagentaEdge = (r > 140 && b > 140 && g < 110 && (r + b) > g * 2.8);

    if (isMagentaPure) {
      rawData[idx + 3] = 0;
    } else if (isMagentaEdge) {
      const diff = (r + b) / 2 - g;
      if (diff > 80) {
        const factor = Math.max(0, Math.min(1, (160 - diff) / 80));
        rawData[idx + 3] = Math.round(255 * factor);
      }
    }
  }
}

const outPath = path.join(outDir, 'station_wooden.png');
await sharp(rawData, {
  raw: { width: cW, height: cH, channels: 4 }
}).png().toFile(outPath);

console.log(`Updated: ${outPath} (${cW}x${cH}px)`);
