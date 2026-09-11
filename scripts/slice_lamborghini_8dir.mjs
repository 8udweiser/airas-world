import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const reviewerPath = 'C:/Applications/Antigravity_Portable/Data/.gemini/config/skills/thorium-reviewer/scripts/thorium_reviewer.mjs';
const { ThoriumController } = await import(pathToFileURL(reviewerPath).href);

async function main() {
  const controller = new ThoriumController();
  await controller.connect();

  const carJpg = fs.readFileSync(path.resolve(rootDir, 'nanobanana/Gemini_Generated_Image_lakgjylakgjylakg.jpg')).toString('base64');

  const script = `
    (async () => {
      const img = new Image();
      await new Promise(r => { img.onload = r; img.src = 'data:image/jpeg;base64,' + ${JSON.stringify(carJpg)}; });
      const W = img.width;
      const H = img.height;
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, W, H).data;

      const isBg = (r, g, b) => r > 240 && g > 240 && b > 240;

      // 8方向の各セルの探索範囲（正規化座標 0.0〜1.0）
      // [row, col] の大まかなバウンディングボックスから非背景のタイトなバウンディングボックスを検出
      const targets = {
        'down':       { x1: 0.00, y1: 0.00, x2: 0.25, y2: 0.25 }, // 1段目 左 (正面)
        'up':         { x1: 0.30, y1: 0.00, x2: 0.52, y2: 0.25 }, // 1段目 中央 (背面)
        'right':      { x1: 0.50, y1: 0.00, x2: 0.75, y2: 0.25 }, // 1段目 右1 (右向き)
        'left':       { x1: 0.00, y1: 0.25, x2: 0.25, y2: 0.50 }, // 2段目 左1 (左向き)
        'down-left':  { x1: 0.00, y1: 0.50, x2: 0.25, y2: 0.75 }, // 3段目 左1 (左下)
        'down-right': { x1: 0.50, y1: 0.50, x2: 0.75, y2: 0.75 }, // 3段目 右1 (右下)
        'up-left':    { x1: 0.00, y1: 0.75, x2: 0.25, y2: 1.00 }, // 4段目 左1 (左上)
        'up-right':   { x1: 0.75, y1: 0.50, x2: 1.00, y2: 0.75 }, // 3段目 右端 (右上)
      };

      const results = {};

      for (const [dir, box] of Object.entries(targets)) {
        const startX = Math.floor(box.x1 * W);
        const endX = Math.floor(box.x2 * W);
        const startY = Math.floor(box.y1 * H);
        const endY = Math.floor(box.y2 * H);

        let minX = endX, minY = endY, maxX = startX, maxY = startY;

        for (let y = startY; y < endY; y++) {
          for (let x = startX; x < endX; x++) {
            const idx = (y * W + x) * 4;
            const r = data[idx], g = data[idx+1], b = data[idx+2];
            if (!isBg(r, g, b)) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        // 余白を少し持たせる (padding 2px)
        minX = Math.max(0, minX - 2);
        minY = Math.max(0, minY - 2);
        maxX = Math.min(W - 1, maxX + 2);
        maxY = Math.min(H - 1, maxY + 2);

        const cropW = Math.max(1, maxX - minX + 1);
        const cropH = Math.max(1, maxY - minY + 1);

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = cropW;
        cropCanvas.height = cropH;
        const cropCtx = cropCanvas.getContext('2d');
        const cropImgData = cropCtx.createImageData(cropW, cropH);

        for (let y = 0; y < cropH; y++) {
          for (let x = 0; x < cropW; x++) {
            const srcIdx = ((minY + y) * W + (minX + x)) * 4;
            const destIdx = (y * cropW + x) * 4;

            const r = data[srcIdx];
            const g = data[srcIdx + 1];
            const b = data[srcIdx + 2];

            if (isBg(r, g, b)) {
              cropImgData.data[destIdx + 3] = 0;
            } else {
              cropImgData.data[destIdx] = r;
              cropImgData.data[destIdx + 1] = g;
              cropImgData.data[destIdx + 2] = b;
              cropImgData.data[destIdx + 3] = 255;
            }
          }
        }

        cropCtx.putImageData(cropImgData, 0, 0);
        results[dir] = {
          pngDataUrl: cropCanvas.toDataURL('image/png'),
          width: cropW,
          height: cropH,
          bbox: { minX, minY, maxX, maxY }
        };
      }

      return results;
    })()
  `;

  const results = await controller.evaluate(script);
  controller.close();

  const outDir = path.resolve(rootDir, 'public/assets/vehicles');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (const [dir, info] of Object.entries(results)) {
    const base64Data = info.pngDataUrl.replace(/^data:image\/png;base64,/, '');
    const filePath = path.resolve(outDir, `lamborghini_${dir}.png`);
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
    console.log(`Saved ${dir}: ${filePath} (${info.width}x${info.height}px, bbox:`, info.bbox, ')');
  }

  console.log('Successfully sliced all 8 directions!');
}

main().catch(console.error);
