import sharp from 'sharp';
import fs from 'fs';

const imgPath = 'nanobanana/Gemini_Generated_Image_1t7j351t7j351t7j.jpg';
const { data, info } = await sharp(imgPath).raw().toBuffer({ resolveWithObject: true });
console.log(`Image: ${info.width}x${info.height}, channels: ${info.channels}`);

const W = info.width;
const H = info.height;
const C = info.channels;

// マゼンタ背景判定: Rが高く、Gが低く、Bが高い
const isMagenta = (r, g, b) => r > 180 && g < 80 && b > 180;

// おおよその対象領域をスキャンしてタイトなバウンディングボックスを取得
const searchBoxes = {
  station: { x1: 0, y1: 0, x2: Math.floor(W * 0.45), y2: Math.floor(H * 0.55) },
  cafe:    { x1: Math.floor(W * 0.45), y1: 0, x2: W, y2: Math.floor(H * 0.58) },
  dagashi: { x1: 0, y1: Math.floor(H * 0.50), x2: Math.floor(W * 0.40), y2: H },
  vending1:{ x1: Math.floor(W * 0.38), y1: Math.floor(H * 0.60), x2: Math.floor(W * 0.51), y2: H },
  vending2:{ x1: Math.floor(W * 0.50), y1: Math.floor(H * 0.60), x2: Math.floor(W * 0.61), y2: H },
  vending3:{ x1: Math.floor(W * 0.60), y1: Math.floor(H * 0.60), x2: Math.floor(W * 0.71), y2: H },
  vending4:{ x1: Math.floor(W * 0.70), y1: Math.floor(H * 0.60), x2: Math.floor(W * 0.83), y2: H },
  phonebox:{ x1: Math.floor(W * 0.83), y1: Math.floor(H * 0.55), x2: W, y2: H },
};

for (const [name, box] of Object.entries(searchBoxes)) {
  let minX = box.x2, minY = box.y2, maxX = box.x1, maxY = box.y1;
  let nonBgCount = 0;

  for (let y = box.y1; y < box.y2; y++) {
    for (let x = box.x1; x < box.x2; x++) {
      const idx = (y * W + x) * C;
      const r = data[idx], g = data[idx+1], b = data[idx+2];
      if (!isMagenta(r, g, b)) {
        nonBgCount++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  console.log(`${name}: bounds=(${minX}, ${minY}) - (${maxX}, ${maxY}), size=${maxX - minX + 1}x${maxY - minY + 1}, pixels=${nonBgCount}`);
}
