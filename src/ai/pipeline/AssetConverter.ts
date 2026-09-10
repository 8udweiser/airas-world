import { AirasAsset } from '../../core/types/asset';

export class AssetConverter {
  /**
   * 画像URL/Base64から背景を自動透明化し、Airas Asset形式へ変換する
   */
  public static async convertToAirasAsset(
    imageUrl: string,
    name: string,
    promptUsed: string
  ): Promise<AirasAsset> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

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
          const cornerIndices = [
            0, // top-left
            (rawCanvas.width - 1) * 4, // top-right
            ((rawCanvas.height - 1) * rawCanvas.width) * 4, // bottom-left
            ((rawCanvas.height - 1) * rawCanvas.width + (rawCanvas.width - 1)) * 4, // bottom-right
          ];

          let bgR = 255, bgG = 255, bgB = 255;
          let sampledCount = 0;
          let sumR = 0, sumG = 0, sumB = 0;

          for (const idx of cornerIndices) {
            sumR += data[idx];
            sumG += data[idx + 1];
            sumB += data[idx + 2];
            sampledCount++;
          }
          bgR = Math.round(sumR / sampledCount);
          bgG = Math.round(sumG / sampledCount);
          bgB = Math.round(sumB / sampledCount);

          // 2. 背景の透過処理 & バウンディングボックス測定
          let minX = rawCanvas.width;
          let minY = rawCanvas.height;
          let maxX = 0;
          let maxY = 0;
          const colorThreshold = 45; // 許容差

          for (let y = 0; y < rawCanvas.height; y++) {
            for (let x = 0; x < rawCanvas.width; x++) {
              const idx = (y * rawCanvas.width + x) * 4;
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];
              const a = data[idx + 3];

              if (a === 0) continue;

              const dist = Math.sqrt(
                (r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2
              );

              if (dist < colorThreshold) {
                data[idx + 3] = 0; // 完全透明化
              } else {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            }
          }

          ctx.putImageData(imageData, 0, 0);

          // バウンディングボックスが測定できなかった場合は全体を使用
          if (minX > maxX || minY > maxY) {
            minX = 0;
            minY = 0;
            maxX = rawCanvas.width - 1;
            maxY = rawCanvas.height - 1;
          }

          // 3. 余白をトリミングしたCanvasへコピー
          const trimmedWidth = Math.max(16, maxX - minX + 1);
          const trimmedHeight = Math.max(16, maxY - minY + 1);

          const trimmedCanvas = document.createElement('canvas');
          // 最大サイズを 64px 程度にスケーリングしてレトロドット絵比率に整える
          const targetHeight = Math.min(64, Math.max(32, trimmedHeight));
          const scale = targetHeight / trimmedHeight;
          const targetWidth = Math.round(trimmedWidth * scale);

          trimmedCanvas.width = targetWidth;
          trimmedCanvas.height = targetHeight;
          const trimmedCtx = trimmedCanvas.getContext('2d');
          if (trimmedCtx) {
            trimmedCtx.imageSmoothingEnabled = false; // ドット絵クッキリ
            trimmedCtx.drawImage(
              rawCanvas,
              minX,
              minY,
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

          // 4. アンカー・コリジョン矩形の自動計算
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
              y: targetHeight, // 足元接地点
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

      img.onerror = (e) => reject(new Error('Failed to load image for asset conversion'));
      img.src = imageUrl;
    });
  }
}
