import React from 'react';
import { useWorldStore } from '../../store/useWorldStore';
import { useUIStore } from '../../store/useUIStore';
import { Sparkles, MousePointer } from 'lucide-react';
import { resolveAssetUrl } from '../../core/utils/url';

interface AssetPaletteBarProps {
  isVisible: boolean;
}

export const AssetPaletteBar: React.FC<AssetPaletteBarProps> = ({ isVisible }) => {
  const { assets } = useWorldStore();
  const { placingAssetId, setPlacingAssetId, activeTool, setActiveTool, setAIPanelOpen } = useUIStore();

  if (!isVisible) return null;

  // 配置可能なオブジェクト一覧 (タイル以外)
  const placeableAssets = Object.values(assets).filter((a) => a.type !== 'tile');

  return (
    <div className="hidden md:flex absolute bottom-4 left-1/2 -translate-x-1/2 z-30 max-w-[95vw] overflow-x-auto p-1.5 glass-panel rounded-2xl border border-white/15 shadow-2xl items-center gap-1.5 animate-in fade-in slide-in-from-bottom-4 duration-200">
      {/* 選択ツール */}
      <button
        onClick={() => {
          setActiveTool('select');
          setPlacingAssetId(null);
        }}
        className={`px-3 py-2 rounded-xl flex items-center gap-1.5 text-xs font-medium transition-all ${
          activeTool === 'select' && !placingAssetId
            ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/40 shadow-sm'
            : 'text-slate-400 hover:text-white hover:bg-white/10'
        }`}
        title="選択・移動ツール"
      >
        <MousePointer className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">選択</span>
      </button>

      <div className="w-[1px] h-6 bg-white/10 mx-0.5" />

      {/* アセットスロット一覧 (マインクラフト風ホットバー 1〜9) */}
      <div className="flex items-center gap-1">
        {placeableAssets.slice(0, 9).map((asset, index) => {
          const isSelected = placingAssetId === asset.id;
          const slotNumber = index + 1;

          return (
            <button
              key={asset.id}
              onClick={() => {
                if (isSelected) {
                  setPlacingAssetId(null);
                  setActiveTool('select');
                } else {
                  setPlacingAssetId(asset.id);
                  setActiveTool('place');
                }
              }}
              className={`p-1.5 rounded-xl flex flex-col items-center gap-1 transition-all group relative ${
                isSelected
                  ? 'bg-amber-500/30 border border-amber-400/60 shadow-md ring-2 ring-amber-400/40'
                  : 'hover:bg-white/10 border border-transparent text-slate-300'
              }`}
              title={`[${slotNumber}] ${asset.name} をマップに配置`}
            >
              {/* スロット番号バッジ */}
              <span className="absolute top-0.5 left-1 text-[9px] font-mono text-slate-400 font-bold">
                {slotNumber}
              </span>

              <div className="w-9 h-9 rounded-lg bg-slate-900/60 border border-white/10 flex items-center justify-center p-1 overflow-hidden">
                <img
                  src={resolveAssetUrl(asset.sprite.url)}
                  alt={asset.name}
                  className="max-w-full max-h-full pixelated object-contain group-hover:scale-110 transition-transform"
                />
              </div>
              <span className="text-[10px] max-w-[56px] truncate font-medium text-slate-300 group-hover:text-white">
                {asset.name}
              </span>
            </button>
          );
        })}
      </div>

      <div className="w-[1px] h-6 bg-white/10 mx-0.5" />

      {/* AI生成ボタン */}
      <button
        onClick={() => setAIPanelOpen(true)}
        className="px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/35 hover:to-blue-500/35 border border-cyan-400/40 text-cyan-200 hover:text-white flex items-center gap-1.5 text-xs font-semibold transition-all shadow-sm flex-shrink-0"
      >
        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
        <span>AI創出</span>
      </button>
    </div>
  );
};
