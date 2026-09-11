import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const imgPath = 'nanobanana/Gemini_Generated_Image_lakgjylakgjylakg.jpg';
const { data, info } = await sharp(imgPath).raw().toBuffer({ resolveWithObject: true });
console.log(`Image: ${info.width}x${info.height}, channels: ${info.channels}`);

const W = info.width;
const H = info.height;
const C = info.channels;

// 4段 x 4列の各グリッドの非白色ピクセルbounding boxを測定
const rows = 4;
const cols = 4;
const cellW = Math.floor(W / cols);
const cellH = Math.floor(H / rows);

const isBg = (r, g, b) => r > 235 && g > 235 && b > 235;

for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    const startX = c * cellW;
    const endX = (c + 1) * cellW;
    const startY = r * cellH;
    const endY = (r + 1) * cellH;

    let minX = endX, minY = endY, maxX = startX, maxY = startY;
    let nonBgCount = 0;

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const idx = (y * W + x) * C;
        const red = data[idx], green = data[idx+1], blue = data[idx+2];
        if (!isBg(red, green, blue)) {
          nonBgCount++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (nonBgCount > 1000) {
      console.log(`Cell [${r}, ${c}]: bounds=(${minX}, ${minY}) - (${maxX}, ${maxY}), size=${maxX - minX + 1}x${maxY - minY + 1}, pixels=${nonBgCount}`);
    } else {
      console.log(`Cell [${r}, ${c}]: empty (${nonBgCount} pixels)`);
    }
  }
}
