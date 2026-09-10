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

  // 2. Gemini 2.0 Flash を用いたドット絵SVG直接生成
  private static async generateViaGeminiFlashSVG(apiKey: string, prompt: string): Promise<string> {
    const systemPrompt = `You are a legendary 16-bit pixel art designer for a retro Japanese HD-2D game.
Create a beautiful, detailed, nostalgic pixel art sprite for: "${prompt}".
Requirements:
1. Return ONLY pure SVG code starting with <svg and ending with </svg>.
2. Do NOT use markdown code blocks or explanations.
3. viewBox must be appropriate (e.g. "0 0 32 48" or "0 0 48 48").
4. Use shape-rendering="crispEdges" and pixelated <rect>, <polygon>, <line> elements.
5. Must have a transparent background with no background canvas/fill rect.
6. If the user asks for a telephone booth (電話ボックス), draw the glass panels, green telephone machine inside, red/dark roof, folding door, and metal frame! Do NOT draw a simple mailbox!
7. Must have warm retro colors, clear outlines, highlights, and shadow.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!res.ok) {
      throw new Error(`Gemini generateContent error: ${res.status}`);
    }

    const json = await res.json();
    let text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
    text = text.replace(/```xml/g, '').replace(/```svg/g, '').replace(/```/g, '').trim();

    const svgStart = text.indexOf('<svg');
    const svgEnd = text.lastIndexOf('</svg>');

    if (svgStart !== -1 && svgEnd !== -1) {
      const cleanSvg = text.substring(svgStart, svgEnd + 6);
      return `data:image/svg+xml;utf8,${encodeURIComponent(cleanSvg)}`;
    }

    throw new Error('Valid SVG not found in Gemini response');
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

  // 4. 精巧なローカルプロシージャルフォールバック（オブジェクト種別ごとに完全に専用設計）
  public static generateProceduralFallback(prompt: string): string {
    const p = prompt.toLowerCase();

    // 昭和レトロな電話ボックス（専用設計：ガラス張り、緑の公衆電話、受話器、赤い屋根、折りたたみ扉）
    if (p.includes('電話') || p.includes('公衆電話') || p.includes('phone') || p.includes('booth')) {
      const phoneBoothSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 56" shape-rendering="crispEdges">
  <!-- 影 -->
  <ellipse cx="18" cy="53" rx="14" ry="2.5" fill="rgba(0,0,0,0.3)" />
  <!-- 屋根 (昭和の赤/白アルミ屋根) -->
  <rect x="4" y="4" width="28" height="4" fill="#dc2626" />
  <rect x="6" y="2" width="24" height="2" fill="#ef4444" />
  <rect x="5" y="8" width="26" height="2" fill="#991b1b" />
  <!-- メイン支柱 (アルミシルバーフレーム) -->
  <rect x="5" y="10" width="2" height="42" fill="#94a3b8" />
  <rect x="29" y="10" width="2" height="42" fill="#64748b" />
  <rect x="17" y="10" width="2" height="42" fill="#cbd5e1" />
  <!-- 上部「公衆電話」行灯看板 -->
  <rect x="7" y="10" width="22" height="6" fill="#f8fafc" />
  <rect x="8" y="11" width="20" height="4" fill="#15803d" />
  <text x="18" y="14.5" font-size="3" fill="#ffffff" font-weight="bold" text-anchor="middle" font-family="monospace">公衆電話</text>
  <!-- ガラス窓背景 (薄い水色透過) -->
  <rect x="7" y="16" width="10" height="34" fill="#38bdf8" opacity="0.35" />
  <rect x="19" y="16" width="10" height="34" fill="#38bdf8" opacity="0.35" />
  <!-- ガラス格子枠 -->
  <line x1="7" y1="27" x2="17" y2="27" stroke="#94a3b8" stroke-width="1" />
  <line x1="19" y1="27" x2="29" y2="27" stroke="#64748b" stroke-width="1" />
  <line x1="7" y1="38" x2="17" y2="38" stroke="#94a3b8" stroke-width="1" />
  <line x1="19" y1="38" x2="29" y2="38" stroke="#64748b" stroke-width="1" />
  <!-- ガラスハイライト (斜め光沢) -->
  <line x1="9" y1="18" x2="15" y2="24" stroke="#ffffff" stroke-width="1" opacity="0.6" />
  <line x1="21" y1="18" x2="27" y2="24" stroke="#ffffff" stroke-width="1" opacity="0.6" />
  <!-- 内部の電話台 (木目調テーブル) -->
  <rect x="9" y="36" width="18" height="3" fill="#78350f" />
  <!-- 緑の公衆電話機本体 (NTT MC-3P型) -->
  <rect x="11" y="25" width="14" height="11" fill="#16a34a" />
  <rect x="12" y="24" width="12" height="1" fill="#22c55e" />
  <rect x="12" y="26" width="7" height="3" fill="#0f172a" /> <!-- 液晶/度数表示 -->
  <rect x="13" y="27" width="5" height="1" fill="#4ade80" />
  <rect x="20" y="26" width="3" height="1" fill="#facc15" /> <!-- コイン投入口 -->
  <rect x="13" y="30" width="5" height="4" fill="#15803d" /> <!-- プッシュボタン -->
  <!-- 左側の受話器 (黒/緑) -->
  <rect x="8" y="26" width="3" height="9" fill="#14532d" />
  <rect x="7" y="25" width="5" height="2" fill="#0f172a" />
  <rect x="7" y="34" width="5" height="2" fill="#0f172a" />
  <!-- 台座 / ステップ -->
  <rect x="4" y="51" width="28" height="3" fill="#475569" />
</svg>`.trim();
      return `data:image/svg+xml;utf8,${encodeURIComponent(phoneBoothSvg)}`;
    }

    // 丸型赤い郵便ポスト（専用設計：円筒形、庇、白文字POST、収集口、黒台座）
    if (p.includes('ポスト') || p.includes('郵便') || p.includes('post')) {
      const postSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 48" shape-rendering="crispEdges">
  <ellipse cx="16" cy="45" rx="12" ry="2.5" fill="rgba(0,0,0,0.3)" />
  <circle cx="16" cy="10" r="10" fill="#dc2626" />
  <rect x="6" y="8" width="20" height="4" fill="#ef4444" />
  <rect x="7" y="12" width="18" height="28" fill="#b91c1c" />
  <rect x="9" y="14" width="14" height="24" fill="#dc2626" />
  <!-- 投函口庇 -->
  <rect x="8" y="16" width="16" height="4" fill="#991b1b" />
  <rect x="9" y="18" width="14" height="2" fill="#0f172a" />
  <!-- 白帯 & 〒マーク / POST -->
  <rect x="8" y="24" width="16" height="6" fill="#f8fafc" />
  <text x="16" y="28.5" font-size="3.5" fill="#b91c1c" font-weight="bold" text-anchor="middle" font-family="monospace">POST</text>
  <!-- 取集口の鍵扉 -->
  <rect x="11" y="32" width="10" height="7" fill="#991b1b" />
  <circle cx="19" cy="35" r="1" fill="#facc15" />
  <!-- 黒色円形台座 -->
  <rect x="9" y="40" width="14" height="4" fill="#1e293b" />
  <rect x="7" y="43" width="18" height="2" fill="#0f172a" />
</svg>`.trim();
      return `data:image/svg+xml;utf8,${encodeURIComponent(postSvg)}`;
    }

    // ラーメン屋の赤提灯・のれん
    if (p.includes('提灯') || p.includes('ちょうちん') || p.includes('ラーメン') || p.includes('屋台')) {
      const lanternSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 48" shape-rendering="crispEdges">
  <ellipse cx="16" cy="45" rx="9" ry="2" fill="rgba(0,0,0,0.25)" />
  <!-- 吊り金具 -->
  <line x1="16" y1="4" x2="16" y2="10" stroke="#0f172a" stroke-width="1.5" />
  <rect x="12" y="10" width="8" height="2" fill="#0f172a" />
  <!-- 提灯本体 -->
  <rect x="8" y="12" width="16" height="22" fill="#dc2626" rx="4" />
  <rect x="10" y="14" width="12" height="18" fill="#ef4444" />
  <!-- 黒い竹ひごライン -->
  <line x1="8" y1="16" x2="24" y2="16" stroke="#7f1d1d" stroke-width="1" />
  <line x1="8" y1="21" x2="24" y2="21" stroke="#7f1d1d" stroke-width="1" />
  <line x1="8" y1="26" x2="24" y2="26" stroke="#7f1d1d" stroke-width="1" />
  <line x1="8" y1="31" x2="24" y2="31" stroke="#7f1d1d" stroke-width="1" />
  <!-- 白文字「らーめん」 -->
  <rect x="11" y="17" width="10" height="10" fill="#fef08a" opacity="0.9" />
  <text x="16" y="24" font-size="5" fill="#991b1b" font-weight="bold" text-anchor="middle" font-family="sans-serif">拉</text>
  <!-- 下部飾り -->
  <rect x="12" y="34" width="8" height="2" fill="#0f172a" />
  <line x1="16" y1="36" x2="16" y2="42" stroke="#dc2626" stroke-width="2" />
</svg>`.trim();
      return `data:image/svg+xml;utf8,${encodeURIComponent(lanternSvg)}`;
    }

    // 駄菓子屋の10円ゲーム機
    if (p.includes('ゲーム') || p.includes('駄菓子') || p.includes('game')) {
      const gameSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 48" shape-rendering="crispEdges">
  <ellipse cx="16" cy="45" rx="11" ry="2.5" fill="rgba(0,0,0,0.3)" />
  <!-- ゲーム筐体 (青/木目) -->
  <rect x="6" y="8" width="20" height="34" fill="#0284c7" />
  <rect x="7" y="9" width="18" height="3" fill="#38bdf8" />
  <!-- タイトルガラス板 -->
  <rect x="8" y="13" width="16" height="5" fill="#facc15" />
  <text x="16" y="17" font-size="3" fill="#000" font-weight="bold" text-anchor="middle" font-family="monospace">10YEN</text>
  <!-- 盤面 (釘とスロープ) -->
  <rect x="8" y="19" width="16" height="14" fill="#f8fafc" />
  <circle cx="11" cy="22" r="0.75" fill="#475569" />
  <circle cx="15" cy="22" r="0.75" fill="#475569" />
  <circle cx="19" cy="22" r="0.75" fill="#475569" />
  <circle cx="13" cy="26" r="0.75" fill="#475569" />
  <circle cx="17" cy="26" r="0.75" fill="#475569" />
  <rect x="13" y="30" width="6" height="2" fill="#dc2626" />
  <!-- レバー & コイン返却口 -->
  <rect x="7" y="34" width="18" height="8" fill="#0369a1" />
  <circle cx="21" cy="37" r="2" fill="#ef4444" /> <!-- 赤ノブ -->
  <rect x="11" y="37" width="4" height="3" fill="#1e293b" />
</svg>`.trim();
      return `data:image/svg+xml;utf8,${encodeURIComponent(gameSvg)}`;
    }

    // デフォルトのレトロアイテム
    const defaultSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 44" shape-rendering="crispEdges">
  <ellipse cx="16" cy="42" rx="12" ry="2" fill="rgba(0,0,0,0.3)" />
  <rect x="6" y="8" width="20" height="32" fill="#6366f1" />
  <rect x="8" y="10" width="16" height="4" fill="#a5b4fc" />
  <rect x="8" y="18" width="16" height="10" fill="#1e1b4b" />
  <text x="16" y="25" font-size="4" fill="#ffffff" font-weight="bold" text-anchor="middle" font-family="monospace">ITEM</text>
  <rect x="10" y="36" width="12" height="4" fill="#312e81" />
</svg>`.trim();

    return `data:image/svg+xml;utf8,${encodeURIComponent(defaultSvg)}`;
  }
}
