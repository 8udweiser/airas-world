import React from 'react';
import { useWorldStore } from '../../store/useWorldStore';
import { useUIStore } from '../../store/useUIStore';
import { Sparkles, Trash2, Copy, Move, MessageCircle, ShoppingBag, Armchair, Eye, X, RotateCw, RotateCcw } from 'lucide-react';
import { CreateObjectCommand } from '../../core/commands/WorldCommands';
import { WorldEntity, Direction } from '../../core/types/world';
import { ROTATION_DIRECTIONS, DIRECTION_LABELS } from '../../renderer/pixi/PixiWorldRenderer';
import { resolveAssetUrl } from '../../core/utils/url';

export const ObjectContextMenu: React.FC = () => {
  const { world, assets, deleteObject, executeCommand, rotateObject } = useWorldStore();
  const { selectedEntityId, setSelectedEntityId, setAIPanelOpen, setDialogue, showNotification } = useUIStore();

  if (!selectedEntityId) return null;

  const entity = world.entities[selectedEntityId];
  if (!entity) return null;

  const asset = assets[entity.assetId];
  if (!asset) return null;

  // 複製 (コピー)
  const handleCopy = () => {
    const newId = `${asset.id}_${Date.now()}`;
    const newEntity: WorldEntity = {
      ...entity,
      id: newId,
      name: `${entity.name} (複製)`,
      position: {
        x: entity.position.x + 30,
        y: entity.position.y + 10,
        z: entity.position.z,
      },
    };
    executeCommand(new CreateObjectCommand(newEntity));
    setSelectedEntityId(newId);
    showNotification(`「${entity.name}」を複製しました`);
  };

  // 削除
  const handleDelete = () => {
    deleteObject(selectedEntityId);
    setSelectedEntityId(null);
    showNotification(`「${entity.name}」を削除しました`);
  };

  // AIで変更
  const handleAIEdit = () => {
    setAIPanelOpen(true);
  };

  // インタラクション実行
  const handleInteraction = (interaction: any) => {
    if (interaction.dialogue && interaction.dialogue.length > 0) {
      setDialogue({
        title: `${entity.name} - ${interaction.label}`,
        lines: interaction.dialogue,
      });
    } else {
      showNotification(`${interaction.label} を実行しました`);
    }
  };

  const getInteractionIcon = (type: string) => {
    switch (type) {
      case 'talk':
        return <MessageCircle className="w-4 h-4 text-emerald-400" />;
      case 'buy':
      case 'open_shop':
        return <ShoppingBag className="w-4 h-4 text-amber-400" />;
      case 'sit':
        return <Armchair className="w-4 h-4 text-sky-400" />;
      default:
        return <Eye className="w-4 h-4 text-indigo-400" />;
    }
  };

  const currentDir: Direction = entity.direction || 'down';

  // 向き回転 (全8方向)
  const handleRotate = (delta: 1 | -1) => {
    const idx = ROTATION_DIRECTIONS.indexOf(currentDir);
    const validIdx = idx >= 0 ? idx : 0;
    const nextIdx = (validIdx + delta + ROTATION_DIRECTIONS.length) % ROTATION_DIRECTIONS.length;
    const nextDir = ROTATION_DIRECTIONS[nextIdx];

    rotateObject(selectedEntityId, nextDir);

    const renderer = (window as any).__renderer;
    if (renderer) {
      if (typeof renderer.setEntityDirection === 'function') {
        renderer.setEntityDirection(selectedEntityId, nextDir);
      } else {
        renderer.rotateEntity(selectedEntityId, delta === 1 ? 'cw' : 'ccw');
      }
    }

    const label = DIRECTION_LABELS[nextDir] || nextDir;
    showNotification(`🔄 向きを変更: ${label}`);
  };

  const currentThumbnailUrl = resolveAssetUrl(
    asset.sprite.directionalUrls?.[currentDir] || asset.sprite.url
  );

  return (
    <div className="absolute right-4 top-20 z-40 w-72 glass-panel rounded-2xl overflow-hidden border border-white/15 shadow-2xl animate-in fade-in slide-in-from-right-4 duration-200">
      {/* ヘッダー */}
      <div className="px-4 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-800 border border-white/15 flex items-center justify-center overflow-hidden p-1">
            <img
              src={currentThumbnailUrl}
              alt={asset.name}
              className="max-w-full max-h-full pixelated object-contain"
            />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">{entity.name}</h3>
            <p className="text-[10px] text-slate-400">
              位置: ({Math.round(entity.position.x)}, {Math.round(entity.position.y)})
            </p>
          </div>
        </div>

        <button
          onClick={() => setSelectedEntityId(null)}
          className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* インタラクションボタン (あれば) */}
      {asset.interactions && asset.interactions.length > 0 && (
        <div className="p-2 border-b border-white/10 bg-cyan-950/20">
          {asset.interactions.map((act, i) => (
            <button
              key={i}
              onClick={() => handleInteraction(act)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/30 hover:text-white text-xs font-medium transition-all shadow-sm"
            >
              {getInteractionIcon(act.type)}
              <span>{act.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* アクション一覧 */}
      <div className="p-2 space-y-1.5">
        {/* 向き回転 (全8方向) */}
        <div className="p-2 bg-white/5 rounded-xl space-y-1.5 border border-white/5">
          <div className="flex items-center justify-between text-[11px] text-slate-300">
            <span className="flex items-center gap-1.5">
              <RotateCw className="w-3.5 h-3.5 text-amber-400" />
              向き: <strong className="text-amber-200">{DIRECTION_LABELS[currentDir] || currentDir}</strong>
            </span>
            <span className="text-[9px] text-slate-400">8方向対応</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => handleRotate(-1)}
              className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white text-xs font-medium transition-all active:scale-95"
              title="反時計回りに回転 (ドラッグ中画面左側タップ / Qキー)"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>⟲ 左回転</span>
            </button>
            <button
              onClick={() => handleRotate(1)}
              className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white text-xs font-medium transition-all active:scale-95"
              title="時計回りに回転 (ドラッグ中画面右側タップ / E / Rキー)"
            >
              <RotateCw className="w-3.5 h-3.5 text-amber-400" />
              <span>⟳ 右回転</span>
            </button>
          </div>
        </div>

        {/* 移動 */}
        <div className="flex items-center justify-between px-3 py-1.5 rounded-xl text-[11px] text-slate-400 bg-white/5">
          <span className="flex items-center gap-1.5">
            <Move className="w-3.5 h-3.5 text-cyan-400" />
            ドラッグして位置移動
          </span>
          <span className="text-[9px] text-slate-500">左右タップで回転</span>
        </div>

        {/* 複製 */}
        <button
          onClick={handleCopy}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white text-xs font-medium transition-all"
        >
          <Copy className="w-4 h-4 text-sky-400" />
          <span>オブジェクトをコピー</span>
        </button>

        {/* AIで変更 */}
        <button
          onClick={handleAIEdit}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 hover:from-cyan-500/25 hover:to-blue-500/25 border border-cyan-500/20 text-cyan-300 hover:text-white text-xs font-medium transition-all"
        >
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>AIで変更 / プロンプト指示</span>
        </button>

        {/* 削除 */}
        <button
          onClick={handleDelete}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-red-500/20 border border-transparent hover:border-red-500/40 text-slate-400 hover:text-red-300 text-xs font-medium transition-all"
        >
          <Trash2 className="w-4 h-4 text-red-400" />
          <span>削除</span>
        </button>
      </div>
    </div>
  );
};
