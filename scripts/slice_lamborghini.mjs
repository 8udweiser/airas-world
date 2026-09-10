import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// thorium_reviewer.mjs の ThoriumController を使用
const reviewerPath = 'C:/Applications/Antigravity_Portable/Data/.gemini/config/skills/thorium-reviewer/scripts/thorium_reviewer.mjs';
const { ThoriumController } = await import(pathToFileURL(reviewerPath).href);

async function sliceLamborghini() {
  const jpgPath = path.resolve(rootDir, 'nanobanana/Gemini_Generated_Image_ysgf00ysgf00ysgf.jpg');
  const base64Jpg = fs.readFileSync(jpgPath).toString('base64');
  const dataUrl = `data:image/jpeg;base64,${base64Jpg}`;

  const controller = new ThoriumController();
  await controller.connect();
  console.log('Connected to Thorium browser.');

  const browserCode = `
    (async () => {
      const src = "${dataUrl}";
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = src;
      });

      const W = img.width;
      const H = img.height;

      const mainCanvas = document.createElement('canvas');
      mainCanvas.width = W;
      mainCanvas.height = H;
      const mainCtx = mainCanvas.getContext('2d');
      mainCtx.drawImage(img, 0, 0);
      const imgData = mainCtx.getImageData(0, 0, W, H);
      const data = imgData.data;

      // 領域定義
      // 上段: 正面(0〜30%), 背面(28〜52%), 左向き(52〜100%)
      // 下段: 右向き(0〜52%)
      const regions = {
        down: { x1: 0.02, y1: 0.15, x2: 0.28, y2: 0.50 },   // 正面 (down)
        up: { x1: 0.27, y1: 0.15, x2: 0.52, y2: 0.50 },     // 背面 (up)
        left: { x1: 0.52, y1: 0.15, x2: 0.98, y2: 0.50 },   // 左向き (left)
        right: { x1: 0.02, y1: 0.52, x2: 0.50, y2: 0.85 },  // 右向き (right)
      };

      const isBackground = (r, g, b) => r > 230 && g > 230 && b > 230;
      const results = {};

      for (const [dir, box] of Object.entries(regions)) {
        const startX = Math.floor(box.x1 * W);
        const endX = Math.floor(box.x2 * W);
        const startY = Math.floor(box.y1 * H);
        const endY = Math.floor(box.y2 * H);

        let minX = endX, minY = endY, maxX = startX, maxY = startY;

        for (let y = startY; y < endY; y++) {
          for (let x = startX; x < endX; x++) {
            const idx = (y * W + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            if (!isBackground(r, g, b)) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        const cropW = Math.max(10, maxX - minX + 1);
        const cropH = Math.max(10, maxY - minY + 1);

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

            if (isBackground(r, g, b)) {
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
        };
      }

      return results;
    })()
  `;

  console.log('Executing browser crop & transparency...');
  const results = await controller.evaluate(browserCode);
  controller.close();

  const outDir = path.resolve(rootDir, 'public/assets/vehicles');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (const [dir, info] of Object.entries(results)) {
    const base64Data = info.pngDataUrl.replace(/^data:image\/png;base64,/, '');
    const filePath = path.resolve(outDir, `lamborghini_${dir}.png`);
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
    console.log(`Saved ${dir}: ${filePath} (${info.width}x${info.height}px)`);
  }

  console.log('All 4 Lamborghini directions successfully created!');
}

sliceLamborghini().catch(console.error);
