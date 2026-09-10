import React, { useState } from 'react';
import { useWorldStore } from '../../store/useWorldStore';
import { useUIStore } from '../../store/useUIStore';
import { MockAIProvider } from '../../ai/providers/MockAIProvider';
import { ProposedPlan } from '../../ai/IAIProvider';
import { Sparkles, Send, Check, X, Bot, ArrowRight, Lightbulb, CornerDownLeft } from 'lucide-react';

interface AIPanelModalProps {
  onSetGhostPreview: (ghosts: Array<{ assetId: string; x: number; y: number; name: string }>) => void;
}

const aiProvider = new MockAIProvider();

export const AIPanelModal: React.FC<AIPanelModalProps> = ({ onSetGhostPreview }) => {
  const { world, assets, executeCommand } = useWorldStore();
  const { isAIPanelOpen, setAIPanelOpen, selectedEntityId, showNotification } = useUIStore();
  
  const [prompt, setPrompt] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<ProposedPlan | null>(null);

  if (!isAIPanelOpen) return null;

  const quickPrompts = [
    '昭和レトロな赤い自販機を置いて',
    '木製ベンチを追加して',
    '昭和レトロな駅前商店街を作って',
    '雨を降らせて',
    '哀愁漂う夕焼けにして',
    '電柱と街灯を置いて',
    '女子生徒NPCを追加して',
  ];

  // AIプラン生成
  const handleGenerate = async (queryText?: string) => {
    const text = queryText || prompt;
    if (!text.trim() || isThinking) return;

    setIsThinking(true);
    setCurrentPlan(null);
    onSetGhostPreview([]);

    try {
      const plan = await aiProvider.planWorldEdit(text, {
        world,
        availableAssets: assets,
        selectedEntityId,
        cursorPosition: { x: 260, y: 240 },
      });

      setCurrentPlan(plan);
      if (plan.previewGhostEntities) {
        onSetGhostPreview(plan.previewGhostEntities);
      }
    } catch (e) {
      console.error(e);
      showNotification('AIの生成中にエラーが発生しました');
    } finally {
      setIsThinking(false);
    }
  };

  // 適用
  const handleApply = () => {
    if (!currentPlan) return;

    for (const cmd of currentPlan.commands) {
      executeCommand(cmd);
    }

    showNotification(`「${currentPlan.title}」を世界に適用しました`);
    handleClose();
  };

  // モーダル閉じる & プレビュー解除
  const handleClose = () => {
    onSetGhostPreview([]);
    setCurrentPlan(null);
    setPrompt('');
    setAIPanelOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl glass-panel rounded-3xl overflow-hidden border border-cyan-500/30 shadow-2xl flex flex-col max-h-[85vh]">
        {/* ヘッダー */}
        <div className="px-6 py-4 bg-gradient-to-r from-cyan-950/60 to-slate-900/80 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                Airas World Brain
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-900/60 text-cyan-300 font-mono">
                  v0.1
                </span>
              </h2>
              <p className="text-xs text-slate-400">自然言語で世界を創り、変更・拡張します</p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* コンテンツエリア */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* プロンプト入力 */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              AIへの指示（どんな世界を作りたいですか？）
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleGenerate();
                }}
                placeholder="例: 昭和レトロな駅前商店街を作って / 自販機を追加して"
                className="w-full pl-4 pr-12 py-3 bg-black/40 border border-white/15 focus:border-cyan-400/80 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition-all font-sans"
              />
              <button
                onClick={() => handleGenerate()}
                disabled={!prompt.trim() || isThinking}
                className="absolute right-2 p-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 disabled:opacity-30 disabled:hover:bg-cyan-500 transition-all cursor-pointer disabled:cursor-not-allowed"
                title="送信"
              >
                {isThinking ? (
                  <Sparkles className="w-4 h-4 animate-spin" />
                ) : (
                  <CornerDownLeft className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* クイックプロンプト候補 */}
          {!currentPlan && (
            <div className="space-y-2">
              <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                おすすめのプロンプト
              </div>
              <div className="flex flex-wrap gap-1.5">
                {quickPrompts.map((qp, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setPrompt(qp);
                      handleGenerate(qp);
                    }}
                    className="text-xs px-3 py-1.5 rounded-xl glass-button text-slate-300 hover:text-white border-white/10 hover:border-cyan-400/40 transition-all"
                  >
                    {qp}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 思考中表示 */}
          {isThinking && (
            <div className="py-8 flex flex-col items-center justify-center gap-3 text-slate-300">
              <div className="w-10 h-10 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
              <p className="text-xs text-cyan-300 font-mono animate-pulse">
                AI World Planner が世界構造とアセットを計画中...
              </p>
            </div>
          )}

          {/* AI提案プランプレビュー */}
          {currentPlan && !isThinking && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-300 tracking-wide uppercase">
                    AI 提案プラン
                  </span>
                  <span className="text-[10px] text-cyan-400 bg-cyan-900/60 px-2 py-0.5 rounded-full border border-cyan-400/30">
                    プレビュー中 (画面上の半透明オブジェクト)
                  </span>
                </div>

                <h4 className="text-sm font-bold text-white">{currentPlan.title}</h4>
                <p className="text-xs text-slate-300 leading-relaxed font-sans bg-black/20 p-2.5 rounded-xl border border-white/5">
                  💭 <strong className="text-slate-200">AIの思考:</strong> {currentPlan.thought}
                </p>

                {/* 実行コマンド一覧 */}
                <div className="space-y-1.5">
                  <div className="text-[11px] text-slate-400">実行されるコマンド:</div>
                  <div className="space-y-1">
                    {currentPlan.commands.map((cmd, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-xs text-slate-300 font-mono bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5"
                      >
                        <ArrowRight className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                        <span>{cmd.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* フッターアクション */}
        <div className="px-6 py-4 bg-slate-900/90 border-t border-white/10 flex items-center justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition-all"
          >
            閉じる
          </button>
          {currentPlan && (
            <button
              onClick={handleApply}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>世界に適用する</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
