import React, { useState, useEffect } from 'react';
import { useWorldStore } from '../../store/useWorldStore';
import { useUIStore, DEFAULT_HOTBAR_SLOTS } from '../../store/useUIStore';
import { resolveAssetUrl } from '../../core/utils/url';
import {
  X,
  Search,
  RotateCcw,
  Layers,
  Home,
  Trees,
  Armchair,
  Car,
  Lightbulb,
  Users,
  Grid,
} from 'lucide-react';
import { AirasAsset } from '../../core/types/asset';

type CategoryFilter = 'all' | 'structure' | 'nature' | 'furniture' | 'vehicle' | 'infrastructure' | 'character' | 'tile';

export const InventoryModal: React.FC = () => {
  const { assets } = useWorldStore();
  const {
    isInventoryOpen,
    setIsInventoryOpen,
    hotbarSlots,
    setHotbarSlot,
    resetHotbarSlots,
    setPlacingAssetId,
    setActiveTool,
    showNotification,
  } = useUIStore();

  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssetForAssign, setSelectedAssetForAssign] = useState<string | null>(null);

  // ESCキーまたはEキーで閉じる
  useEffect(() => {
    if (!isInventoryOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';

      if (e.key === 'Escape' || ((e.key === 'e' || e.key === 'E') && !isInput)) {
        e.preventDefault();
        e.stopPropagation();
        setIsInventoryOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInventoryOpen, setIsInventoryOpen]);

  if (!isInventoryOpen) return null;

  // カテゴリ分類判定
  const getAssetCategory = (asset: AirasAsset): CategoryFilter => {
    if (asset.type === 'tile') return 'tile';
    const id = asset.id.toLowerCase();
    const cat = (asset.category || '').toLowerCase();

    if (id.includes('character') || id.includes('npc') || id.includes('cat') || cat === 'character') return 'character';
    if (id.includes('vehicle') || id.includes('car') || id.includes('lamborghini') || cat === 'vehicle') return 'vehicle';
    if (id.includes('tree') || id.includes('sakura') || id.includes('flower') || id.includes('ginkgo') || cat === 'nature') return 'nature';
    if (id.includes('lamp') || id.includes('light') || id.includes('pole') || id.includes('station') || id.includes('sign') || id.includes('fountain')) return 'infrastructure';
    if (id.includes('cafe') || id.includes('house') || id.includes('building') || cat === 'structure') return 'structure';
    if (id.includes('bench') || id.includes('bed') || id.includes('vending') || id.includes('furniture') || cat === 'furniture') return 'furniture';
    return 'furniture';
  };

  const categories: { key: CategoryFilter; label: string; icon: React.ReactNode }[] = [
    { key: 'all', label: 'すべて', icon: <Layers className="w-4 h-4" /> },
    { key: 'structure', label: '建築・店', icon: <Home className="w-4 h-4" /> },
    { key: 'nature', label: '自然・樹木', icon: <Trees className="w-4 h-4" /> },
    { key: 'furniture', label: '家具・施設', icon: <Armchair className="w-4 h-4" /> },
    { key: 'vehicle', label: '乗り物', icon: <Car className="w-4 h-4" /> },
    { key: 'infrastructure', label: '街灯・設備', icon: <Lightbulb className="w-4 h-4" /> },
    { key: 'character', label: 'NPC・生物', icon: <Users className="w-4 h-4" /> },
    { key: 'tile', label: 'タイル・道', icon: <Grid className="w-4 h-4" /> },
  ];

  // フィルタリングされたアセット一覧
  const allAssetsList = Object.values(assets);
  const filteredAssets = allAssetsList.filter((asset) => {
    if (selectedCategory !== 'all') {
      const cat = getAssetCategory(asset);
      if (cat !== selectedCategory) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = asset.name.toLowerCase().includes(q);
      const matchId = asset.id.toLowerCase().includes(q);
      const matchTags = (asset.metadata.tags || []).some((t) => t.toLowerCase().includes(q));
      const matchDesc = (asset.metadata.description || '').toLowerCase().includes(q);
      if (!matchName && !matchId && !matchTags && !matchDesc) return false;
    }
    return true;
  });

  // スロットへのアサイン処理
  const handleAssignToSlot = (slotIdx: number, assetId: string) => {
    setHotbarSlot(slotIdx, assetId);
    const asset = assets[assetId];
    showNotification(`スロット [${slotIdx === 9 ? 0 : slotIdx + 1}] に「${asset?.name || assetId}」をセットしました`);
    setSelectedAssetForAssign(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={() => setIsInventoryOpen(false)}
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] flex flex-col glass-panel rounded-3xl border border-white/20 shadow-2xl bg-slate-900/95 overflow-hidden text-slate-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー: タイトル & 検索 & 閉じる */}
        <header className="p-4 sm:px-6 border-b border-white/10 flex items-center justify-between gap-3 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-wide flex items-center gap-2">
                <span>アイテム・インベントリ</span>
                <span className="text-xs font-mono font-normal px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
                  全 {allAssetsList.length} 種
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                アイテムをクリックして下のスロット（1〜0）に自由にセットできます [E または ESC で閉じる]
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 検索入力 */}
            <div className="relative w-36 sm:w-56">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="アイテムを検索..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-800/80 border border-white/10 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* 閉じるボタン */}
            <button
              onClick={() => setIsInventoryOpen(false)}
              className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
              title="閉じる (ESC / E)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* カテゴリタブ */}
        <div className="px-4 sm:px-6 py-2 border-b border-white/10 flex items-center gap-1.5 overflow-x-auto scrollbar-none bg-slate-950/30 shrink-0">
          {categories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat.key
                  ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
              }`}
            >
              {cat.icon}
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* アイテムグリッド一覧 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-2.5">
          {filteredAssets.map((asset) => {
            const isSelected = selectedAssetForAssign === asset.id;
            const inHotbarIndex = hotbarSlots.indexOf(asset.id);

            return (
              <div
                key={asset.id}
                onClick={() => {
                  if (selectedAssetForAssign === asset.id) {
                    setSelectedAssetForAssign(null);
                  } else {
                    setSelectedAssetForAssign(asset.id);
                  }
                }}
                className={`p-2 rounded-2xl flex flex-col items-center justify-between gap-1.5 border transition-all cursor-pointer relative group ${
                  isSelected
                    ? 'bg-amber-500/30 border-amber-400 ring-2 ring-amber-400/50 shadow-lg scale-105'
                    : 'bg-slate-800/50 hover:bg-slate-800/80 border-white/10 hover:border-white/20'
                }`}
              >
                {/* すでにホットバーにある場合のバッジ */}
                {inHotbarIndex !== -1 && (
                  <span className="absolute top-1.5 right-1.5 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-cyan-950/90 text-cyan-300 border border-cyan-500/40">
                    {inHotbarIndex === 9 ? '0' : inHotbarIndex + 1}
                  </span>
                )}

                {/* 選択マーク */}
                {isSelected && (
                  <div className="absolute top-1.5 left-1.5 w-4 h-4 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center text-[10px] font-bold">
                    ✓
                  </div>
                )}

                {/* アイコン */}
                <div className="w-14 h-14 rounded-xl bg-slate-950/70 border border-white/10 flex items-center justify-center p-1.5 overflow-hidden">
                  <img
                    src={resolveAssetUrl(asset.sprite.url)}
                    alt={asset.name}
                    className="max-w-full max-h-full pixelated object-contain group-hover:scale-110 transition-transform"
                  />
                </div>

                {/* アイテム名 */}
                <span className="text-[11px] font-medium text-center text-slate-200 line-clamp-1 group-hover:text-white">
                  {asset.name}
                </span>

                {/* クイック選択（今すぐマップに配置） */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPlacingAssetId(asset.id);
                    setActiveTool('place');
                    setIsInventoryOpen(false);
                    showNotification(`「${asset.name}」を配置モードに設定しました`);
                  }}
                  className="w-full py-0.5 rounded-lg text-[10px] font-semibold bg-white/5 hover:bg-cyan-500/30 text-slate-300 hover:text-cyan-200 border border-transparent hover:border-cyan-400/30 transition-all opacity-0 group-hover:opacity-100"
                >
                  即配置
                </button>
              </div>
            );
          })}

          {filteredAssets.length === 0 && (
            <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-400">
              <Search className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">該当するアイテムが見つかりませんでした</p>
            </div>
          )}
        </div>

        {/* フッター: ホットバー設定エリア（1〜0の10スロット） */}
        <footer className="p-4 sm:px-6 border-t border-white/15 bg-slate-950/85 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-wide text-amber-300 flex items-center gap-1.5">
                <span>🎒</span>
                <span>ホットバー設定（キー 1〜9, 0）</span>
              </span>
              {selectedAssetForAssign && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/40 animate-pulse font-medium">
                  セット先のスロットをクリックしてください
                </span>
              )}
            </div>

            <button
              onClick={resetHotbarSlots}
              className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 hover:underline transition-all cursor-pointer"
              title="初期のホットバー配置に戻す"
            >
              <RotateCcw className="w-3 h-3" />
              <span>初期配置に戻す</span>
            </button>
          </div>

          {/* 10スロットグリッド */}
          <div className="grid grid-cols-10 gap-1.5 sm:gap-2">
            {hotbarSlots.map((assetId, index) => {
              const asset = assets[assetId];
              const slotLabel = index === 9 ? '0' : (index + 1).toString();

              return (
                <div
                  key={index}
                  onClick={() => {
                    if (selectedAssetForAssign) {
                      handleAssignToSlot(index, selectedAssetForAssign);
                    } else if (asset) {
                      setPlacingAssetId(asset.id);
                      setActiveTool('place');
                      setIsInventoryOpen(false);
                      showNotification(`スロット [${slotLabel}]:「${asset.name}」を選択`);
                    }
                  }}
                  className={`p-1 sm:p-1.5 rounded-xl flex flex-col items-center gap-1 border transition-all cursor-pointer relative group ${
                    selectedAssetForAssign
                      ? 'bg-amber-950/40 hover:bg-amber-500/25 border-amber-400/60 hover:border-amber-300 ring-1 ring-amber-400/30'
                      : 'bg-slate-900/70 hover:bg-slate-800/80 border-white/10 hover:border-white/20'
                  }`}
                  title={asset ? `[${slotLabel}] ${asset.name}` : `[${slotLabel}] (空スロット)`}
                >
                  {/* キー番号バッジ */}
                  <span className="text-[9px] sm:text-[10px] font-mono font-bold text-slate-400 group-hover:text-amber-300">
                    {slotLabel}
                  </span>

                  {/* アイテムアイコン */}
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center p-1 overflow-hidden">
                    {asset ? (
                      <img
                        src={resolveAssetUrl(asset.sprite.url)}
                        alt={asset.name}
                        className="max-w-full max-h-full pixelated object-contain group-hover:scale-110 transition-transform"
                      />
                    ) : (
                      <span className="text-slate-600 text-xs">+</span>
                    )}
                  </div>

                  {/* アイテム名 */}
                  <span className="text-[9px] max-w-[50px] truncate text-slate-300 group-hover:text-white">
                    {asset ? asset.name : '未設定'}
                  </span>
                </div>
              );
            })}
          </div>
        </footer>
      </div>
    </div>
  );
};
