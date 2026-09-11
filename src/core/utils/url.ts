/**
 * GitHub Pages (/airas-world/) や Cloudflare Pages (/)、ローカルなど
 * あらゆる配信環境で静的アセットのURLを100%正しく解決するヘルパー
 */
export function resolveAssetUrl(path: string): string {
  if (!path) return '';
  if (
    path.startsWith('data:') ||
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('blob:')
  ) {
    return path;
  }

  // Viteが提供するベースURL (例: "/airas-world/" または "./" または "/")
  const metaEnv = (import.meta as unknown as { env?: Record<string, string> }).env;
  const base = metaEnv?.BASE_URL || './';
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;

  return `${cleanBase}${cleanPath}`;
}
