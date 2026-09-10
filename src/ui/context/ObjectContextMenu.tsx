import React from 'react';
import { useWorldStore } from '../../store/useWorldStore';
import { useUIStore } from '../../store/useUIStore';
import { Sparkles, Trash2, Copy, Move, MessageCircle, ShoppingBag, Armchair, Eye, X } from 'lucide-react';
import { CreateObjectCommand } from '../../core/commands/WorldCommands';
import { WorldEntity } from '../../core/types/world';

export const ObjectContextMenu: React.FC = () => {
  const { world, assets, deleteObject, executeCommand } = useWorldStore();
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

  return (
    <div className="absolute right-4 top-20 z-40 w-72 glass-panel rounded-2xl overflow-hidden border border-white/15 shadow-2xl animate-in fade-in slide-in-from-right-4 duration-200">
      {/* ヘッダー */}
      <div className="px-4 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-800 border border-white/15 flex items-center justify-center overflow-hidden p-1">
            <img
              src={asset.sprite.url}
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
      <div className="p-2 space-y-1">
        {/* 移動 */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-300">
          <Move className="w-4 h-4 text-cyan-400" />
          <span>ドラッグして位置を移動</span>
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
