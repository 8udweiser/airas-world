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

      // 領域定義 (グリッド線の内側を正確に探索)
      // 注意: 画像内の下段1列目は「左斜め前 (down-left)」、下段2列目は「左斜め後 (up-left)」
      const regions = {
        down: { x1: 0.02, y1: 0.03, x2: 0.23, y2: 0.47 },        // 上段1列目: 正面 (down)
        up: { x1: 0.27, y1: 0.03, x2: 0.48, y2: 0.47 },          // 上段2列目: 背面 (up)
        right: { x1: 0.52, y1: 0.03, x2: 0.73, y2: 0.47 },       // 上段3列目: 右側面 (right)
        down_left: { x1: 0.02, y1: 0.53, x2: 0.23, y2: 0.97 },  // 下段1列目: 実質は左斜め前 (down-left)
        up_left: { x1: 0.27, y1: 0.53, x2: 0.48, y2: 0.97 },    // 下段2列目: 実質は左斜め後 (up-left)
      };

      const results = {};

      for (const [dir, box] of Object.entries(regions)) {
        const startX = Math.floor(box.x1 * W);
        const endX = Math.floor(box.x2 * W);
        const startY = Math.floor(box.y1 * H);
        const endY = Math.floor(box.y2 * H);

        const subW = endX - startX;
        const subH = endY - startY;

        // サブ領域のRGBAデータを抽出
        const subCanvas = document.createElement('canvas');
        subCanvas.width = subW;
        subCanvas.height = subH;
        const subCtx = subCanvas.getContext('2d');
        subCtx.drawImage(mainCanvas, startX, startY, subW, subH, 0, 0, subW, subH);
        const subImgData = subCtx.getImageData(0, 0, subW, subH);
        const subData = subImgData.data;

        // BFS 外側洪水充填 (Flood Fill) アルゴリズム
        // 外枠から接続する白〜淡色（JPEG圧縮ノイズ含む）をすべて背景としてマーク
        // キャラクター内部の「セーラー服の白い襟」等は外側と遮断されているため100%保護される
        const isBg = new Uint8Array(subW * subH);
        const queue = [];

        // 境界ピクセルをシードとして投入
        for (let x = 0; x < subW; x++) {
          queue.push(x, 0);
          queue.push(x, subH - 1);
        }
        for (let y = 1; y < subH - 1; y++) {
          queue.push(0, y);
          queue.push(subW - 1, y);
        }

        const isLightPixel = (r, g, b) => {
          // 明るい色（白・薄グレー・グリッド線）
          const avg = (r + g + b) / 3;
          if (avg > 185) return true;
          // グリッド線（グレー調）
          if (Math.abs(r - g) < 8 && Math.abs(g - b) < 8 && avg > 170) return true;
          return false;
        };

        let head = 0;
        while (head < queue.length) {
          const qx = queue[head++];
          const qy = queue[head++];
          const idx = qy * subW + qx;
          if (isBg[idx]) continue;

          const pIdx = idx * 4;
          const r = subData[pIdx];
          const g = subData[pIdx + 1];
          const b = subData[pIdx + 2];

          if (isLightPixel(r, g, b)) {
            isBg[idx] = 1;
            // 4近傍探索
            if (qx > 0 && !isBg[idx - 1]) queue.push(qx - 1, qy);
            if (qx < subW - 1 && !isBg[idx + 1]) queue.push(qx + 1, qy);
            if (qy > 0 && !isBg[idx - subW]) queue.push(qx, qy - 1);
            if (qy < subH - 1 && !isBg[idx + subW]) queue.push(qx, qy + 1);
          }
        }

        // デフリンジ（白フチ・色汚染の除去 pass）
        // 外側背景に隣接する半白ピクセル（JPEG圧縮による輪郭ボケ）を綺麗に除去
        for (let y = 0; y < subH; y++) {
          for (let x = 0; x < subW; x++) {
            const idx = y * subW + x;
            if (isBg[idx]) continue;

            const pIdx = idx * 4;
            const r = subData[pIdx];
            const g = subData[pIdx + 1];
            const b = subData[pIdx + 2];
            const avg = (r + g + b) / 3;

            // 背景と接しているかチェック
            const hasBgNeighbor = 
              (x > 0 && isBg[idx - 1]) ||
              (x < subW - 1 && isBg[idx + 1]) ||
              (y > 0 && isBg[idx - subW]) ||
              (y < subH - 1 && isBg[idx + subW]);

            if (hasBgNeighbor && avg > 165) {
              // 輪郭外側の圧縮フチと判定
              isBg[idx] = 1;
            }
          }
        }

        // キャラクター実寸バウンディングボックスの計算
        let minX = subW, minY = subH, maxX = 0, maxY = 0;
        for (let y = 0; y < subH; y++) {
          for (let x = 0; x < subW; x++) {
            const idx = y * subW + x;
            if (!isBg[idx]) {
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
            const srcIdx = (minY + y) * subW + (minX + x);
            const destIdx = (y * cropW + x) * 4;

            if (isBg[srcIdx]) {
              cropImgData.data[destIdx + 3] = 0; // 完全透明
            } else {
              cropImgData.data[destIdx] = subData[srcIdx * 4];
              cropImgData.data[destIdx + 1] = subData[srcIdx * 4 + 1];
              cropImgData.data[destIdx + 2] = subData[srcIdx * 4 + 2];
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

      // 水平反転生成
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

      // 左右ペアの生成
      // 1. right (東) ➜ 反転して left (西)
      results['left'] = {
        dataUrl: await flip(results['right'].dataUrl, results['right'].w, results['right'].h),
        w: results['right'].w,
        h: results['right'].h
      };

      // 2. down_left (南西) ➜ 反転して down_right (南東)
      results['down_right'] = {
        dataUrl: await flip(results['down_left'].dataUrl, results['down_left'].w, results['down_left'].h),
        w: results['down_left'].w,
        h: results['down_left'].h
      };

      // 3. up_left (北西) ➜ 反転して up_right (北東)
      results['up_right'] = {
        dataUrl: await flip(results['up_left'].dataUrl, results['up_left'].w, results['up_left'].h),
        w: results['up_left'].w,
        h: results['up_left'].h
      };

      return results;
    })();
  `;

  console.log('Extracting sprites with flood-fill & defringing in Thorium...');
  const results = await controller.evaluate(browserCode);
  controller.ws?.close();

  const outDir = path.resolve(rootDir, 'public/assets/characters');
  fs.mkdirSync(outDir, { recursive: true });

  const map = {
    down: 'schoolgirl_down.png',
    up: 'schoolgirl_up.png',
    right: 'schoolgirl_right.png',
    left: 'schoolgirl_left.png',
    down_right: 'schoolgirl_down_right.png',
    down_left: 'schoolgirl_down_left.png',
    up_right: 'schoolgirl_up_right.png',
    up_left: 'schoolgirl_up_left.png',
  };

  for (const [key, filename] of Object.entries(map)) {
    const item = results[key];
    if (item && item.dataUrl) {
      const base64Data = item.dataUrl.replace(/^data:image\/png;base64,/, '');
      const filePath = path.join(outDir, filename);
      fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
      console.log(`Saved: ${filename} (${item.w}x${item.h})`);
    } else {
      console.warn(`Missing direction: ${key}`);
    }
  }

  console.log('All 8 directions sliced, defringed, and saved successfully!');
}

sliceSchoolgirl().catch(console.error);
