import React from 'react';
import { useWorldStore } from '../../store/useWorldStore';
import { useUIStore } from '../../store/useUIStore';
import { Sparkles, MousePointer, Backpack } from 'lucide-react';
import { resolveAssetUrl } from '../../core/utils/url';

interface AssetPaletteBarProps {
  isVisible: boolean;
}

export const AssetPaletteBar: React.FC<AssetPaletteBarProps> = ({ isVisible }) => {
  const { assets } = useWorldStore();
  const {
    placingAssetId,
    setPlacingAssetId,
    activeTool,
    setActiveTool,
    setAIPanelOpen,
    hotbarSlots,
    setIsInventoryOpen,
  } = useUIStore();

  if (!isVisible) return null;

  return (
    <div className="hidden md:flex absolute bottom-4 left-1/2 -translate-x-1/2 z-30 max-w-[98vw] p-1.5 glass-panel rounded-2xl border border-white/15 shadow-2xl items-center gap-1.5 animate-in fade-in slide-in-from-bottom-4 duration-200">
      {/* 選択ツール */}
      <button
        onClick={() => {
          setActiveTool('select');
          setPlacingAssetId(null);
        }}
        className={`px-2.5 py-2 rounded-xl flex items-center gap-1.5 text-xs font-medium transition-all ${
          activeTool === 'select' && !placingAssetId
            ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/40 shadow-sm'
            : 'text-slate-400 hover:text-white hover:bg-white/10'
        }`}
        title="選択・移動ツール"
      >
        <MousePointer className="w-3.5 h-3.5" />
        <span className="hidden lg:inline">選択</span>
      </button>

      {/* 🎒 インベントリボタン (Eキー対応) */}
      <button
        onClick={() => setIsInventoryOpen(true)}
        className="px-2.5 py-2 rounded-xl flex items-center gap-1.5 text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 hover:text-white border border-amber-400/40 transition-all shadow-sm cursor-pointer active:scale-95"
        title="マイクラ風全アイテムインベントリを開く (Eキー)"
      >
        <Backpack className="w-3.5 h-3.5 text-amber-300" />
        <span className="hidden sm:inline">持物</span>
        <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-amber-950/60 text-amber-300 border border-amber-400/30">E</span>
      </button>

      <div className="w-[1px] h-6 bg-white/10 mx-0.5" />

      {/* 🎒 10枠固定ホットバー (1〜9, 0) */}
      <div className="flex items-center gap-1">
        {hotbarSlots.map((assetId, index) => {
          const asset = assets[assetId];
          const isSelected = placingAssetId === assetId;
          const slotLabel = index === 9 ? '0' : (index + 1).toString();

          return (
            <button
              key={index}
              onClick={() => {
                if (!asset) {
                  setIsInventoryOpen(true);
                  return;
                }
                if (isSelected) {
                  setPlacingAssetId(null);
                  setActiveTool('select');
                } else {
                  setPlacingAssetId(asset.id);
                  setActiveTool('place');
                }
              }}
              className={`p-1.5 rounded-xl flex flex-col items-center gap-1 transition-all group relative flex-shrink-0 w-14 ${
                isSelected
                  ? 'bg-amber-500/30 border border-amber-400/60 shadow-md ring-2 ring-amber-400/40'
                  : 'hover:bg-white/10 border border-transparent text-slate-300'
              }`}
              title={asset ? `[${slotLabel}] ${asset.name} をマップに配置` : `[${slotLabel}] 空スロット (クリックでアイテム選択)`}
            >
              {/* スロット番号バッジ (1〜9, 0) */}
              <span className="absolute top-0.5 left-1.5 text-[9px] font-mono text-slate-400 font-bold group-hover:text-amber-300">
                {slotLabel}
              </span>

              <div className="w-9 h-9 rounded-lg bg-slate-900/60 border border-white/10 flex items-center justify-center p-1 overflow-hidden">
                {asset ? (
                  <img
                    src={resolveAssetUrl(asset.sprite.url)}
                    alt={asset.name}
                    className="max-w-full max-h-full pixelated object-contain group-hover:scale-110 transition-transform"
                  />
                ) : (
                  <span className="text-slate-600 text-xs font-bold">+</span>
                )}
              </div>
              <span className="text-[9px] max-w-[50px] truncate font-medium text-slate-300 group-hover:text-white">
                {asset ? asset.name : '空'}
              </span>
            </button>
          );
        })}
      </div>

      <div className="w-[1px] h-6 bg-white/10 mx-0.5" />

      {/* AI生成ボタン */}
      <button
        onClick={() => setAIPanelOpen(true)}
        className="px-2.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/35 hover:to-blue-500/35 border border-cyan-400/40 text-cyan-200 hover:text-white flex items-center gap-1.5 text-xs font-semibold transition-all shadow-sm flex-shrink-0"
      >
        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
        <span className="hidden lg:inline">AI創出</span>
      </button>
    </div>
  );
};
