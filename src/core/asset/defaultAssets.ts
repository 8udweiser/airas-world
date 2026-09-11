import { AirasAsset } from '../types/asset';
import { resolveAssetUrl } from '../utils/url';

function svgToUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

// 🌊 川の水タイル (32x32)
const waterTileSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges">
  <rect x="0" y="0" width="32" height="32" fill="#0284c7" />
  <rect x="0" y="0" width="32" height="32" fill="#0369a1" opacity="0.4" />
  <path d="M2,6 Q10,2 18,6 T32,6" fill="none" stroke="#38bdf8" stroke-width="1" opacity="0.75" />
  <path d="M0,16 Q8,12 16,16 T30,16" fill="none" stroke="#7dd3fc" stroke-width="1.2" opacity="0.85" />
  <path d="M4,26 Q12,22 20,26 T32,26" fill="none" stroke="#38bdf8" stroke-width="1" opacity="0.7" />
  <circle cx="8" cy="14" r="1" fill="#ffffff" opacity="0.6" />
  <circle cx="24" cy="24" r="1" fill="#ffffff" opacity="0.5" />
  <circle cx="18" cy="4" r="1.2" fill="#bae6fd" opacity="0.7" />
</svg>`;

// 🏖️ 黄金の砂浜・ビーチタイル (32x32)
const sandTileSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges">
  <rect x="0" y="0" width="32" height="32" fill="#fde68a" />
  <rect x="0" y="0" width="32" height="32" fill="#fef08a" opacity="0.35" />
  <rect x="3" y="5" width="1" height="1" fill="#d97706" opacity="0.45" />
  <rect x="11" y="9" width="1" height="1" fill="#b45309" opacity="0.35" />
  <rect x="23" y="4" width="1" height="1" fill="#f59e0b" opacity="0.6" />
  <rect x="17" y="15" width="1" height="1" fill="#d97706" opacity="0.4" />
  <rect x="7" y="21" width="1" height="1" fill="#b45309" opacity="0.3" />
  <rect x="27" y="19" width="1" height="1" fill="#f59e0b" opacity="0.5" />
  <rect x="14" y="27" width="1" height="1" fill="#d97706" opacity="0.4" />
  <path d="M2,12 Q10,10 18,13 T32,11" fill="none" stroke="#f59e0b" stroke-width="0.8" opacity="0.35" />
  <path d="M0,24 Q12,22 22,25 T32,23" fill="none" stroke="#f59e0b" stroke-width="0.8" opacity="0.3" />
</svg>`;

// 🪣 空のブリキバケツ (32x32)
const bucketEmptySvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges">
  <ellipse cx="16" cy="27" rx="9" ry="3" fill="rgba(0,0,0,0.35)" />
  <polygon points="7,10 25,10 22,25 10,25" fill="#64748b" />
  <polygon points="8,11 24,11 21,24 11,24" fill="#94a3b8" />
  <ellipse cx="16" cy="10" rx="9" ry="2.5" fill="#475569" />
  <ellipse cx="16" cy="10" rx="8" ry="2" fill="#334155" />
  <path d="M8,10 C8,3 24,3 24,10" fill="none" stroke="#cbd5e1" stroke-width="1.5" />
  <circle cx="16" cy="4" r="2" fill="#e2e8f0" />
</svg>`;

// 🌊 水入りバケツ (32x32)
const bucketWaterSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges">
  <ellipse cx="16" cy="27" rx="9" ry="3" fill="rgba(0,0,0,0.35)" />
  <polygon points="7,10 25,10 22,25 10,25" fill="#64748b" />
  <polygon points="8,11 24,11 21,24 11,24" fill="#94a3b8" />
  <ellipse cx="16" cy="10" rx="9" ry="2.5" fill="#0284c7" />
  <ellipse cx="16" cy="10" rx="8" ry="2" fill="#38bdf8" />
  <circle cx="14" cy="9.5" r="1.5" fill="#ffffff" opacity="0.9" />
  <path d="M8,10 C8,3 24,3 24,10" fill="none" stroke="#cbd5e1" stroke-width="1.5" />
  <circle cx="16" cy="4" r="2" fill="#e2e8f0" />
</svg>`;

// 🛏️ 昭和レトロダブルベッド (48x44)
const doubleBedSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 44" shape-rendering="crispEdges">
  <ellipse cx="24" cy="41" rx="21" ry="3" fill="rgba(0,0,0,0.35)" />
  <rect x="4" y="6" width="40" height="12" fill="#78350f" rx="1" />
  <rect x="6" y="8" width="36" height="8" fill="#92400e" />
  <rect x="5" y="14" width="38" height="26" fill="#451a03" />
  <rect x="6" y="15" width="36" height="24" fill="#f8fafc" />
  <rect x="8" y="10" width="13" height="8" fill="#e2e8f0" rx="2" />
  <rect x="9" y="11" width="11" height="6" fill="#ffffff" rx="1" />
  <rect x="27" y="10" width="13" height="8" fill="#e2e8f0" rx="2" />
  <rect x="28" y="11" width="11" height="6" fill="#ffffff" rx="1" />
  <rect x="6" y="20" width="36" height="20" fill="#38bdf8" rx="1" />
  <rect x="7" y="21" width="34" height="18" fill="#60a5fa" />
  <line x1="6" y1="26" x2="42" y2="26" stroke="#2563eb" stroke-width="1" />
  <line x1="6" y1="32" x2="42" y2="32" stroke="#2563eb" stroke-width="1" />
  <line x1="18" y1="20" x2="18" y2="40" stroke="#2563eb" stroke-width="1" />
  <line x1="30" y1="20" x2="30" y2="40" stroke="#2563eb" stroke-width="1" />
  <rect x="6" y="19" width="36" height="4" fill="#eff6ff" />
</svg>`;

// 1. 高精細 昭和レトロ赤い自販機 (32x56)
const vendingMachineSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 56" shape-rendering="crispEdges">
  <ellipse cx="16" cy="54" rx="14" ry="2" fill="rgba(0,0,0,0.35)" />
  <rect x="2" y="2" width="28" height="50" fill="#991b1b" />
  <rect x="3" y="3" width="26" height="48" fill="#dc2626" />
  <rect x="3" y="3" width="26" height="2" fill="#fca5a5" />
  <rect x="3" y="3" width="2" height="48" fill="#ef4444" />
  <rect x="27" y="3" width="2" height="48" fill="#7f1d1d" />
  <rect x="5" y="6" width="22" height="7" fill="#0f172a" />
  <rect x="6" y="7" width="20" height="5" fill="#1e293b" />
  <rect x="8" y="8" width="6" height="3" fill="#38bdf8" />
  <rect x="18" y="8" width="6" height="3" fill="#f97316" />
  <rect x="15" y="8" width="2" height="3" fill="#ffffff" />
  <rect x="5" y="15" width="22" height="20" fill="#090d16" />
  <rect x="6" y="16" width="20" height="18" fill="#1e293b" />
  <line x1="8" y1="17" x2="18" y2="33" stroke="rgba(255,255,255,0.25)" stroke-width="1" />
  <line x1="12" y1="17" x2="22" y2="33" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
  <rect x="7" y="18" width="3" height="6" fill="#ef4444" />
  <rect x="11" y="18" width="3" height="6" fill="#10b981" />
  <rect x="15" y="18" width="3" height="6" fill="#0284c7" />
  <rect x="19" y="18" width="3" height="6" fill="#eab308" />
  <rect x="23" y="18" width="2" height="6" fill="#8b5cf6" />
  <rect x="7" y="25" width="3" height="1" fill="#38bdf8" />
  <rect x="11" y="25" width="3" height="1" fill="#38bdf8" />
  <rect x="15" y="25" width="3" height="1" fill="#38bdf8" />
  <rect x="19" y="25" width="3" height="1" fill="#f87171" />
  <rect x="23" y="25" width="2" height="1" fill="#f87171" />
  <rect x="7" y="27" width="3" height="5" fill="#78350f" />
  <rect x="11" y="27" width="3" height="5" fill="#f97316" />
  <rect x="15" y="27" width="3" height="5" fill="#06b6d4" />
  <rect x="19" y="27" width="3" height="5" fill="#ec4899" />
  <rect x="23" y="27" width="2" height="5" fill="#f43f5e" />
  <rect x="7" y="33" width="3" height="1" fill="#f87171" />
  <rect x="11" y="33" width="3" height="1" fill="#38bdf8" />
  <rect x="15" y="33" width="3" height="1" fill="#38bdf8" />
  <rect x="19" y="33" width="3" height="1" fill="#f87171" />
  <rect x="23" y="33" width="2" height="1" fill="#f87171" />
  <rect x="7" y="38" width="4" height="1" fill="#000000" />
  <rect x="8" y="40" width="2" height="3" fill="#cbd5e1" />
  <rect x="14" y="37" width="11" height="5" fill="#0284c7" />
  <rect x="16" y="38" width="7" height="3" fill="#38bdf8" />
  <rect x="5" y="44" width="22" height="7" fill="#090d16" />
  <rect x="7" y="45" width="18" height="5" fill="#334155" />
  <rect x="7" y="45" width="18" height="1" fill="#64748b" />
  <rect x="14" y="47" width="4" height="2" fill="#1e293b" />
  <rect x="5" y="52" width="6" height="3" fill="#1e293b" />
  <rect x="21" y="52" width="6" height="3" fill="#1e293b" />
</svg>`;

// 2. 昭和レトロ純喫茶（カフェ） (64x64)
const retroCafeSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" shape-rendering="crispEdges">
  <rect x="4" y="16" width="56" height="46" fill="#7c2d12" />
  <rect x="6" y="18" width="52" height="44" fill="#9a3412" />
  <line x1="4" y1="26" x2="60" y2="26" stroke="#431407" stroke-width="1" />
  <line x1="4" y1="36" x2="60" y2="36" stroke="#431407" stroke-width="1" />
  <line x1="4" y1="46" x2="60" y2="46" stroke="#431407" stroke-width="1" />
  <line x1="4" y1="56" x2="60" y2="56" stroke="#431407" stroke-width="1" />
  <polygon points="2,16 62,16 58,10 6,10" fill="#15803d" />
  <polygon points="12,16 18,16 16,10 10,10" fill="#f8fafc" />
  <polygon points="26,16 32,16 30,10 24,10" fill="#f8fafc" />
  <polygon points="40,16 46,16 44,10 38,10" fill="#f8fafc" />
  <polygon points="54,16 60,16 58,10 52,10" fill="#f8fafc" />
  <rect x="20" y="4" width="24" height="8" fill="#451a03" stroke="#d97706" stroke-width="1" />
  <rect x="22" y="6" width="20" height="4" fill="#78350f" />
  <rect x="25" y="7" width="5" height="2" fill="#fbbf24" />
  <rect x="34" y="7" width="5" height="2" fill="#fbbf24" />
  <rect x="8" y="24" width="20" height="20" fill="#451a03" />
  <rect x="10" y="26" width="16" height="16" fill="#fef08a" />
  <rect x="12" y="28" width="6" height="6" fill="#fed7aa" />
  <rect x="18" y="34" width="6" height="6" fill="#fdba74" />
  <line x1="18" y1="26" x2="18" y2="42" stroke="#451a03" stroke-width="2" />
  <line x1="10" y1="34" x2="26" y2="34" stroke="#451a03" stroke-width="2" />
  <rect x="36" y="24" width="20" height="38" fill="#451a03" />
  <rect x="38" y="26" width="16" height="20" fill="#fef3c7" />
  <rect x="40" y="28" width="12" height="16" fill="#fde68a" />
  <line x1="46" y1="26" x2="46" y2="46" stroke="#451a03" stroke-width="1" />
  <circle cx="39" cy="45" r="1.5" fill="#f59e0b" />
  <circle cx="32" cy="22" r="3" fill="#fef08a" />
  <circle cx="32" cy="22" r="1.5" fill="#ffffff" />
</svg>`;

// 3. 国鉄風木造駅舎 (80x64)
const retroStationSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 64" shape-rendering="crispEdges">
  <polygon points="4,20 76,20 70,8 10,8" fill="#334155" />
  <polygon points="8,19 72,19 68,10 12,10" fill="#475569" />
  <line x1="12" y1="13" x2="68" y2="13" stroke="#1e293b" stroke-width="1" />
  <line x1="10" y1="16" x2="70" y2="16" stroke="#1e293b" stroke-width="1" />
  <rect x="8" y="20" width="64" height="42" fill="#78350f" />
  <rect x="10" y="22" width="60" height="38" fill="#92400e" />
  <line x1="8" y1="28" x2="72" y2="28" stroke="#451a03" stroke-width="1" />
  <line x1="8" y1="36" x2="72" y2="36" stroke="#451a03" stroke-width="1" />
  <line x1="8" y1="44" x2="72" y2="44" stroke="#451a03" stroke-width="1" />
  <line x1="8" y1="52" x2="72" y2="52" stroke="#451a03" stroke-width="1" />
  <rect x="28" y="14" width="24" height="8" fill="#f8fafc" stroke="#1e293b" stroke-width="1" />
  <rect x="30" y="16" width="20" height="4" fill="#0284c7" />
  <rect x="33" y="17" width="14" height="2" fill="#ffffff" />
  <rect x="26" y="32" width="28" height="30" fill="#1e293b" />
  <rect x="28" y="34" width="24" height="28" fill="#0f172a" />
  <rect x="30" y="46" width="3" height="14" fill="#d97706" />
  <rect x="47" y="46" width="3" height="14" fill="#d97706" />
  <rect x="14" y="30" width="8" height="12" fill="#fde68a" stroke="#451a03" stroke-width="1" />
  <rect x="58" y="30" width="8" height="12" fill="#fde68a" stroke="#451a03" stroke-width="1" />
</svg>`;

// 4. 公園の噴水 (48x48)
const parkFountainSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" shape-rendering="crispEdges">
  <ellipse cx="24" cy="36" rx="22" ry="10" fill="#64748b" />
  <ellipse cx="24" cy="35" rx="20" ry="8" fill="#94a3b8" />
  <ellipse cx="24" cy="35" rx="18" ry="7" fill="#0284c7" />
  <ellipse cx="24" cy="34" rx="15" ry="5" fill="#38bdf8" />
  <rect x="21" y="22" width="6" height="14" fill="#475569" />
  <rect x="19" y="20" width="10" height="4" fill="#94a3b8" />
  <rect x="23" y="10" width="2" height="12" fill="#e0f2fe" />
  <rect x="22" y="8" width="4" height="4" fill="#ffffff" />
  <circle cx="16" cy="22" r="1.5" fill="#bae6fd" />
  <circle cx="32" cy="22" r="1.5" fill="#bae6fd" />
  <circle cx="13" cy="28" r="1" fill="#7dd3fc" />
  <circle cx="35" cy="28" r="1" fill="#7dd3fc" />
  <circle cx="20" cy="33" r="1.5" fill="#ffffff" />
  <circle cx="28" cy="33" r="1.5" fill="#ffffff" />
</svg>`;

// 5. 三毛猫NPC (24x20)
const catSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 20" shape-rendering="crispEdges">
  <ellipse cx="12" cy="18" rx="8" ry="2" fill="rgba(0,0,0,0.3)" />
  <ellipse cx="12" cy="13" rx="7" ry="5" fill="#ffffff" />
  <rect x="8" y="9" width="4" height="5" fill="#d97706" />
  <rect x="14" y="11" width="3" height="4" fill="#1e293b" />
  <path d="M19 13 Q22 10 21 7" stroke="#d97706" stroke-width="2" fill="none" />
  <circle cx="7" cy="9" r="4.5" fill="#ffffff" />
  <polygon points="4,5 6,2 7,5" fill="#d97706" />
  <polygon points="8,5 10,2 11,5" fill="#1e293b" />
  <polygon points="5,5 6,3 7,5" fill="#fbcfe8" />
  <rect x="5" y="8" width="1" height="2" fill="#10b981" />
  <rect x="8" y="8" width="1" height="2" fill="#10b981" />
  <rect x="6" y="10" width="2" height="1" fill="#f43f5e" />
  <line x1="3" y1="10" x2="1" y2="9" stroke="#94a3b8" stroke-width="1" />
  <line x1="10" y1="10" x2="12" y2="9" stroke="#94a3b8" stroke-width="1" />
</svg>`;

// 6. 電柱
const telegraphPoleSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 80" shape-rendering="crispEdges">
  <ellipse cx="12" cy="78" rx="5" ry="2" fill="rgba(0,0,0,0.35)" />
  <rect x="10" y="4" width="4" height="74" fill="#64748b" />
  <rect x="10" y="4" width="1.5" height="74" fill="#cbd5e1" />
  <rect x="12.5" y="4" width="1.5" height="74" fill="#334155" />
  <rect x="2" y="8" width="20" height="2" fill="#1e293b" />
  <rect x="3" y="6" width="2" height="2" fill="#f8fafc" />
  <rect x="19" y="6" width="2" height="2" fill="#f8fafc" />
  <rect x="5" y="16" width="14" height="16" fill="#334155" />
  <rect x="6" y="17" width="12" height="14" fill="#475569" />
  <rect x="7" y="16" width="4" height="1" fill="#94a3b8" />
  <rect x="6" y="17" width="2" height="14" fill="#94a3b8" />
  <rect x="4" y="36" width="16" height="2" fill="#1e293b" />
  <rect x="5" y="34" width="2" height="2" fill="#f8fafc" />
  <rect x="17" y="34" width="2" height="2" fill="#f8fafc" />
  <path d="M12 46 L19 46 L21 50" stroke="#1e293b" stroke-width="1.5" fill="none" />
  <polygon points="18,50 24,50 22,48 20,48" fill="#0f172a" />
  <rect x="19" y="50" width="4" height="3" fill="#fef08a" />
  <rect x="9" y="75" width="6" height="3" fill="#334155" />
</svg>`;

// 7. 街灯
const streetLampSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 48" shape-rendering="crispEdges">
  <ellipse cx="8" cy="46" rx="5" ry="2" fill="rgba(0,0,0,0.3)" />
  <rect x="7" y="12" width="2" height="34" fill="#1e293b" />
  <rect x="7" y="12" width="1" height="34" fill="#475569" />
  <polygon points="2,10 14,10 11,4 5,4" fill="#0f172a" />
  <polygon points="3,10 13,10 10,5 6,5" fill="#1e293b" />
  <rect x="4" y="8" width="8" height="6" fill="#fef08a" />
  <rect x="6" y="9" width="4" height="4" fill="#ffffff" />
  <rect x="4" y="44" width="8" height="3" fill="#0f172a" />
</svg>`;

// 8. ケヤキの木
const retroTreeSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 56" shape-rendering="crispEdges">
  <ellipse cx="24" cy="53" rx="16" ry="3" fill="rgba(0,0,0,0.3)" />
  <rect x="21" y="32" width="6" height="22" fill="#78350f" />
  <rect x="21" y="32" width="2" height="22" fill="#92400e" />
  <rect x="25" y="32" width="2" height="22" fill="#451a03" />
  <circle cx="24" cy="20" r="20" fill="#14532d" />
  <circle cx="22" cy="18" r="17" fill="#15803d" />
  <circle cx="18" cy="14" r="12" fill="#16a34a" />
  <circle cx="28" cy="15" r="11" fill="#22c55e" />
  <circle cx="16" cy="11" r="5" fill="#86efac" />
  <circle cx="27" cy="12" r="4" fill="#86efac" />
</svg>`;

// 9. ベンチ
const retroBenchSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 24" shape-rendering="crispEdges">
  <ellipse cx="18" cy="22" rx="16" ry="2" fill="rgba(0,0,0,0.3)" />
  <rect x="4" y="4" width="28" height="4" fill="#b45309" />
  <rect x="4" y="4" width="28" height="1" fill="#d97706" />
  <rect x="4" y="9" width="28" height="4" fill="#b45309" />
  <rect x="4" y="9" width="28" height="1" fill="#d97706" />
  <polygon points="2,14 34,14 32,18 4,18" fill="#92400e" />
  <line x1="2" y1="14" x2="34" y2="14" stroke="#d97706" stroke-width="1" />
  <rect x="6" y="16" width="2" height="7" fill="#0f172a" />
  <rect x="28" y="16" width="2" height="7" fill="#0f172a" />
</svg>`;

// 10. 駅名標
const stationSignSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 36" shape-rendering="crispEdges">
  <ellipse cx="20" cy="34" rx="16" ry="2" fill="rgba(0,0,0,0.25)" />
  <rect x="8" y="18" width="2" height="17" fill="#475569" />
  <rect x="30" y="18" width="2" height="17" fill="#475569" />
  <rect x="4" y="4" width="32" height="18" fill="#f8fafc" stroke="#1e293b" stroke-width="1" />
  <rect x="5" y="17" width="30" height="3" fill="#0284c7" />
  <rect x="10" y="7" width="20" height="6" fill="#0f172a" />
  <rect x="14" y="14" width="12" height="2" fill="#475569" />
</svg>`;

// 11. 女子生徒 4方向
const schoolgirlDownSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" shape-rendering="crispEdges">
  <ellipse cx="12" cy="34" rx="7" ry="2" fill="rgba(0,0,0,0.35)" />
  <rect x="9" y="27" width="2" height="5" fill="#fed7aa" />
  <rect x="13" y="27" width="2" height="5" fill="#fed7aa" />
  <rect x="9" y="29" width="2" height="4" fill="#1e293b" />
  <rect x="13" y="29" width="2" height="4" fill="#1e293b" />
  <rect x="8" y="33" width="3" height="2" fill="#78350f" />
  <rect x="13" y="33" width="3" height="2" fill="#78350f" />
  <polygon points="7,23 17,23 19,28 5,28" fill="#1e3a8a" />
  <rect x="8" y="16" width="8" height="7" fill="#ffffff" />
  <polygon points="7,16 17,16 14,20 10,20" fill="#1e3a8a" />
  <polygon points="11,18 13,18 12,22" fill="#dc2626" />
  <rect x="6" y="17" width="2" height="7" fill="#fed7aa" />
  <rect x="16" y="17" width="2" height="7" fill="#fed7aa" />
  <rect x="11" y="14" width="2" height="2" fill="#fcd34d" />
  <rect x="8" y="8" width="8" height="7" fill="#fed7aa" />
  <rect x="9" y="11" width="1" height="2" fill="#1e293b" />
  <rect x="14" y="11" width="1" height="2" fill="#1e293b" />
  <rect x="9" y="13" width="1" height="1" fill="#f43f5e" />
  <rect x="14" y="13" width="1" height="1" fill="#f43f5e" />
  <rect x="7" y="5" width="10" height="4" fill="#0f172a" />
  <rect x="6" y="7" width="3" height="8" fill="#0f172a" />
  <rect x="15" y="7" width="3" height="8" fill="#0f172a" />
  <rect x="8" y="7" width="8" height="3" fill="#0f172a" />
  <rect x="9" y="6" width="6" height="1" fill="#334155" />
</svg>`;

const schoolgirlUpSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" shape-rendering="crispEdges">
  <ellipse cx="12" cy="34" rx="7" ry="2" fill="rgba(0,0,0,0.35)" />
  <rect x="9" y="27" width="2" height="5" fill="#fed7aa" />
  <rect x="13" y="27" width="2" height="5" fill="#fed7aa" />
  <rect x="9" y="29" width="2" height="4" fill="#1e293b" />
  <rect x="13" y="29" width="2" height="4" fill="#1e293b" />
  <rect x="8" y="33" width="3" height="2" fill="#78350f" />
  <rect x="13" y="33" width="3" height="2" fill="#78350f" />
  <polygon points="7,23 17,23 19,28 5,28" fill="#1e3a8a" />
  <rect x="8" y="16" width="8" height="7" fill="#ffffff" />
  <rect x="8" y="16" width="8" height="4" fill="#1e3a8a" />
  <line x1="9" y1="19" x2="15" y2="19" stroke="#ffffff" stroke-width="1" />
  <rect x="6" y="17" width="2" height="7" fill="#fed7aa" />
  <rect x="16" y="17" width="2" height="7" fill="#fed7aa" />
  <rect x="7" y="5" width="10" height="11" fill="#0f172a" />
  <rect x="6" y="7" width="12" height="9" fill="#0f172a" />
  <rect x="9" y="6" width="6" height="2" fill="#334155" />
</svg>`;

const schoolgirlLeftSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" shape-rendering="crispEdges">
  <ellipse cx="12" cy="34" rx="6" ry="2" fill="rgba(0,0,0,0.35)" />
  <rect x="10" y="27" width="3" height="5" fill="#fed7aa" />
  <rect x="10" y="29" width="3" height="4" fill="#1e293b" />
  <rect x="8" y="33" width="4" height="2" fill="#78350f" />
  <polygon points="9,23 15,23 17,28 7,28" fill="#1e3a8a" />
  <rect x="9" y="16" width="6" height="7" fill="#ffffff" />
  <polygon points="8,16 13,16 11,20 7,19" fill="#1e3a8a" />
  <rect x="10" y="17" width="2" height="7" fill="#fed7aa" />
  <rect x="7" y="8" width="7" height="7" fill="#fed7aa" />
  <rect x="6" y="11" width="1" height="2" fill="#1e293b" />
  <rect x="6" y="13" width="1" height="1" fill="#f43f5e" />
  <rect x="8" y="5" width="8" height="4" fill="#0f172a" />
  <rect x="9" y="7" width="6" height="8" fill="#0f172a" />
  <rect x="7" y="7" width="2" height="4" fill="#0f172a" />
</svg>`;

const schoolgirlRightSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" shape-rendering="crispEdges">
  <ellipse cx="12" cy="34" rx="6" ry="2" fill="rgba(0,0,0,0.35)" />
  <rect x="11" y="27" width="3" height="5" fill="#fed7aa" />
  <rect x="11" y="29" width="3" height="4" fill="#1e293b" />
  <rect x="12" y="33" width="4" height="2" fill="#78350f" />
  <polygon points="9,23 15,23 17,28 7,28" fill="#1e3a8a" />
  <rect x="9" y="16" width="6" height="7" fill="#ffffff" />
  <polygon points="11,16 16,16 17,19 13,20" fill="#1e3a8a" />
  <rect x="12" y="17" width="2" height="7" fill="#fed7aa" />
  <rect x="10" y="8" width="7" height="7" fill="#fed7aa" />
  <rect x="17" y="11" width="1" height="2" fill="#1e293b" />
  <rect x="17" y="13" width="1" height="1" fill="#f43f5e" />
  <rect x="8" y="5" width="8" height="4" fill="#0f172a" />
  <rect x="9" y="7" width="6" height="8" fill="#0f172a" />
  <rect x="15" y="7" width="2" height="4" fill="#0f172a" />
</svg>`;

// 12. 少年（ケンタ）
const boyDownSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" shape-rendering="crispEdges">
  <ellipse cx="12" cy="34" rx="7" ry="2" fill="rgba(0,0,0,0.35)" />
  <rect x="8" y="26" width="3" height="7" fill="#fed7aa" />
  <rect x="13" y="26" width="3" height="7" fill="#fed7aa" />
  <rect x="7" y="32" width="4" height="3" fill="#3b82f6" />
  <rect x="13" y="32" width="4" height="3" fill="#3b82f6" />
  <rect x="7" y="20" width="10" height="6" fill="#1d4ed8" />
  <rect x="7" y="14" width="10" height="7" fill="#facc15" />
  <rect x="5" y="15" width="2" height="6" fill="#fed7aa" />
  <rect x="17" y="15" width="2" height="6" fill="#fed7aa" />
  <rect x="8" y="8" width="8" height="6" fill="#fed7aa" />
  <rect x="9" y="10" width="1" height="1" fill="#000" />
  <rect x="14" y="10" width="1" height="1" fill="#000" />
  <rect x="11" y="12" width="2" height="1" fill="#ea580c" />
  <rect x="7" y="4" width="10" height="5" fill="#dc2626" />
  <rect x="6" y="8" width="12" height="2" fill="#b91c1c" />
  <rect x="15" y="8" width="3" height="1" fill="#ef4444" />
</svg>`;

const boyUpSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" shape-rendering="crispEdges">
  <ellipse cx="12" cy="34" rx="7" ry="2" fill="rgba(0,0,0,0.35)" />
  <rect x="8" y="26" width="3" height="7" fill="#fed7aa" />
  <rect x="13" y="26" width="3" height="7" fill="#fed7aa" />
  <rect x="7" y="32" width="4" height="3" fill="#3b82f6" />
  <rect x="13" y="32" width="4" height="3" fill="#3b82f6" />
  <rect x="7" y="20" width="10" height="6" fill="#1d4ed8" />
  <rect x="7" y="14" width="10" height="7" fill="#facc15" />
  <rect x="5" y="15" width="2" height="6" fill="#fed7aa" />
  <rect x="17" y="15" width="2" height="6" fill="#fed7aa" />
  <rect x="7" y="4" width="10" height="7" fill="#dc2626" />
  <rect x="10" y="9" width="4" height="2" fill="#7f1d1d" />
  <rect x="7" y="10" width="10" height="3" fill="#451a03" />
</svg>`;

const boyLeftSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" shape-rendering="crispEdges">
  <ellipse cx="12" cy="34" rx="6" ry="2" fill="rgba(0,0,0,0.35)" />
  <rect x="10" y="26" width="3" height="7" fill="#fed7aa" />
  <rect x="9" y="32" width="4" height="3" fill="#3b82f6" />
  <rect x="9" y="20" width="6" height="6" fill="#1d4ed8" />
  <rect x="8" y="14" width="8" height="7" fill="#facc15" />
  <rect x="10" y="15" width="2" height="6" fill="#fed7aa" />
  <rect x="7" y="8" width="7" height="6" fill="#fed7aa" />
  <rect x="6" y="10" width="1" height="1" fill="#000" />
  <rect x="8" y="4" width="9" height="5" fill="#dc2626" />
  <rect x="4" y="7" width="6" height="2" fill="#b91c1c" />
  <rect x="4" y="8" width="3" height="1" fill="#ef4444" />
</svg>`;

const boyRightSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" shape-rendering="crispEdges">
  <ellipse cx="12" cy="34" rx="6" ry="2" fill="rgba(0,0,0,0.35)" />
  <rect x="11" y="26" width="3" height="7" fill="#fed7aa" />
  <rect x="11" y="32" width="4" height="3" fill="#3b82f6" />
  <rect x="9" y="20" width="6" height="6" fill="#1d4ed8" />
  <rect x="8" y="14" width="8" height="7" fill="#facc15" />
  <rect x="12" y="15" width="2" height="6" fill="#fed7aa" />
  <rect x="10" y="8" width="7" height="6" fill="#fed7aa" />
  <rect x="17" y="10" width="1" height="1" fill="#000" />
  <rect x="7" y="4" width="9" height="5" fill="#dc2626" />
  <rect x="14" y="7" width="6" height="2" fill="#b91c1c" />
  <rect x="17" y="8" width="3" height="1" fill="#ef4444" />
</svg>`;

// 13. サラリーマン（たなか）
const salarymanDownSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 38" shape-rendering="crispEdges">
  <ellipse cx="12" cy="36" rx="7" ry="2" fill="rgba(0,0,0,0.35)" />
  <rect x="8" y="25" width="3" height="9" fill="#334155" />
  <rect x="13" y="25" width="3" height="9" fill="#334155" />
  <rect x="7" y="34" width="4" height="3" fill="#0f172a" />
  <rect x="13" y="34" width="4" height="3" fill="#0f172a" />
  <rect x="7" y="14" width="10" height="11" fill="#475569" />
  <polygon points="10,14 14,14 12,19" fill="#ffffff" />
  <rect x="11.5" y="16" width="1" height="5" fill="#dc2626" />
  <rect x="5" y="15" width="2" height="8" fill="#475569" />
  <rect x="17" y="15" width="2" height="8" fill="#475569" />
  <rect x="18" y="22" width="4" height="5" fill="#78350f" />
  <rect x="8" y="7" width="8" height="7" fill="#fed7aa" />
  <rect x="8" y="9" width="3" height="2" fill="#0f172a" stroke="#000" stroke-width="0.5" />
  <rect x="13" y="9" width="3" height="2" fill="#0f172a" stroke="#000" stroke-width="0.5" />
  <line x1="11" y1="10" x2="13" y2="10" stroke="#000" stroke-width="0.5" />
  <rect x="7" y="4" width="10" height="4" fill="#0f172a" />
  <rect x="7" y="6" width="2" height="4" fill="#0f172a" />
  <rect x="15" y="6" width="2" height="4" fill="#0f172a" />
</svg>`;

const salarymanUpSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 38" shape-rendering="crispEdges">
  <ellipse cx="12" cy="36" rx="7" ry="2" fill="rgba(0,0,0,0.35)" />
  <rect x="8" y="25" width="3" height="9" fill="#334155" />
  <rect x="13" y="25" width="3" height="9" fill="#334155" />
  <rect x="7" y="34" width="4" height="3" fill="#0f172a" />
  <rect x="13" y="34" width="4" height="3" fill="#0f172a" />
  <rect x="7" y="14" width="10" height="11" fill="#475569" />
  <line x1="12" y1="14" x2="12" y2="25" stroke="#334155" stroke-width="0.75" />
  <rect x="5" y="15" width="2" height="8" fill="#475569" />
  <rect x="17" y="15" width="2" height="8" fill="#475569" />
  <rect x="18" y="22" width="4" height="5" fill="#78350f" />
  <rect x="7" y="4" width="10" height="10" fill="#0f172a" />
  <rect x="8" y="12" width="8" height="2" fill="#1e293b" />
</svg>`;

const salarymanLeftSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 38" shape-rendering="crispEdges">
  <ellipse cx="12" cy="36" rx="6" ry="2" fill="rgba(0,0,0,0.35)" />
  <rect x="10" y="25" width="4" height="9" fill="#334155" />
  <rect x="9" y="34" width="5" height="3" fill="#0f172a" />
  <rect x="8" y="14" width="8" height="11" fill="#475569" />
  <rect x="7" y="15" width="2" height="2" fill="#ffffff" />
  <rect x="7" y="17" width="1" height="4" fill="#dc2626" />
  <rect x="9" y="15" width="3" height="8" fill="#475569" />
  <rect x="11" y="22" width="4" height="5" fill="#78350f" />
  <rect x="7" y="7" width="8" height="7" fill="#fed7aa" />
  <rect x="6" y="9" width="3" height="2" fill="#0f172a" stroke="#000" stroke-width="0.5" />
  <rect x="7" y="4" width="9" height="5" fill="#0f172a" />
  <rect x="13" y="6" width="3" height="6" fill="#0f172a" />
</svg>`;

const salarymanRightSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 38" shape-rendering="crispEdges">
  <ellipse cx="12" cy="36" rx="6" ry="2" fill="rgba(0,0,0,0.35)" />
  <rect x="10" y="25" width="4" height="9" fill="#334155" />
  <rect x="10" y="34" width="5" height="3" fill="#0f172a" />
  <rect x="8" y="14" width="8" height="11" fill="#475569" />
  <rect x="15" y="15" width="2" height="2" fill="#ffffff" />
  <rect x="16" y="17" width="1" height="4" fill="#dc2626" />
  <rect x="12" y="15" width="3" height="8" fill="#475569" />
  <rect x="9" y="22" width="4" height="5" fill="#78350f" />
  <rect x="9" y="7" width="8" height="7" fill="#fed7aa" />
  <rect x="15" y="9" width="3" height="2" fill="#0f172a" stroke="#000" stroke-width="0.5" />
  <rect x="8" y="4" width="9" height="5" fill="#0f172a" />
  <rect x="8" y="6" width="3" height="6" fill="#0f172a" />
</svg>`;

// 14. タイル
const railTrackTileSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges">
  <rect width="32" height="32" fill="#475569" />
  <rect x="4" y="8" width="2" height="2" fill="#64748b" />
  <rect x="22" y="24" width="2" height="2" fill="#334155" />
  <rect x="14" y="16" width="2" height="2" fill="#64748b" />
  <rect x="0" y="4" width="32" height="4" fill="#78350f" />
  <rect x="0" y="14" width="32" height="4" fill="#78350f" />
  <rect x="0" y="24" width="32" height="4" fill="#78350f" />
  <rect x="6" y="0" width="3" height="32" fill="#94a3b8" />
  <rect x="7" y="0" width="1" height="32" fill="#f8fafc" />
  <rect x="23" y="0" width="3" height="32" fill="#94a3b8" />
  <rect x="24" y="0" width="1" height="32" fill="#f8fafc" />
</svg>`;

const asphaltTileSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges">
  <rect width="32" height="32" fill="#334155" />
  <rect x="4" y="6" width="2" height="2" fill="#475569" />
  <rect x="18" y="14" width="2" height="2" fill="#1e293b" />
  <rect x="26" y="24" width="2" height="2" fill="#475569" />
  <rect x="8" y="22" width="2" height="2" fill="#1e293b" />
</svg>`;

const sidewalkTileSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges">
  <rect width="32" height="32" fill="#94a3b8" />
  <line x1="0" y1="16" x2="32" y2="16" stroke="#64748b" stroke-width="1" />
  <line x1="16" y1="0" x2="16" y2="16" stroke="#64748b" stroke-width="1" />
  <line x1="0" y1="32" x2="32" y2="32" stroke="#64748b" stroke-width="1" />
  <line x1="8" y1="16" x2="8" y2="32" stroke="#64748b" stroke-width="1" />
  <line x1="24" y1="16" x2="24" y2="32" stroke="#64748b" stroke-width="1" />
</svg>`;

const grassTileSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges">
  <rect width="32" height="32" fill="#15803d" />
  <rect x="6" y="8" width="2" height="3" fill="#16a34a" />
  <rect x="20" y="18" width="2" height="3" fill="#22c55e" />
  <rect x="12" y="24" width="2" height="2" fill="#166534" />
  <rect x="24" y="6" width="2" height="2" fill="#166534" />
</svg>`;

export const DEFAULT_ASSETS: Record<string, AirasAsset> = {
  vending_machine_retro: {
    id: 'vending_machine_retro',
    name: '昭和レトロ自販機',
    type: 'object',
    category: 'furniture',
    sprite: {
      url: resolveAssetUrl('/assets/buildings/vending_machine_retro_1.png'),
      width: 36,
      height: 62,
      pixelArt: true,
    },
    anchor: { x: 18, y: 60 },
    collision: { enabled: true, type: 'box', offsetX: -16, offsetY: -16, width: 32, height: 16 },
    depth: { enabled: true, offsetY: 0 },
    interactions: [
      {
        type: 'buy',
        label: 'ジュースを買う (右クリック)',
        dialogue: ['ガコン！冷えた王冠ボトルのコーラが出てきた！喉が潤う。'],
      },
    ],
    metadata: {
      tags: ['昭和', 'レトロ', '自販機', '街並み'],
      createdAt: Date.now(),
      source: 'preset',
      description: 'ノスタルジックな赤の飲料自動販売機。',
    },
  },

  retro_cafe: {
    id: 'retro_cafe',
    name: '昭和純喫茶「あいらす」',
    type: 'building_part',
    category: 'structure',
    sprite: {
      url: resolveAssetUrl('/assets/buildings/cafe_retro.png'),
      width: 132,
      height: 90,
      pixelArt: true,
    },
    anchor: { x: 66, y: 86 },
    collision: { enabled: true, type: 'box', offsetX: -60, offsetY: -24, width: 120, height: 24 },
    depth: { enabled: true, offsetY: 0 },
    interactions: [
      {
        type: 'open_shop',
        label: '喫茶店に入る (右クリック)',
        dialogue: [
          'カランコロン♪ 澄んだベルの音が鳴り響く。',
          'マスター「いらっしゃい。ネルドリップの深煎りブレンド淹れたてだよ。」',
        ],
      },
    ],
    metadata: {
      tags: ['喫茶店', '建物', 'カフェ', '昭和'],
      createdAt: Date.now(),
      source: 'preset',
      description: 'レンガ造りと温かいステンドグラスが美しい純喫茶。',
    },
  },

  retro_station: {
    id: 'retro_station',
    name: '国鉄風木造駅舎',
    type: 'building_part',
    category: 'structure',
    sprite: {
      url: resolveAssetUrl('/assets/buildings/station_wooden.png'),
      width: 152,
      height: 90,
      pixelArt: true,
    },
    anchor: { x: 76, y: 86 },
    collision: { enabled: true, type: 'box', offsetX: -70, offsetY: -24, width: 140, height: 24 },
    depth: { enabled: true, offsetY: 0 },
    interactions: [
      {
        type: 'inspect',
        label: '駅舎に入る (右クリック)',
        dialogue: [
          '木造駅舎の改札をくぐると、汽笛の音が遠くから聞こえてくる。',
          '掲示板「次の上り列車は 17:15 発 みらい行き」',
        ],
      },
    ],
    metadata: {
      tags: ['駅舎', '駅', '鉄道', '昭和'],
      createdAt: Date.now(),
      source: 'preset',
      description: '瓦屋根と木の香りが漂うノスタルジックな駅舎。',
    },
  },

  dagashi_shop: {
    id: 'dagashi_shop',
    name: '昭和レトロ駄菓子屋',
    type: 'building_part',
    category: 'structure',
    sprite: {
      url: resolveAssetUrl('/assets/buildings/dagashi_shop.png'),
      width: 138,
      height: 90,
      pixelArt: true,
    },
    anchor: { x: 69, y: 86 },
    collision: { enabled: true, type: 'box', offsetX: -64, offsetY: -24, width: 128, height: 24 },
    depth: { enabled: true, offsetY: 0 },
    interactions: [
      {
        type: 'buy',
        label: '駄菓子を買う (右クリック)',
        dialogue: [
          'おばちゃん「いらっしゃい！きなこ棒とラムネ、どれにするかい？」',
          '色とりどりのガラス瓶に懐かしいお菓子がいっぱい詰まっている。',
        ],
      },
    ],
    metadata: {
      tags: ['駄菓子屋', '昭和', 'レトロ', '建物', '商店街'],
      createdAt: Date.now(),
      source: 'preset',
      description: '昭和の懐かしい佇まいを残す路地裏の駄菓子屋さん。',
    },
  },

  phone_booth_retro: {
    id: 'phone_booth_retro',
    name: '昭和レトロ赤電話ボックス',
    type: 'object',
    category: 'furniture',
    sprite: {
      url: resolveAssetUrl('/assets/buildings/phone_booth_retro.png'),
      width: 36,
      height: 76,
      pixelArt: true,
    },
    anchor: { x: 18, y: 74 },
    collision: { enabled: true, type: 'box', offsetX: -16, offsetY: -16, width: 32, height: 16 },
    depth: { enabled: true, offsetY: 0 },
    interactions: [
      {
        type: 'inspect',
        label: '公衆電話を使う (右クリック)',
        dialogue: [
          'チャリン... ツー... ツー...',
          '懐かしい緑の公衆電話から受話器の電子音が聞こえる。',
        ],
      },
    ],
    metadata: {
      tags: ['電話ボックス', '公衆電話', '昭和', 'レトロ', '街並み'],
      createdAt: Date.now(),
      source: 'preset',
      description: '赤い屋根とガラス扉がノスタルジックな昭和の公衆電話ボックス。',
    },
  },

  park_fountain: {
    id: 'park_fountain',
    name: '公園の石造り噴水',
    type: 'object',
    category: 'nature',
    sprite: {
      url: svgToUri(parkFountainSvg),
      width: 48,
      height: 48,
      pixelArt: true,
    },
    anchor: { x: 24, y: 44 },
    collision: { enabled: true, type: 'box', offsetX: -20, offsetY: -12, width: 40, height: 12 },
    depth: { enabled: true, offsetY: 0 },
    interactions: [
      {
        type: 'inspect',
        label: '噴水を眺める (右クリック)',
        dialogue: ['ザー…と清らかな水音が心地よく響く。水面にコインが沈んでいる。'],
      },
    ],
    metadata: {
      tags: ['噴水', '公園', '水'],
      createdAt: Date.now(),
      source: 'preset',
      description: '清涼感あふれる公園の噴水。',
    },
  },

  // ランボルギーニ・ウラカン (乗車可能なスーパーカー)
  vehicle_lamborghini: {
    id: 'vehicle_lamborghini',
    name: 'ランボルギーニ',
    type: 'object',
    category: 'vehicle',
    sprite: {
      url: resolveAssetUrl('/assets/vehicles/lamborghini_down.png'),
      width: 58,
      height: 38,
      pixelArt: true,
      directionalUrls: {
        down: resolveAssetUrl('/assets/vehicles/lamborghini_down.png'),
        up: resolveAssetUrl('/assets/vehicles/lamborghini_up.png'),
        left: resolveAssetUrl('/assets/vehicles/lamborghini_left.png'),
        right: resolveAssetUrl('/assets/vehicles/lamborghini_right.png'),
        'down-left': resolveAssetUrl('/assets/vehicles/lamborghini_down_left.png'),
        down_left: resolveAssetUrl('/assets/vehicles/lamborghini_down_left.png'),
        'down-right': resolveAssetUrl('/assets/vehicles/lamborghini_down_right.png'),
        down_right: resolveAssetUrl('/assets/vehicles/lamborghini_down_right.png'),
        'up-left': resolveAssetUrl('/assets/vehicles/lamborghini_up_left.png'),
        up_left: resolveAssetUrl('/assets/vehicles/lamborghini_up_left.png'),
        'up-right': resolveAssetUrl('/assets/vehicles/lamborghini_up_right.png'),
        up_right: resolveAssetUrl('/assets/vehicles/lamborghini_up_right.png'),
      },
    },
    anchor: { x: 29, y: 36 },
    collision: {
      enabled: true,
      type: 'box',
      offsetX: -26,
      offsetY: -16,
      width: 52,
      height: 18,
    },
    depth: { enabled: true, offsetY: 0 },
    interactions: [
      {
        type: 'drive',
        label: '乗る (Fキー / 右クリック)',
        dialogue: ['【ランボルギーニ・ウラカン】V10自然吸気エンジンが始動！Fキーで降車できる。'],
      },
    ],
    metadata: {
      tags: ['乗り物', 'スーパーカー', 'ランボルギーニ', '車'],
      createdAt: Date.now(),
      source: 'preset',
      description: '猛烈なスピードを誇る黄色いスーパーカー。乗車してマップを爆走できる。',
    },
  },

  npc_cat: {
    id: 'npc_cat',
    name: '気ままな三毛猫',
    type: 'character',
    category: 'npc',
    sprite: {
      url: svgToUri(catSvg),
      width: 24,
      height: 20,
      pixelArt: true,
    },
    anchor: { x: 12, y: 18 },
    collision: { enabled: true, type: 'box', offsetX: -6, offsetY: -4, width: 12, height: 4 },
    depth: { enabled: true, offsetY: 0 },
    interactions: [
      {
        type: 'talk',
        label: '猫をなでる (右クリック)',
        dialogue: ['ニャ〜ン♪ 猫はゴロゴロ喉を鳴らしながら体をすり寄せてきた。'],
      },
    ],
    metadata: {
      tags: ['猫', '動物', 'NPC'],
      createdAt: Date.now(),
      source: 'preset',
      description: '陽だまりでお昼寝している可愛い三毛猫。',
    },
  },

  telegraph_pole: {
    id: 'telegraph_pole',
    name: '木造・コンクリート電柱',
    type: 'object',
    category: 'infrastructure',
    sprite: {
      url: svgToUri(telegraphPoleSvg),
      width: 24,
      height: 80,
      pixelArt: true,
    },
    anchor: { x: 12, y: 78 },
    collision: { enabled: true, type: 'box', offsetX: -6, offsetY: -8, width: 12, height: 8 },
    depth: { enabled: true, offsetY: 0 },
    metadata: { tags: ['電柱', 'インフラ', '昭和'], createdAt: Date.now(), source: 'preset' },
  },

  street_lamp_warm: {
    id: 'street_lamp_warm',
    name: 'ノスタルジック街灯',
    type: 'object',
    category: 'infrastructure',
    sprite: {
      url: svgToUri(streetLampSvg),
      width: 16,
      height: 48,
      pixelArt: true,
    },
    anchor: { x: 8, y: 46 },
    collision: { enabled: true, type: 'box', offsetX: -4, offsetY: -4, width: 8, height: 4 },
    depth: { enabled: true, offsetY: 0 },
    metadata: { tags: ['街灯', '夜景', '明かり'], createdAt: Date.now(), source: 'preset' },
  },

  retro_tree: {
    id: 'retro_tree',
    name: 'ケヤキの大木',
    type: 'object',
    category: 'nature',
    sprite: {
      url: resolveAssetUrl('/assets/objects/trees/zelkova_tall.png'),
      width: 68,
      height: 98,
      pixelArt: true,
    },
    anchor: { x: 34, y: 94 },
    collision: { enabled: true, type: 'box', offsetX: -8, offsetY: -8, width: 16, height: 10 },
    depth: { enabled: true, offsetY: 0 },
    metadata: { tags: ['木', '自然', '公園', 'ケヤキ'], createdAt: Date.now(), source: 'preset' },
    interactions: [
      {
        type: 'talk',
        label: '木漏れ日を浴びる',
        dialogue: ['青々とした葉の隙間から、柔らかな木漏れ日が降り注いでいる。深呼吸すると森の香りがした。'],
      },
    ],
  },

  tree_sakura_dome: {
    id: 'tree_sakura_dome',
    name: '満開の桜（大樹）',
    type: 'object',
    category: 'nature',
    sprite: {
      url: resolveAssetUrl('/assets/objects/trees/sakura_dome.png'),
      width: 80,
      height: 96,
      pixelArt: true,
    },
    anchor: { x: 40, y: 92 },
    collision: { enabled: true, type: 'box', offsetX: -8, offsetY: -8, width: 16, height: 10 },
    depth: { enabled: true, offsetY: 0 },
    metadata: { tags: ['春', '桜', '自然', '花見'], createdAt: Date.now(), source: 'preset' },
    interactions: [
      {
        type: 'talk',
        label: 'お花見をする',
        dialogue: ['淡いピンクの花弁が満開に咲き誇っている。風が吹くたびにかすかな甘い香りが漂う。'],
      },
    ],
  },

  tree_sakura_weeping: {
    id: 'tree_sakura_weeping',
    name: 'しだれ桜',
    type: 'object',
    category: 'nature',
    sprite: {
      url: resolveAssetUrl('/assets/objects/trees/sakura_weeping.png'),
      width: 72,
      height: 104,
      pixelArt: true,
    },
    anchor: { x: 36, y: 100 },
    collision: { enabled: true, type: 'box', offsetX: -8, offsetY: -8, width: 16, height: 10 },
    depth: { enabled: true, offsetY: 0 },
    metadata: { tags: ['春', '桜', 'しだれ桜', '名木'], createdAt: Date.now(), source: 'preset' },
    interactions: [
      {
        type: 'talk',
        label: '枝垂れる桜を見上げる',
        dialogue: ['流れる滝のように咲きこぼれるしだれ桜。見上げると春の空一面が桜色に染まっている。'],
      },
    ],
  },

  tree_sakura_bonsai: {
    id: 'tree_sakura_bonsai',
    name: '古木の一本桜',
    type: 'object',
    category: 'nature',
    sprite: {
      url: resolveAssetUrl('/assets/objects/trees/sakura_bonsai.png'),
      width: 90,
      height: 88,
      pixelArt: true,
    },
    anchor: { x: 45, y: 84 },
    collision: { enabled: true, type: 'box', offsetX: -10, offsetY: -8, width: 20, height: 10 },
    depth: { enabled: true, offsetY: 0 },
    metadata: { tags: ['春', '桜', '古木', '歴史'], createdAt: Date.now(), source: 'preset' },
    interactions: [
      {
        type: 'talk',
        label: '古木の幹に触れる',
        dialogue: ['何十年もの年月を生き抜いてきた堂々たる幹。春の生命力にあふれている。'],
      },
    ],
  },

  tree_ginkgo_flame: {
    id: 'tree_ginkgo_flame',
    name: '黄金色のイチョウ',
    type: 'object',
    category: 'nature',
    sprite: {
      url: resolveAssetUrl('/assets/objects/trees/ginkgo_flame.png'),
      width: 72,
      height: 100,
      pixelArt: true,
    },
    anchor: { x: 36, y: 96 },
    collision: { enabled: true, type: 'box', offsetX: -8, offsetY: -8, width: 16, height: 10 },
    depth: { enabled: true, offsetY: 0 },
    metadata: { tags: ['秋', 'イチョウ', '紅葉', '黄金色'], createdAt: Date.now(), source: 'preset' },
    interactions: [
      {
        type: 'talk',
        label: '黄金の葉を拾う',
        dialogue: ['鮮やかな黄金色に染まったイチョウの葉。秋の陽光を受けて黄金色に輝いている。'],
      },
    ],
  },

  tree_ginkgo_grand: {
    id: 'tree_ginkgo_grand',
    name: '大イチョウの御神木',
    type: 'object',
    category: 'nature',
    sprite: {
      url: resolveAssetUrl('/assets/objects/trees/ginkgo_grand.png'),
      width: 96,
      height: 98,
      pixelArt: true,
    },
    anchor: { x: 48, y: 94 },
    collision: { enabled: true, type: 'box', offsetX: -12, offsetY: -8, width: 24, height: 12 },
    depth: { enabled: true, offsetY: 0 },
    metadata: { tags: ['秋', 'イチョウ', '大樹', '名木'], createdAt: Date.now(), source: 'preset' },
    interactions: [
      {
        type: 'talk',
        label: '大樹を見上げる',
        dialogue: ['公園の空を覆うほどの巨大なイチョウ。足元には黄金の絨毯が広がっている。'],
      },
    ],
  },

  tree_maple_umbrella: {
    id: 'tree_maple_umbrella',
    name: '深紅のもみじ',
    type: 'object',
    category: 'nature',
    sprite: {
      url: resolveAssetUrl('/assets/objects/trees/maple_umbrella.png'),
      width: 80,
      height: 90,
      pixelArt: true,
    },
    anchor: { x: 40, y: 86 },
    collision: { enabled: true, type: 'box', offsetX: -8, offsetY: -8, width: 16, height: 10 },
    depth: { enabled: true, offsetY: 0 },
    metadata: { tags: ['秋', 'もみじ', '紅葉', '深紅'], createdAt: Date.now(), source: 'preset' },
    interactions: [
      {
        type: 'talk',
        label: '紅葉狩りをする',
        dialogue: ['燃えるような赤と朱色が重なり合う美しいもみじ。秋の風情が心に染み渡る。'],
      },
    ],
  },

  tree_pine_snow: {
    id: 'tree_pine_snow',
    name: '雪化粧の和風黒松',
    type: 'object',
    category: 'nature',
    sprite: {
      url: resolveAssetUrl('/assets/objects/trees/pine_snow_propped.png'),
      width: 80,
      height: 104,
      pixelArt: true,
    },
    anchor: { x: 40, y: 100 },
    collision: { enabled: true, type: 'box', offsetX: -8, offsetY: -8, width: 16, height: 10 },
    depth: { enabled: true, offsetY: 0 },
    metadata: { tags: ['冬', '松', '雪', '和風'], createdAt: Date.now(), source: 'preset' },
    interactions: [
      {
        type: 'talk',
        label: '雪の積もる枝を眺める',
        dialogue: ['常緑の松葉の上にふんわりと積もった白雪。凛とした冬の佇まいが美しい。'],
      },
    ],
  },

  tree_winter_bare: {
    id: 'tree_winter_bare',
    name: '冬枯れのケヤキ',
    type: 'object',
    category: 'nature',
    sprite: {
      url: resolveAssetUrl('/assets/objects/trees/winter_icicle.png'),
      width: 76,
      height: 102,
      pixelArt: true,
    },
    anchor: { x: 38, y: 98 },
    collision: { enabled: true, type: 'box', offsetX: -8, offsetY: -8, width: 16, height: 10 },
    depth: { enabled: true, offsetY: 0 },
    metadata: { tags: ['冬', '冬木立', '氷柱', '静寂'], createdAt: Date.now(), source: 'preset' },
    interactions: [
      {
        type: 'talk',
        label: '冬の木立を眺める',
        dialogue: ['葉を落とした繊細な枝先に、小さな氷柱がキラキラと光っている。春を静かに待つ大樹。'],
      },
    ],
  },

  tree_apple_ripe: {
    id: 'tree_apple_ripe',
    name: '実りのリンゴの木',
    type: 'object',
    category: 'nature',
    sprite: {
      url: resolveAssetUrl('/assets/objects/trees/apple_ripe.png'),
      width: 68,
      height: 104,
      pixelArt: true,
    },
    anchor: { x: 34, y: 100 },
    collision: { enabled: true, type: 'box', offsetX: -8, offsetY: -8, width: 16, height: 10 },
    depth: { enabled: true, offsetY: 0 },
    metadata: { tags: ['夏', '果樹', 'リンゴ', '収穫'], createdAt: Date.now(), source: 'preset' },
    interactions: [
      {
        type: 'talk',
        label: 'リンゴをもぎ取る',
        dialogue: ['真っ赤に熟した甘いリンゴをもぎ取った！みずみずしい果汁が口いっぱいに広がった。'],
      },
    ],
  },

  retro_bench: {
    id: 'retro_bench',
    name: '木製ベンチ',
    type: 'object',
    category: 'furniture',
    sprite: {
      url: resolveAssetUrl('/assets/objects/bench_down.png'),
      width: 48,
      height: 36,
      pixelArt: true,
      directionalUrls: {
        down: resolveAssetUrl('/assets/objects/bench_down.png'),
        'down-left': resolveAssetUrl('/assets/objects/bench_down-left.png'),
        left: resolveAssetUrl('/assets/objects/bench_left.png'),
        'up-left': resolveAssetUrl('/assets/objects/bench_up-left.png'),
        up: resolveAssetUrl('/assets/objects/bench_up.png'),
        'up-right': resolveAssetUrl('/assets/objects/bench_up-right.png'),
        right: resolveAssetUrl('/assets/objects/bench_right.png'),
        'down-right': resolveAssetUrl('/assets/objects/bench_down-right.png'),
      },
    },
    anchor: { x: 24, y: 34 },
    collision: { enabled: true, type: 'box', offsetX: -20, offsetY: -8, width: 40, height: 10 },
    depth: { enabled: true, offsetY: 0 },
    interactions: [
      {
        type: 'sit',
        label: '座ってひと休み (右クリック / F)',
        dialogue: ['ベンチに腰掛けると、心地よい風が吹き抜けた。HPが全快した！'],
      },
    ],
    metadata: { tags: ['ベンチ', '公園', '休憩', '家具', '木製'], createdAt: Date.now(), source: 'preset' },
  },

  station_sign: {
    id: 'station_sign',
    name: '国鉄風駅名標',
    type: 'object',
    category: 'infrastructure',
    sprite: {
      url: svgToUri(stationSignSvg),
      width: 40,
      height: 36,
      pixelArt: true,
    },
    anchor: { x: 20, y: 34 },
    collision: { enabled: true, type: 'box', offsetX: -16, offsetY: -6, width: 32, height: 6 },
    depth: { enabled: true, offsetY: 0 },
    interactions: [
      {
        type: 'inspect',
        label: '駅名標を読む (右クリック)',
        dialogue: ['「あいらす」駅。次の駅は「みらい」。前の駅は「しょうわ」。'],
      },
    ],
    metadata: { tags: ['駅', '看板', '鉄道'], createdAt: Date.now(), source: 'preset' },
  },

  // 11. 女子生徒（8方向高解像度ピクセルアートスプライト対応）
  character_schoolgirl: {
    id: 'character_schoolgirl',
    name: '女子高校生（あおい）',
    type: 'character',
    category: 'npc',
    sprite: {
      url: resolveAssetUrl('/assets/characters/schoolgirl_down.png'),
      width: 20,
      height: 50,
      pixelArt: true,
      directionalUrls: {
        down: resolveAssetUrl('/assets/characters/schoolgirl_down.png'),
        up: resolveAssetUrl('/assets/characters/schoolgirl_up.png'),
        left: resolveAssetUrl('/assets/characters/schoolgirl_left.png'),
        right: resolveAssetUrl('/assets/characters/schoolgirl_right.png'),
        'down-left': resolveAssetUrl('/assets/characters/schoolgirl_down_left.png'),
        'down-right': resolveAssetUrl('/assets/characters/schoolgirl_down_right.png'),
        'up-left': resolveAssetUrl('/assets/characters/schoolgirl_up_left.png'),
        'up-right': resolveAssetUrl('/assets/characters/schoolgirl_up_right.png'),
      },
    },
    anchor: { x: 10, y: 48 },
    collision: { enabled: true, type: 'box', offsetX: -5, offsetY: -6, width: 10, height: 6 },
    depth: { enabled: true, offsetY: 0 },
    interactions: [
      {
        type: 'talk',
        label: '話しかける (右クリック)',
        dialogue: [
          'あおい「こんにちは！駅前の喫茶店、オムライスとプリンが絶品だよ。」',
          'あおい「Spaceキーでジャンプ、Ctrlキーでダッシュできるの知ってた？」',
        ],
      },
    ],
    metadata: { tags: ['NPC', '高校生', 'アバター'], createdAt: Date.now(), source: 'preset' },
  },

  // 12. 昭和少年（ケンタ）
  character_boy: {
    id: 'character_boy',
    name: '昭和少年（ケンタ）',
    type: 'character',
    category: 'npc',
    sprite: {
      url: svgToUri(boyDownSvg),
      width: 24,
      height: 36,
      pixelArt: true,
      directionalUrls: {
        down: svgToUri(boyDownSvg),
        up: svgToUri(boyUpSvg),
        left: svgToUri(boyLeftSvg),
        right: svgToUri(boyRightSvg),
      },
    },
    anchor: { x: 12, y: 34 },
    collision: { enabled: true, type: 'box', offsetX: -6, offsetY: -6, width: 12, height: 6 },
    depth: { enabled: true, offsetY: 0 },
    interactions: [
      {
        type: 'talk',
        label: '話しかける (右クリック)',
        dialogue: [
          'ケンタ「公園の噴水の横で、たまにすっごい綺麗なアゲハチョウが飛んでるんだぜ！」',
          'ケンタ「走る時はCtrlキー長押しだぞ！」',
        ],
      },
    ],
    metadata: { tags: ['少年', 'アバター', 'NPC'], createdAt: Date.now(), source: 'preset' },
  },

  // 13. サラリーマン（たなか）
  character_salaryman: {
    id: 'character_salaryman',
    name: '会社員（たなか）',
    type: 'character',
    category: 'npc',
    sprite: {
      url: svgToUri(salarymanDownSvg),
      width: 24,
      height: 38,
      pixelArt: true,
      directionalUrls: {
        down: svgToUri(salarymanDownSvg),
        up: svgToUri(salarymanUpSvg),
        left: svgToUri(salarymanLeftSvg),
        right: svgToUri(salarymanRightSvg),
      },
    },
    anchor: { x: 12, y: 36 },
    collision: { enabled: true, type: 'box', offsetX: -6, offsetY: -6, width: 12, height: 6 },
    depth: { enabled: true, offsetY: 0 },
    interactions: [
      {
        type: 'talk',
        label: '話しかける (右クリック)',
        dialogue: [
          'たなか「ふう、外回り営業の合間の自販機のコーラは最高ですな。」',
          'たなか「喫茶店のマスターとはもう20年の付き合いなんですよ。」',
        ],
      },
    ],
    metadata: { tags: ['会社員', '大人', 'アバター', 'NPC'], createdAt: Date.now(), source: 'preset' },
  },

  tile_rail: {
    id: 'tile_rail',
    name: '線路レール',
    type: 'tile',
    category: 'tile',
    sprite: {
      url: svgToUri(railTrackTileSvg),
      width: 32,
      height: 32,
      pixelArt: true,
    },
    anchor: { x: 0, y: 0 },
    collision: { enabled: false, type: 'none', offsetX: 0, offsetY: 0, width: 0, height: 0 },
    depth: { enabled: false, offsetY: 0 },
    metadata: { tags: ['線路', '鉄道'], createdAt: Date.now(), source: 'preset' },
  },

  tile_asphalt: {
    id: 'tile_asphalt',
    name: 'アスファルト道路',
    type: 'tile',
    category: 'tile',
    sprite: {
      url: svgToUri(asphaltTileSvg),
      width: 32,
      height: 32,
      pixelArt: true,
    },
    anchor: { x: 0, y: 0 },
    collision: { enabled: false, type: 'none', offsetX: 0, offsetY: 0, width: 0, height: 0 },
    depth: { enabled: false, offsetY: 0 },
    metadata: { tags: ['道路'], createdAt: Date.now(), source: 'preset' },
  },

  tile_sidewalk: {
    id: 'tile_sidewalk',
    name: '歩道敷石',
    type: 'tile',
    category: 'tile',
    sprite: {
      url: svgToUri(sidewalkTileSvg),
      width: 32,
      height: 32,
      pixelArt: true,
    },
    anchor: { x: 0, y: 0 },
    collision: { enabled: false, type: 'none', offsetX: 0, offsetY: 0, width: 0, height: 0 },
    depth: { enabled: false, offsetY: 0 },
    metadata: { tags: ['歩道'], createdAt: Date.now(), source: 'preset' },
  },

  tile_grass: {
    id: 'tile_grass',
    name: '草地・公園',
    type: 'tile',
    category: 'tile',
    sprite: {
      url: svgToUri(grassTileSvg),
      width: 32,
      height: 32,
      pixelArt: true,
    },
    anchor: { x: 0, y: 0 },
    collision: { enabled: false, type: 'none', offsetX: 0, offsetY: 0, width: 0, height: 0 },
    depth: { enabled: false, offsetY: 0 },
    metadata: { tags: ['草地', '自然'], createdAt: Date.now(), source: 'preset' },
  },

  // 🌊 超リアルな川・清流タイル
  tile_water: {
    id: 'tile_water',
    name: '川・清流の水面',
    type: 'tile',
    category: 'tile',
    sprite: {
      url: svgToUri(waterTileSvg),
      width: 32,
      height: 32,
      pixelArt: true,
    },
    anchor: { x: 0, y: 0 },
    collision: { enabled: false, type: 'none', offsetX: 0, offsetY: 0, width: 0, height: 0 },
    depth: { enabled: false, offsetY: 0 },
    metadata: { tags: ['川', '水', '清流', '自然'], createdAt: Date.now(), source: 'preset' },
  },

  // 🏖️ 黄金の砂浜タイル (ビーチ・湖畔)
  tile_sand: {
    id: 'tile_sand',
    name: '黄金の砂浜・湖畔',
    type: 'tile',
    category: 'tile',
    sprite: {
      url: svgToUri(sandTileSvg),
      width: 32,
      height: 32,
      pixelArt: true,
    },
    anchor: { x: 0, y: 0 },
    collision: { enabled: false, type: 'none', offsetX: 0, offsetY: 0, width: 0, height: 0 },
    depth: { enabled: false, offsetY: 0 },
    metadata: { tags: ['砂浜', '湖畔', 'ビーチ', '自然'], createdAt: Date.now(), source: 'preset' },
  },

  // 🪣 空のバケツ (水を汲むツール)
  tool_bucket_empty: {
    id: 'tool_bucket_empty',
    name: '空のブリキバケツ',
    type: 'object',
    category: 'item',
    sprite: {
      url: svgToUri(bucketEmptySvg),
      width: 32,
      height: 32,
      pixelArt: true,
    },
    anchor: { x: 16, y: 28 },
    collision: { enabled: false, type: 'none', offsetX: 0, offsetY: 0, width: 0, height: 0 },
    depth: { enabled: true, offsetY: 0 },
    metadata: { tags: ['バケツ', '道具', '水汲み'], createdAt: Date.now(), source: 'preset' },
  },

  // 🌊 水入りバケツ (水を流して川を作るツール)
  tool_bucket_water: {
    id: 'tool_bucket_water',
    name: '水入りバケツ',
    type: 'object',
    category: 'item',
    sprite: {
      url: svgToUri(bucketWaterSvg),
      width: 32,
      height: 32,
      pixelArt: true,
    },
    anchor: { x: 16, y: 28 },
    collision: { enabled: false, type: 'none', offsetX: 0, offsetY: 0, width: 0, height: 0 },
    depth: { enabled: true, offsetY: 0 },
    metadata: { tags: ['バケツ', '川作り', '水'], createdAt: Date.now(), source: 'preset' },
  },

  // 🛏️ ふかふかダブルベッド (一緒に寝られる)
  furniture_bed_double: {
    id: 'furniture_bed_double',
    name: '昭和レトロなふかふかダブルベッド',
    type: 'object',
    category: 'furniture',
    sprite: {
      url: svgToUri(doubleBedSvg),
      width: 48,
      height: 44,
      pixelArt: true,
    },
    anchor: { x: 24, y: 38 },
    collision: { enabled: true, type: 'box', offsetX: 4, offsetY: 12, width: 40, height: 26 },
    depth: { enabled: true, offsetY: 0 },
    interactions: [
      {
        type: 'sleep',
        label: '一緒にベッドで寝る',
      },
    ],
    metadata: { tags: ['家具', 'ベッド', '寝る', 'マイホーム'], createdAt: Date.now(), source: 'preset' },
  },
};
