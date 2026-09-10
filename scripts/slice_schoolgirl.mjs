import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const reviewerPath = 'C:/Applications/Antigravity_Portable/Data/.gemini/config/skills/thorium-reviewer/scripts/thorium_reviewer.mjs';
const { ThoriumController } = await import(pathToFileURL(reviewerPath).href);

async function sliceSchoolgirl() {
  const jpgPath = path.resolve(rootDir, 'nanobanana/Gemini_Generated_Image_5d6fol5d6fol5d6f選択肢A.jpg');
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

      // 領域定義 (グリッド線の内側を探索)
      const regions = {
        down: { x1: 0.02, y1: 0.03, x2: 0.23, y2: 0.47 },        // 上段1列目: 正面 (down)
        up: { x1: 0.27, y1: 0.03, x2: 0.48, y2: 0.47 },          // 上段2列目: 背面 (up)
        right: { x1: 0.52, y1: 0.03, x2: 0.73, y2: 0.47 },       // 上段3列目: 右側面 (right)
        down_right: { x1: 0.02, y1: 0.53, x2: 0.23, y2: 0.97 },  // 下段1列目: 斜め前 (down-right)
        up_right: { x1: 0.27, y1: 0.53, x2: 0.48, y2: 0.97 },    // 下段2列目: 斜め後 (up-right)
      };

      const isBackground = (r, g, b) => r > 240 && g > 240 && b > 240;
      const isGridLine = (r, g, b) => (Math.abs(r - g) < 5 && Math.abs(g - b) < 5 && r > 200 && r < 235);
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
            if (!isBackground(r, g, b) && !isGridLine(r, g, b)) {
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

            if (isBackground(r, g, b) || isGridLine(r, g, b)) {
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
          dataUrl: cropCanvas.toDataURL('image/png'),
          w: cropW,
          h: cropH
        };
      }

      // 水平反転生成: left = right の反転
      const flip = async (sourceDataUrl, w, h) => {
        const fc = document.createElement('canvas');
        fc.width = w;
        fc.height = h;
        const fCtx = fc.getContext('2d');
        const sImg = new Image();
        await new Promise((res, rej) => {
          sImg.onload = res;
          sImg.onerror = rej;
          sImg.src = sourceDataUrl;
        });
        fCtx.translate(w, 0);
        fCtx.scale(-1, 1);
        fCtx.drawImage(sImg, 0, 0);
        return fc.toDataURL('image/png');
      };

      // left
      results['left'] = {
        dataUrl: await flip(results['right'].dataUrl, results['right'].w, results['right'].h),
        w: results['right'].w,
        h: results['right'].h
      };

      // down_left
      results['down_left'] = {
        dataUrl: await flip(results['down_right'].dataUrl, results['down_right'].w, results['down_right'].h),
        w: results['down_right'].w,
        h: results['down_right'].h
      };

      // up_left
      results['up_left'] = {
        dataUrl: await flip(results['up_right'].dataUrl, results['up_right'].w, results['up_right'].h),
        w: results['up_right'].w,
        h: results['up_right'].h
      };

      return results;
    })()
  `;

  console.log('Evaluating slice and transparency in browser...');
  const res = await controller.evaluate(browserCode);
  controller.close();

  const outDir = path.resolve(rootDir, 'public/assets/characters');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  for (const [dir, item] of Object.entries(res)) {
    const pngPath = path.resolve(outDir, `schoolgirl_${dir}.png`);
    const base64Png = item.dataUrl.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(pngPath, Buffer.from(base64Png, 'base64'));
    console.log(`Saved: public/assets/characters/schoolgirl_${dir}.png (${item.w}x${item.h})`);
  }
  console.log('All 8 directions for Schoolgirl sliced & saved successfully!');
}

sliceSchoolgirl().catch(console.error);
