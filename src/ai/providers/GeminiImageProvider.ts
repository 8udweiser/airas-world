export class GeminiImageProvider {
  private static STORAGE_KEY = 'airas_gemini_api_key';

  public static getApiKey(): string {
    return localStorage.getItem(GeminiImageProvider.STORAGE_KEY) || '';
  }

  public static setApiKey(key: string): void {
    localStorage.setItem(GeminiImageProvider.STORAGE_KEY, key.trim());
  }

  public static hasApiKey(): boolean {
    return Boolean(GeminiImageProvider.getApiKey());
  }

  // Gemini / Imagen を用いたドット絵画像生成
  public static async generatePixelArtImage(userPrompt: string): Promise<string> {
    const apiKey = GeminiImageProvider.getApiKey();

    if (!apiKey) {
      console.warn('Gemini API Key is not set. Using local procedural generator.');
      return GeminiImageProvider.generateProceduralFallback(userPrompt);
    }

    // 1. まず Gemini 2.0 Flash による高精度ドット絵SVG生成を試行 (Google AI Studio で100%有効)
    try {
      const svgResult = await GeminiImageProvider.generateViaGeminiFlashSVG(apiKey, userPrompt);
      if (svgResult) {
        return svgResult;
      }
    } catch (e) {
      console.warn('Gemini Flash SVG generator failed, attempting Imagen endpoint:', e);
    }

    // 2. OpenAI互換 Imagen エンドポイント試行
    try {
      const imagenResult = await GeminiImageProvider.generateViaOpenAICompat(apiKey, userPrompt);
      if (imagenResult) {
        return imagenResult;
      }
    } catch (e) {
      console.warn('OpenAI-compatible Imagen endpoint failed:', e);
    }

    // 3. フォールバック
    return GeminiImageProvider.generateProceduralFallback(userPrompt);
  }

  // Gemini 2.0 Flash を用いたドット絵SVG直接生成
  private static async generateViaGeminiFlashSVG(apiKey: string, prompt: string): Promise<string> {
    const systemPrompt = `You are a professional pixel art designer for a 2.5D retro game.
Create a beautiful, nostalgic 16-bit/32-bit pixel art sprite for: "${prompt}".
Requirements:
1. Return ONLY pure SVG code starting with <svg and ending with </svg>.
2. Do NOT use markdown code blocks or explanations.
3. viewBox should be "0 0 32 48" or "0 0 48 48".
4. Use shape-rendering="crispEdges" and pixelated <rect>, <polygon>, <ellipse> elements.
5. Must have a transparent background with no outer background rectangle.
6. Must have warm retro colors, clear outlines, highlights, and shadow.`;

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

  // OpenAI互換 Imagen エンドポイント
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

  // ローカルプロシージャル生成フォールバック
  public static generateProceduralFallback(prompt: string): string {
    const p = prompt.toLowerCase();
    let color = '#0284c7';
    let label = 'ITEM';

    if (p.includes('ポスト') || p.includes('郵便')) {
      color = '#ef4444';
      label = 'POST';
    } else if (p.includes('電話') || p.includes('公衆電話')) {
      color = '#10b981';
      label = 'PHONE';
    } else if (p.includes('プランター') || p.includes('花') || p.includes('フラワー')) {
      color = '#ec4899';
      label = 'FLOWER';
    } else if (p.includes('看板') || p.includes('提灯')) {
      color = '#f59e0b';
      label = 'LAMP';
    }

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 44" shape-rendering="crispEdges">
  <ellipse cx="16" cy="42" rx="13" ry="2" fill="rgba(0,0,0,0.3)" />
  <rect x="5" y="6" width="22" height="34" fill="${color}" />
  <rect x="7" y="8" width="18" height="4" fill="#ffffff" opacity="0.35)" />
  <rect x="7" y="16" width="18" height="10" fill="#0f172a" />
  <rect x="9" y="18" width="14" height="6" fill="#f8fafc" />
  <text x="16" y="23" font-size="4" fill="#000" font-weight="bold" text-anchor="middle" font-family="monospace">${label}</text>
  <rect x="9" y="38" width="14" height="4" fill="#334155" />
</svg>`.trim();

    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }
}
