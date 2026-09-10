export class GeminiImageProvider {
  private static STORAGE_KEY_1 = 'gemini_api_key';
  private static STORAGE_KEY_2 = 'airas_gemini_api_key';

  public static getApiKey(): string {
    return (
      localStorage.getItem(GeminiImageProvider.STORAGE_KEY_1) ||
      localStorage.getItem(GeminiImageProvider.STORAGE_KEY_2) ||
      ''
    );
  }

  public static setApiKey(key: string): void {
    const trimmed = key.trim();
    localStorage.setItem(GeminiImageProvider.STORAGE_KEY_1, trimmed);
    localStorage.setItem(GeminiImageProvider.STORAGE_KEY_2, trimmed);
  }

  public static hasApiKey(): boolean {
    return Boolean(GeminiImageProvider.getApiKey());
  }

  // Gemini / Nano Banana を用いたドット絵画像生成パイプライン
  public static async generatePixelArtImage(userPrompt: string): Promise<string> {
    const apiKey = GeminiImageProvider.getApiKey();

    if (!apiKey) {
      console.warn('Gemini API Key is not set. Using local procedural generator.');
      return GeminiImageProvider.generateProceduralFallback(userPrompt);
    }

    // 1. 【最優先】Google 公式 Nano Banana (gemini-2.5-flash-image / gemini-3.1-flash-image)
    try {
      console.log('Attempting Nano Banana image generation...');
      const nanoBananaResult = await GeminiImageProvider.generateViaNanoBanana(apiKey, userPrompt);
      if (nanoBananaResult) {
        console.log('Successfully generated image via Nano Banana!');
        return nanoBananaResult;
      }
    } catch (e) {
      console.warn('Nano Banana image generator failed, attempting Gemini Flash SVG:', e);
    }

    // 2. Gemini 2.0 Flash による高精度ドット絵SVG直接生成 (Google AI Studio で100%有効)
    try {
      console.log('Attempting Gemini Flash SVG generation...');
      const svgResult = await GeminiImageProvider.generateViaGeminiFlashSVG(apiKey, userPrompt);
      if (svgResult) {
        console.log('Successfully generated SVG via Gemini Flash!');
        return svgResult;
      }
    } catch (e) {
      console.warn('Gemini Flash SVG generator failed, attempting OpenAI Compat Imagen:', e);
    }

    // 3. OpenAI互換 Imagen エンドポイント試行
    try {
      const imagenResult = await GeminiImageProvider.generateViaOpenAICompat(apiKey, userPrompt);
      if (imagenResult) {
        return imagenResult;
      }
    } catch (e) {
      console.warn('OpenAI-compatible Imagen endpoint failed:', e);
    }

    // 4. ローカルフォールバック (固有の精巧なプロシージャルSVG)
    console.log('Falling back to enhanced local procedural SVG generator');
    return GeminiImageProvider.generateProceduralFallback(userPrompt);
  }

  // 1. Google 公式 Nano Banana (gemini-2.5-flash-image / gemini-3.1-flash-image)
  private static async generateViaNanoBanana(apiKey: string, prompt: string): Promise<string> {
    const enhancedPrompt = `16-bit retro pixel art game sprite of ${prompt}. Clean pixel edges, solid crisp white background, isolated game object sprite, centered, nostalgic Japanese retro game art style.`;

    const candidateModels = ['gemini-2.5-flash-image', 'gemini-3.1-flash-image'];

    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: enhancedPrompt }] }],
            generationConfig: {
              responseModalities: ['IMAGE'],
            },
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.warn(`Nano Banana (${model}) returned HTTP ${res.status}: ${errText}`);
          continue;
        }

        const json = await res.json();
        const parts = json.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData && part.inlineData.data) {
            const mime = part.inlineData.mimeType || 'image/png';
            return `data:${mime};base64,${part.inlineData.data}`;
          }
        }
      } catch (err) {
        console.warn(`Error trying Nano Banana model ${model}:`, err);
      }
    }

    throw new Error('Nano Banana did not return inlineData image');
  }

  // 2. Gemini Flash を用いた高精度ドット絵SVG直接生成 (タイムアウト付きで俊敏に応答)
  private static async generateViaGeminiFlashSVG(apiKey: string, prompt: string): Promise<string> {
    const promptText = `Generate a 16-bit retro pixel art game sprite SVG for: "${prompt}".
CRITICAL:
1. Output ONLY valid SVG code. Start directly with <svg and end with </svg>.
2. No explanations, no markdown backticks, no introduction.
3. Transparent background. shape-rendering="crispEdges".
4. Authentic pixel art using <rect> and geometric elements with retro shading.`;

    const candidateModels = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];

    for (const model of candidateModels) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6500); // 6.5秒タイムアウト

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{ parts: [{ text: promptText }] }],
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 2048,
              },
            }),
          }
        );
        clearTimeout(timeoutId);

        if (!res.ok) {
          console.warn(`Gemini SVG (${model}) returned HTTP ${res.status}`);
          continue;
        }

        const json = await res.json();
        const parts = json.candidates?.[0]?.content?.parts || [];
        let fullText = parts.map((p: any) => p.text || '').join('').trim();
        fullText = fullText.replace(/```xml/g, '').replace(/```svg/g, '').replace(/```/g, '').trim();

        const svgStart = fullText.indexOf('<svg');
        const svgEnd = fullText.lastIndexOf('</svg>');

        if (svgStart !== -1 && svgEnd !== -1) {
          const cleanSvg = fullText.substring(svgStart, svgEnd + 6);
          return `data:image/svg+xml;utf8,${encodeURIComponent(cleanSvg)}`;
        }
      } catch (err) {
        console.warn(`Gemini model ${model} skipped:`, err);
      }
    }

    throw new Error('Valid SVG not generated from Gemini Flash within time limit');
  }

  // 3. OpenAI互換 Imagen エンドポイント
  private static async generateViaOpenAICompat(apiKey: string, prompt: string): Promise<string> {
    const enhancedPrompt = `Pixel art sprite of ${prompt}, 16-bit retro dot art style, isolated on clean solid pure white background, video game asset, clean silhouette, no shadows, sharp pixel edges`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/openai/images/generations`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'imagen-3.0-generate-002',
          prompt: enhancedPrompt,
          n: 1,
          size: '1024x1024',
          response_format: 'b64_json',
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`OpenAI compat image generation failed: ${response.status}`);
    }

    const data = await response.json();
    const b64 = data.data?.[0]?.b64_json;
    if (b64) {
      return `data:image/png;base64,${b64}`;
    }

    throw new Error('No b64 image data');
  }

  // 4. 精巧なローカルプロシージャルPNGジェネレーター (ブラウザ＆Pixiで100%確実に表示されるPNG DataURL)
  public static generateProceduralFallback(prompt: string): string {
    const p = prompt.toLowerCase();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.imageSmoothingEnabled = false;

    // 1. 和箪笥・桐タンス
    if (p.includes('タンス') || p.includes('箪笥') || p.includes('たんす') || p.includes('chest') || p.includes('wardrobe') || p.includes('closet')) {
      canvas.width = 36;
      canvas.height = 44;
      // 影
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(4, 40, 28, 3);
      // 外枠木目
      ctx.fillStyle = '#451a03';
      ctx.fillRect(5, 6, 26, 34);
      ctx.fillStyle = '#78350f';
      ctx.fillRect(6, 7, 24, 32);
      // 天板
      ctx.fillStyle = '#92400e';
      ctx.fillRect(4, 5, 28, 2);
      ctx.fillStyle = '#b45309';
      ctx.fillRect(5, 5, 26, 1);
      // 3段引き出し
      const drawerY = [9, 17, 25];
      for (const y of drawerY) {
        ctx.fillStyle = '#854d0e';
        ctx.fillRect(7, y, 22, 7);
        ctx.fillStyle = '#a16207';
        ctx.fillRect(8, y + 1, 20, 5);
        ctx.fillStyle = '#451a03';
        ctx.fillRect(7, y + 7, 22, 1);
        // 金色取っ手
        ctx.fillStyle = '#facc15';
        ctx.fillRect(15, y + 3, 6, 2);
        ctx.fillStyle = '#713f12';
        ctx.fillRect(16, y + 4, 4, 1);
      }
      // 脚
      ctx.fillStyle = '#291102';
      ctx.fillRect(6, 37, 5, 3);
      ctx.fillRect(25, 37, 5, 3);
      return canvas.toDataURL('image/png');
    }

    // 2. 昭和レトロな電話ボックス
    if (p.includes('電話') || p.includes('公衆電話') || p.includes('phone') || p.includes('booth')) {
      canvas.width = 36;
      canvas.height = 56;
      // 影
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(4, 52, 28, 3);
      // 屋根
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(4, 4, 28, 4);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(6, 2, 24, 2);
      // 支柱
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(5, 8, 2, 44);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(29, 8, 2, 44);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(17, 8, 2, 44);
      // 看板「公衆電話」
      ctx.fillStyle = '#15803d';
      ctx.fillRect(7, 9, 22, 5);
      // ガラス
      ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.fillRect(7, 14, 10, 36);
      ctx.fillRect(19, 14, 10, 36);
      // ガラス格子
      ctx.fillStyle = '#64748b';
      ctx.fillRect(7, 26, 22, 1);
      ctx.fillRect(7, 38, 22, 1);
      // 内部の緑の電話機
      ctx.fillStyle = '#78350f';
      ctx.fillRect(9, 36, 18, 3); // 台
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(11, 25, 14, 11);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(12, 24, 12, 1);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(20, 26, 3, 1); // コイン
      ctx.fillStyle = '#14532d';
      ctx.fillRect(8, 26, 3, 9); // 受話器
      // 台座
      ctx.fillStyle = '#475569';
      ctx.fillRect(4, 50, 28, 3);
      return canvas.toDataURL('image/png');
    }

    // 3. 丸型郵便ポスト
    if (p.includes('ポスト') || p.includes('郵便') || p.includes('post')) {
      canvas.width = 32;
      canvas.height = 48;
      // 影
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(4, 44, 24, 3);
      // 丸屋根
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(6, 6, 20, 6);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(8, 4, 16, 2);
      // 胴体
      ctx.fillStyle = '#b91c1c';
      ctx.fillRect(7, 12, 18, 28);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(9, 14, 14, 24);
      // 投函口
      ctx.fillStyle = '#991b1b';
      ctx.fillRect(8, 16, 16, 4);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(9, 18, 14, 2);
      // 白帯 & POST
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(8, 24, 16, 6);
      ctx.fillStyle = '#b91c1c';
      ctx.fillRect(10, 26, 12, 2);
      // 台座
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(9, 40, 14, 4);
      ctx.fillRect(7, 43, 18, 2);
      return canvas.toDataURL('image/png');
    }

    // 4. 昭和レトロ赤自販機
    if (p.includes('自販機') || p.includes('自動販売機') || p.includes('vending')) {
      canvas.width = 32;
      canvas.height = 48;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(4, 44, 24, 3);
      ctx.fillStyle = '#b91c1c';
      ctx.fillRect(6, 6, 20, 38);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(7, 7, 18, 2);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(8, 11, 16, 15);
      // ドリンク
      ctx.fillStyle = '#dc2626'; ctx.fillRect(9, 13, 3, 6);
      ctx.fillStyle = '#2563eb'; ctx.fillRect(13, 13, 3, 6);
      ctx.fillStyle = '#16a34a'; ctx.fillRect(17, 13, 3, 6);
      ctx.fillStyle = '#eab308'; ctx.fillRect(21, 13, 3, 6);
      // ボタン
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(9, 21, 15, 2);
      // 取り出し口
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(8, 33, 16, 8);
      return canvas.toDataURL('image/png');
    }

    // 5. 昭和のちゃぶ台
    if (p.includes('ちゃぶ台') || p.includes('テーブル') || p.includes('机') || p.includes('table') || p.includes('desk')) {
      canvas.width = 40;
      canvas.height = 32;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(4, 26, 32, 4);
      // 天板
      ctx.fillStyle = '#78350f';
      ctx.fillRect(4, 11, 32, 7);
      ctx.fillStyle = '#b45309';
      ctx.fillRect(6, 9, 28, 4);
      ctx.fillStyle = '#d97706';
      ctx.fillRect(8, 8, 24, 2);
      // 脚
      ctx.fillStyle = '#451a03';
      ctx.fillRect(8, 18, 3, 9);
      ctx.fillRect(29, 18, 3, 9);
      return canvas.toDataURL('image/png');
    }

    // 6. 昭和のブラウン管テレビ
    if (p.includes('テレビ') || p.includes('tv')) {
      canvas.width = 36;
      canvas.height = 40;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(4, 36, 28, 3);
      // アンテナ
      ctx.fillStyle = '#64748b';
      ctx.fillRect(17, 4, 2, 4);
      ctx.fillRect(14, 2, 2, 3);
      ctx.fillRect(20, 2, 2, 3);
      // 本体
      ctx.fillStyle = '#78350f';
      ctx.fillRect(5, 8, 26, 24);
      ctx.fillStyle = '#92400e';
      ctx.fillRect(6, 9, 24, 2);
      // 画面
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(7, 12, 17, 17);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(8, 13, 15, 15);
      // ダイヤル
      ctx.fillStyle = '#facc15';
      ctx.fillRect(26, 14, 3, 3);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(26, 20, 3, 3);
      // 脚
      ctx.fillStyle = '#291102';
      ctx.fillRect(7, 32, 3, 5);
      ctx.fillRect(26, 32, 3, 5);
      return canvas.toDataURL('image/png');
    }

    // 7. デフォルト: アンティーク宝箱・木製道具箱
    canvas.width = 36;
    canvas.height = 36;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(4, 32, 28, 3);
    // 本体
    ctx.fillStyle = '#78350f';
    ctx.fillRect(5, 10, 26, 22);
    ctx.fillStyle = '#92400e';
    ctx.fillRect(4, 8, 28, 4);
    ctx.fillStyle = '#b45309';
    ctx.fillRect(5, 7, 26, 2);
    // 金具バンド
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(9, 7, 3, 25);
    ctx.fillRect(24, 7, 3, 25);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(10, 7, 1, 25);
    ctx.fillRect(25, 7, 1, 25);
    // 南京錠
    ctx.fillStyle = '#ca8a04';
    ctx.fillRect(16, 14, 4, 6);
    ctx.fillStyle = '#eab308';
    ctx.fillRect(17, 12, 2, 3);
    return canvas.toDataURL('image/png');
  }
}
