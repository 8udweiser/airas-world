import { AirasAsset } from '../../core/types/asset';

export interface SpriteSheetConvertOptions {
  name: string;
  type: 'character' | 'vehicle' | 'object';
  promptUsed: string;
  // 分割レイアウト ('horizontal_5': 5方向->8方向自動補完, 'horizontal_3': 正面/背面/右側面 -> 左側面自動反転, 'horizontal_4': 正面/背面/左/右, 'grid_2x2': 2x2)
  layout?: 'horizontal_5' | 'horizontal_3' | 'horizontal_4' | 'grid_2x2';
}

export class AssetConverter {
  /**
   * 画像URL/Base64から背景を自動透明化し、Airas Asset形式へ変換する (単一オブジェクト用)
   */
  public static async convertToAirasAsset(
    imageUrl: string,
    name: string,
    promptUsed: string
  ): Promise<AirasAsset> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      if (!imageUrl.startsWith('data:')) {
        img.crossOrigin = 'anonymous';
      }

      img.onload = () => {
        try {
          const rawCanvas = document.createElement('canvas');
          rawCanvas.width = img.width;
          rawCanvas.height = img.height;
          const ctx = rawCanvas.getContext('2d');
          if (!ctx) throw new Error('Canvas 2D context not available');

          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, rawCanvas.width, rawCanvas.height);
          const data = imageData.data;

          // 1. 背景色判定 (四隅のピクセルをサンプリング)
          const bg = this.sampleBackgroundColor(data, rawCanvas.width, rawCanvas.height);

          // 2. 背景透過 & バウンディングボックス測定
          const bbox = this.makeTransparentAndMeasure(data, rawCanvas.width, rawCanvas.height, bg);
          ctx.putImageData(imageData, 0, 0);

          // 3. 余白をトリミングしたCanvasへコピー
          const trimmedWidth = Math.max(16, bbox.maxX - bbox.minX + 1);
          const trimmedHeight = Math.max(16, bbox.maxY - bbox.minY + 1);

          const trimmedCanvas = document.createElement('canvas');
          const targetHeight = Math.min(64, Math.max(32, trimmedHeight));
          const scale = targetHeight / trimmedHeight;
          const targetWidth = Math.round(trimmedWidth * scale);

          trimmedCanvas.width = targetWidth;
          trimmedCanvas.height = targetHeight;
          const trimmedCtx = trimmedCanvas.getContext('2d');
          if (trimmedCtx) {
            trimmedCtx.imageSmoothingEnabled = false;
            trimmedCtx.drawImage(
              rawCanvas,
              bbox.minX,
              bbox.minY,
              trimmedWidth,
              trimmedHeight,
              0,
              0,
              targetWidth,
              targetHeight
            );
          }

          const processedDataUrl = trimmedCanvas.toDataURL('image/png');
          const assetId = `ai_asset_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

          const footWidth = Math.round(targetWidth * 0.7);
          const footHeight = Math.max(8, Math.round(targetHeight * 0.2));

          const airasAsset: AirasAsset = {
            id: assetId,
            name: name || 'AI生成オブジェクト',
            type: 'object',
            category: 'furniture',
            sprite: {
              url: processedDataUrl,
              width: targetWidth,
              height: targetHeight,
              pixelArt: true,
            },
            anchor: {
              x: Math.round(targetWidth / 2),
              y: targetHeight,
            },
            collision: {
              enabled: true,
              type: 'box',
              offsetX: -Math.round(footWidth / 2),
              offsetY: -footHeight,
              width: footWidth,
              height: footHeight,
            },
            depth: {
              enabled: true,
              offsetY: 0,
            },
            interactions: [
              {
                type: 'inspect',
                label: '調べる (右クリック)',
                dialogue: [`【${name}】AIによって生成された特別なオブジェクトだ。`],
              },
            ],
            metadata: {
              tags: ['AI生成', 'カスタムアセット'],
              createdAt: Date.now(),
              source: 'ai_generated',
              promptUsed,
              description: `プロンプト「${promptUsed}」から自動生成されたAirasアセット。`,
            },
          };

          resolve(airasAsset);
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = () => reject(new Error('Failed to load image for asset conversion'));
      img.src = imageUrl;
    });
  }

  /**
   * 🌟 3方向スプライトシート（正面・背面・右側面）から自動透過＆右側面反転で4方向アセットを構築
   */
  public static async convertToSpriteSheetAsset(
    imageUrl: string,
    options: SpriteSheetConvertOptions
  ): Promise<AirasAsset> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      if (!imageUrl.startsWith('data:')) {
        img.crossOrigin = 'anonymous';
      }

      img.onload = () => {
        try {
          const rawCanvas = document.createElement('canvas');
          rawCanvas.width = img.width;
          rawCanvas.height = img.height;
          const ctx = rawCanvas.getContext('2d');
          if (!ctx) throw new Error('Canvas 2D context not available');

          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, rawCanvas.width, rawCanvas.height);
          const data = imageData.data;

          // 1. 背景色判定
          const bg = this.sampleBackgroundColor(data, rawCanvas.width, rawCanvas.height);

          // 2. 全体背景透過
          this.makeTransparentAndMeasure(data, rawCanvas.width, rawCanvas.height, bg);
          ctx.putImageData(imageData, 0, 0);

          // 3. 3分割スライシング (正面 = 0..W/3, 背面 = W/3..2W/3, 右側面 = 2W/3..W)
          const layout = options.layout || 'horizontal_3';
          const directionalUrls: Record<string, string> = {};

          if (layout === 'horizontal_5') {
            const slotW = Math.floor(rawCanvas.width / 5);
            const slotH = rawCanvas.height;

            // スロット0: 正面 (down)
            const downDataUrl = this.cropSlot(rawCanvas, 0 * slotW, 0, slotW, slotH);
            // スロット1: 背面 (up)
            const upDataUrl = this.cropSlot(rawCanvas, 1 * slotW, 0, slotW, slotH);
            // スロット2: 右側面 (right)
            const rightDataUrl = this.cropSlot(rawCanvas, 2 * slotW, 0, slotW, slotH);
            // スロット3: 斜め右前 (down-right)
            const downRightDataUrl = this.cropSlot(rawCanvas, 3 * slotW, 0, slotW, slotH);
            // スロット4: 斜め右後 (up-right)
            const upRightDataUrl = this.cropSlot(rawCanvas, 4 * slotW, 0, slotW, slotH);

            directionalUrls['down'] = downDataUrl;
            directionalUrls['up'] = upDataUrl;
            directionalUrls['right'] = rightDataUrl;
            directionalUrls['left'] = this.flipDataUrlHorizontally(rightDataUrl);
            directionalUrls['down-right'] = downRightDataUrl;
            directionalUrls['down-left'] = this.flipDataUrlHorizontally(downRightDataUrl);
            directionalUrls['up-right'] = upRightDataUrl;
            directionalUrls['up-left'] = this.flipDataUrlHorizontally(upRightDataUrl);
          } else if (layout === 'horizontal_3') {
            const slotW = Math.floor(rawCanvas.width / 3);
            const slotH = rawCanvas.height;

            // スロット0: 正面 (down)
            const downDataUrl = this.cropSlot(rawCanvas, 0 * slotW, 0, slotW, slotH);
            // スロット1: 背面 (up)
            const upDataUrl = this.cropSlot(rawCanvas, 1 * slotW, 0, slotW, slotH);
            // スロット2: 右側面 (right)
            const rightDataUrl = this.cropSlot(rawCanvas, 2 * slotW, 0, slotW, slotH);
            // 水平反転: 左側面 (left) - 右側面を反転して完全な対称性を保証！
            const leftDataUrl = this.flipDataUrlHorizontally(rightDataUrl);

            directionalUrls['down'] = downDataUrl;
            directionalUrls['up'] = upDataUrl;
            directionalUrls['right'] = rightDataUrl;
            directionalUrls['left'] = leftDataUrl;
          } else if (layout === 'horizontal_4') {
            const slotW = Math.floor(rawCanvas.width / 4);
            const slotH = rawCanvas.height;
            directionalUrls['down'] = this.cropSlot(rawCanvas, 0 * slotW, 0, slotW, slotH);
            directionalUrls['up'] = this.cropSlot(rawCanvas, 1 * slotW, 0, slotW, slotH);
            directionalUrls['left'] = this.cropSlot(rawCanvas, 2 * slotW, 0, slotW, slotH);
            directionalUrls['right'] = this.cropSlot(rawCanvas, 3 * slotW, 0, slotW, slotH);
          }

          const defaultUrl = directionalUrls['down'] || imageUrl;
          const assetId = `ai_${options.type}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

          // 4. アセットタイプに応じた設定
          let airasAsset: AirasAsset;

          if (options.type === 'vehicle') {
            const isBike = Boolean((options.name || '').match(/自転車|バイク|チャリ|bike|bicycle/i));
            const vWidth = isBike ? 48 : 64;
            const vHeight = isBike ? 32 : 40;
            airasAsset = {
              id: assetId,
              name: options.name || (isBike ? 'AI自転車' : 'AIスーパーカー'),
              type: 'object',
              category: 'vehicle',
              sprite: {
                url: defaultUrl,
                width: vWidth,
                height: vHeight,
                pixelArt: true,
                directionalUrls,
              },
              anchor: { x: Math.round(vWidth / 2), y: vHeight - 2 },
              collision: {
                enabled: true,
                type: 'box',
                offsetX: isBike ? -18 : -26,
                offsetY: isBike ? -8 : -14,
                width: isBike ? 36 : 52,
                height: isBike ? 14 : 18,
              },
              depth: { enabled: true, offsetY: 0 },
              interactions: [
                {
                  type: 'drive',
                  label: isBike ? '自転車に乗る (Fキー / 右クリック)' : '乗車する (Fキー / 右クリック)',
                  dialogue: [`【${options.name}】Fキーで乗車・降車して快適に走ることができます。`],
                },
              ],
              metadata: {
                tags: ['乗り物', isBike ? '自転車' : '車両', 'AI生成'],
                createdAt: Date.now(),
                source: 'ai_generated',
                promptUsed: options.promptUsed,
                description: `プロンプト「${options.promptUsed}」から自動生成された多方向対応乗り物。`,
              },
            };
          } else if (options.type === 'character') {
            airasAsset = {
              id: assetId,
              name: options.name || 'AIキャラクター',
              type: 'character',
              category: 'npc',
              sprite: {
                url: defaultUrl,
                width: 20,
                height: 50,
                pixelArt: true,
                directionalUrls,
              },
              anchor: { x: 10, y: 48 },
              collision: {
                enabled: true,
                type: 'box',
                offsetX: -5,
                offsetY: -6,
                width: 10,
                height: 6,
              },
              depth: { enabled: true, offsetY: 0 },
              interactions: [
                {
                  type: 'talk',
                  label: '話しかける (右クリック)',
                  dialogue: [
                    `【${options.name}】「こんにちは！Airasの世界へようこそ！」`,
                    `「この街、レトロな雰囲気ですごく落ち着くよね。」`,
                    `「一緒にこの世界を広げていこうね！」`,
                  ],
                },
              ],
              metadata: {
                tags: ['キャラクター', 'アバター', 'AI生成', 'NPC'],
                createdAt: Date.now(),
                source: 'ai_generated',
                promptUsed: options.promptUsed,
                description: `プロンプト「${options.promptUsed}」から自動生成された多方向対応キャラクター。`,
              },
            };
          } else {
            airasAsset = {
              id: assetId,
              name: options.name || 'AIオブジェクト',
              type: 'object',
              category: 'furniture',
              sprite: {
                url: defaultUrl,
                width: 48,
                height: 48,
                pixelArt: true,
                directionalUrls,
              },
              anchor: { x: 24, y: 44 },
              collision: {
                enabled: true,
                type: 'box',
                offsetX: -16,
                offsetY: -10,
                width: 32,
                height: 14,
              },
              depth: { enabled: true, offsetY: 0 },
              interactions: [
                {
                  type: 'inspect',
                  label: '調べる (右クリック)',
                  dialogue: [`【${options.name}】AIが創り出したアセットだ。`],
                },
              ],
              metadata: {
                tags: ['AI生成', 'オブジェクト'],
                createdAt: Date.now(),
                source: 'ai_generated',
                promptUsed: options.promptUsed,
                description: `プロンプト「${options.promptUsed}」から自動生成されたアセット。`,
              },
            };
          }

          resolve(airasAsset);
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = () => reject(new Error('Failed to load sprite sheet image'));
      img.src = imageUrl;
    });
  }

  // --- ヘルパー関数群 ---

  private static sampleBackgroundColor(data: Uint8ClampedArray, width: number, height: number): { r: number; g: number; b: number } {
    const cornerIndices = [
      0,
      (width - 1) * 4,
      ((height - 1) * width) * 4,
      ((height - 1) * width + (width - 1)) * 4,
    ];

    let sumR = 0, sumG = 0, sumB = 0;
    for (const idx of cornerIndices) {
      sumR += data[idx];
      sumG += data[idx + 1];
      sumB += data[idx + 2];
    }
    return {
      r: Math.round(sumR / 4),
      g: Math.round(sumG / 4),
      b: Math.round(sumB / 4),
    };
  }

  private static makeTransparentAndMeasure(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    bg: { r: number; g: number; b: number }
  ): { minX: number; minY: number; maxX: number; maxY: number } {
    let minX = width, minY = height, maxX = 0, maxY = 0;

    // 1. BFS 外側洪水充填 (Flood Fill)
    const isBg = new Uint8Array(width * height);
    const queue: number[] = [];

    // 外枠ピクセルをシードとして投入
    for (let x = 0; x < width; x++) {
      queue.push(x, 0);
      queue.push(x, height - 1);
    }
    for (let y = 1; y < height - 1; y++) {
      queue.push(0, y);
      queue.push(width - 1, y);
    }

    const isLightPixel = (r: number, g: number, b: number) => {
      const dist = Math.sqrt((r - bg.r) ** 2 + (g - bg.g) ** 2 + (b - bg.b) ** 2);
      if (dist < 65) return true;
      const avg = (r + g + b) / 3;
      if (avg > 195) return true;
      if (Math.abs(r - g) < 8 && Math.abs(g - b) < 8 && avg > 175) return true;
      return false;
    };

    let head = 0;
    while (head < queue.length) {
      const qx = queue[head++];
      const qy = queue[head++];
      const idx = qy * width + qx;
      if (isBg[idx]) continue;

      const pIdx = idx * 4;
      const r = data[pIdx];
      const g = data[pIdx + 1];
      const b = data[pIdx + 2];

      if (isLightPixel(r, g, b)) {
        isBg[idx] = 1;
        if (qx > 0 && !isBg[idx - 1]) queue.push(qx - 1, qy);
        if (qx < width - 1 && !isBg[idx + 1]) queue.push(qx + 1, qy);
        if (qy > 0 && !isBg[idx - width]) queue.push(qx, qy - 1);
        if (qy < height - 1 && !isBg[idx + width]) queue.push(qx, qy + 1);
      }
    }

    // 2. デフリンジ（白フチ・色汚染の除去 pass）
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (isBg[idx]) continue;

        const pIdx = idx * 4;
        const avg = (data[pIdx] + data[pIdx + 1] + data[pIdx + 2]) / 3;
        const hasBgNeighbor =
          (x > 0 && isBg[idx - 1]) ||
          (x < width - 1 && isBg[idx + 1]) ||
          (y > 0 && isBg[idx - width]) ||
          (y < height - 1 && isBg[idx + width]);

        if (hasBgNeighbor && avg > 170) {
          isBg[idx] = 1;
        }
      }
    }

    // 3. アルファ適用 & バウンディングボックス測定
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const pIdx = idx * 4;
        if (isBg[idx]) {
          data[pIdx + 3] = 0;
        } else {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (minX > maxX || minY > maxY) {
      return { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1 };
    }
    return { minX, minY, maxX, maxY };
  }

  private static cropSlot(
    sourceCanvas: HTMLCanvasElement,
    sx: number,
    sy: number,
    sw: number,
    sh: number
  ): string {
    const slotCanvas = document.createElement('canvas');
    slotCanvas.width = sw;
    slotCanvas.height = sh;
    const sCtx = slotCanvas.getContext('2d')!;
    sCtx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

    // スロット内の余白トリミング
    const imgData = sCtx.getImageData(0, 0, sw, sh);
    const data = imgData.data;
    let minX = sw, minY = sh, maxX = 0, maxY = 0;
    let hasPixel = false;

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const a = data[(y * sw + x) * 4 + 3];
        if (a > 10) {
          hasPixel = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!hasPixel) return slotCanvas.toDataURL('image/png');

    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;
    const cropped = document.createElement('canvas');
    cropped.width = cropW;
    cropped.height = cropH;
    const cCtx = cropped.getContext('2d')!;
    cCtx.drawImage(slotCanvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

    return cropped.toDataURL('image/png');
  }

  private static flipDataUrlHorizontally(dataUrl: string): string {
    const flipCanvas = document.createElement('canvas');
    const tempImg = new Image();
    tempImg.src = dataUrl;

    flipCanvas.width = tempImg.naturalWidth || tempImg.width || 64;
    flipCanvas.height = tempImg.naturalHeight || tempImg.height || 64;
    const ctx = flipCanvas.getContext('2d');
    if (ctx) {
      ctx.translate(flipCanvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(tempImg, 0, 0);
      return flipCanvas.toDataURL('image/png');
    }
    return dataUrl;
  }
}
