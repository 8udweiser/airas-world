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

    // ドット絵スタイル強化プロンプト
    const enhancedPrompt = `Pixel art sprite of ${userPrompt}, 16-bit retro dot art style, isolated on clean solid pure white background, video game asset, clean silhouette, no shadows, sharp pixel edges`;

    if (!apiKey) {
      console.warn('Gemini API Key is not set. Using high-quality procedural fallback generator.');
      return GeminiImageProvider.generateProceduralFallback(userPrompt);
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            instances: [{ prompt: enhancedPrompt }],
            parameters: {
              sampleCount: 1,
              aspectRatio: '1:1',
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini Imagen API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const base64Bytes =
        data.predictions?.[0]?.bytesBase64Encoded ||
        data.predictions?.[0]?.image?.imageBytes;

      if (!base64Bytes) {
        throw new Error('No image bytes received from Gemini Imagen API');
      }

      return `data:image/png;base64,${base64Bytes}`;
    } catch (err) {
      console.error('Failed to generate image via Gemini API, falling back to procedural:', err);
      // エラー時もユーザーの体験を止めないようフォールバック
      return GeminiImageProvider.generateProceduralFallback(userPrompt);
    }
  }

  // プロシージャル・ドット絵フォールバック生成 (API未設定時またはオフライン用)
  private static generateProceduralFallback(prompt: string): string {
    const p = prompt.toLowerCase();
    let fillColor = '#0284c7';
    let label = 'OBJECT';

    if (p.includes('ポスト') || p.includes('郵便')) {
      fillColor = '#ef4444';
      label = 'POST';
    } else if (p.includes('電話') || p.includes('公衆電話')) {
      fillColor = '#10b981';
      label = 'PHONE';
    } else if (p.includes('プランター') || p.includes('花')) {
      fillColor = '#ec4899';
      label = 'FLOWER';
    } else if (p.includes('看板') || p.includes('サイン')) {
      fillColor = '#f59e0b';
      label = 'SIGN';
    }

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 40" shape-rendering="crispEdges">
  <ellipse cx="16" cy="38" rx="12" ry="2" fill="rgba(0,0,0,0.3)" />
  <rect x="6" y="6" width="20" height="30" fill="${fillColor}" />
  <rect x="8" y="8" width="16" height="4" fill="#ffffff" opacity="0.3" />
  <rect x="8" y="16" width="16" height="8" fill="#1e293b" />
  <rect x="10" y="18" width="12" height="4" fill="#f8fafc" />
  <text x="16" y="21" font-size="3" fill="#000" text-anchor="middle" font-family="monospace">${label}</text>
  <rect x="10" y="32" width="12" height="4" fill="#334155" />
</svg>`.trim();

    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }
}
