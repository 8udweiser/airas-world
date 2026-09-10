import React, { useState } from 'react';
import { useWorldStore } from '../../store/useWorldStore';
import { useUIStore } from '../../store/useUIStore';
import { MockAIProvider } from '../../ai/providers/MockAIProvider';
import { GeminiImageProvider } from '../../ai/providers/GeminiImageProvider';
import { AssetConverter } from '../../ai/pipeline/AssetConverter';
import { ProposedPlan } from '../../ai/IAIProvider';
import { Sparkles, Check, X, Bot, ArrowRight, Lightbulb, CornerDownLeft, ImagePlus, Key } from 'lucide-react';

interface AIPanelModalProps {
  onSetGhostPreview: (ghosts: Array<{ assetId: string; x: number; y: number; name: string }>) => void;
  onOpenSettings: () => void;
}

const aiProvider = new MockAIProvider();

export const AIPanelModal: React.FC<AIPanelModalProps> = ({ onSetGhostPreview, onOpenSettings }) => {
  const { world, assets, executeCommand, registerAsset, createObject } = useWorldStore();
  const { isAIPanelOpen, setAIPanelOpen, selectedEntityId, showNotification } = useUIStore();
  
  const [activeTab, setActiveTab] = useState<'world' | 'image'>('world');
  const [prompt, setPrompt] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<ProposedPlan | null>(null);

  // 画像生成ステート
  const [imagePrompt, setImagePrompt] = useState('');
  const [assetName, setAssetName] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedAsset, setGeneratedAsset] = useState<any | null>(null);

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

  const quickImagePrompts = [
    { label: '緑の公衆電話ボックス', prompt: '昭和レトロな緑の公衆電話ボックス', name: 'レトロ公衆電話' },
    { label: '丸型赤い郵便ポスト', prompt: '昭和の丸型円筒形赤い郵便ポスト', name: '丸型赤ポスト' },
    { label: '駄菓子屋の10円ゲーム機', prompt: '昭和駄菓子屋のレトロゲーム機', name: '駄菓子屋ゲーム機' },
    { label: 'ラーメン屋の赤提灯', prompt: '昭和屋台の赤い提灯と暖簾', name: '赤提灯' },
  ];

  // AI世界プラン生成
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
        cursorPosition: { x: world.player.position.x + 40, y: world.player.position.y },
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

  // Gemini 画像生成 & アセット変換
  const handleGenerateImage = async (presetPrompt?: string, presetName?: string) => {
    const p = presetPrompt || imagePrompt;
    const n = presetName || assetName || 'AIオブジェクト';
    if (!p.trim() || isGeneratingImage) return;

    setIsGeneratingImage(true);
    setGeneratedAsset(null);

    try {
      // 1. 画像生成API (Gemini / Imagen 3)
      const rawImageUrl = await GeminiImageProvider.generatePixelArtImage(p);

      // 2. 自動透過 & AirasAsset 変換パイプライン
      const newAsset = await AssetConverter.convertToAirasAsset(rawImageUrl, n, p);
      setGeneratedAsset(newAsset);
      showNotification(`「${n}」のドット絵生成と背景透過が完了しました！`);
    } catch (err: any) {
      console.error(err);
      showNotification(`画像生成エラー: ${err.message || '生成に失敗しました'}`);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // 生成アセットを世界に登録＆配置
  const handleApplyGeneratedAsset = () => {
    if (!generatedAsset) return;

    registerAsset(generatedAsset);
    const newId = createObject(
      generatedAsset.id,
      world.player.position.x + 30,
      world.player.position.y + 10
    );

    showNotification(`「${generatedAsset.name}」をパレットに登録し、プレイヤーの足元に配置しました！`);
    handleClose();
  };

  // 世界プランの適用
  const handleApply = () => {
    if (!currentPlan) return;

    for (const cmd of currentPlan.commands) {
      executeCommand(cmd);
    }

    showNotification(`「${currentPlan.title}」を世界に適用しました`);
    handleClose();
  };

  const handleClose = () => {
    onSetGhostPreview([]);
    setCurrentPlan(null);
    setGeneratedAsset(null);
    setPrompt('');
    setImagePrompt('');
    setAIPanelOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl glass-panel rounded-3xl overflow-hidden border border-cyan-500/40 shadow-2xl flex flex-col max-h-[88vh]">
        {/* ヘッダー & タブ */}
        <div className="px-6 py-3 bg-gradient-to-r from-cyan-950/70 via-slate-900/80 to-slate-900 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                Airas World AI
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-900/60 text-cyan-300 font-mono">
                  Gemini連携
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenSettings}
              className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs flex items-center gap-1 transition-all"
              title="APIキー設定"
            >
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">API設定</span>
            </button>
            <button
              onClick={handleClose}
              className="p-1 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* タブセレクタ */}
        <div className="flex border-b border-white/10 bg-black/30 px-6 pt-2 gap-2">
          <button
            onClick={() => setActiveTab('world')}
            className={`pb-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'world'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>世界生成・編集</span>
          </button>
          <button
            onClick={() => setActiveTab('image')}
            className={`pb-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'image'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ImagePlus className="w-3.5 h-3.5" />
            <span>Gemini画像生成 ➜ ドット絵アセット</span>
          </button>
        </div>

        {/* コンテンツエリア */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'world' ? (
            <>
              {/* 世界編集入力 */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  自然言語で世界を変更・配置
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleGenerate();
                    }}
                    placeholder="例: 昭和レトロな駅前商店街を作って / ベンチを追加して / 雨を降らせて"
                    className="w-full pl-4 pr-12 py-3 bg-black/40 border border-white/15 focus:border-cyan-400 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition-all font-sans"
                  />
                  <button
                    onClick={() => handleGenerate()}
                    disabled={!prompt.trim() || isThinking}
                    className="absolute right-2 p-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 disabled:opacity-30 transition-all cursor-pointer"
                  >
                    {isThinking ? <Sparkles className="w-4 h-4 animate-spin" /> : <CornerDownLeft className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {!currentPlan && (
                <div className="space-y-2">
                  <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                    クイック提案
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

              {isThinking && (
                <div className="py-8 flex flex-col items-center justify-center gap-3 text-slate-300">
                  <div className="w-10 h-10 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                  <p className="text-xs text-cyan-300 font-mono animate-pulse">
                    AI World Brain が世界構造を計画中...
                  </p>
                </div>
              )}

              {currentPlan && !isThinking && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-cyan-300 uppercase">AI 提案プラン</span>
                      <span className="text-[10px] text-cyan-400 bg-cyan-900/60 px-2 py-0.5 rounded-full border border-cyan-400/30">
                        ゴーストプレビュー表示中
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-white">{currentPlan.title}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed bg-black/20 p-2.5 rounded-xl border border-white/5">
                      💭 <strong>AIの思考:</strong> {currentPlan.thought}
                    </p>

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
            </>
          ) : (
            /* Gemini画像生成タブ */
            <div className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    アセット名
                  </label>
                  <input
                    type="text"
                    value={assetName}
                    onChange={(e) => setAssetName(e.target.value)}
                    placeholder="例: レトロ公衆電話ボックス"
                    className="w-full px-4 py-2.5 bg-black/40 border border-white/15 focus:border-amber-400 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    画像生成プロンプト (Gemini / Imagen 3)
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={imagePrompt}
                      onChange={(e) => setImagePrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleGenerateImage();
                      }}
                      placeholder="例: 昭和レトロな緑の公衆電話ボックス、ガラス窓とコイン投入口"
                      className="w-full pl-4 pr-12 py-3 bg-black/40 border border-white/15 focus:border-amber-400 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-all"
                    />
                    <button
                      onClick={() => handleGenerateImage()}
                      disabled={!imagePrompt.trim() || isGeneratingImage}
                      className="absolute right-2 p-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:opacity-30 transition-all cursor-pointer"
                    >
                      {isGeneratingImage ? (
                        <Sparkles className="w-4 h-4 animate-spin" />
                      ) : (
                        <ImagePlus className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* クイック画像生成プリセット */}
              {!generatedAsset && (
                <div className="space-y-2">
                  <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                    人気のアセット作成リクエスト
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {quickImagePrompts.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setImagePrompt(q.prompt);
                          setAssetName(q.name);
                          handleGenerateImage(q.prompt, q.name);
                        }}
                        className="text-xs px-3 py-1.5 rounded-xl glass-button text-slate-300 hover:text-white border-white/10 hover:border-amber-400/40 transition-all"
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isGeneratingImage && (
                <div className="py-8 flex flex-col items-center justify-center gap-3 text-slate-300">
                  <div className="w-10 h-10 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                  <p className="text-xs text-amber-300 font-mono animate-pulse">
                    Gemini Imagen 3 がドット絵を生成し、背景透過とAiras Asset規格へ自動変換中...
                  </p>
                </div>
              )}

              {/* 生成完了アセットのプレビュー */}
              {generatedAsset && !isGeneratingImage && (
                <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 space-y-3 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 uppercase">生成アセットプレビュー</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      背景自動透過済み
                    </span>
                  </div>

                  <div className="flex items-center gap-4 bg-black/40 p-3 rounded-xl border border-white/10">
                    <div className="w-16 h-16 rounded-xl bg-[#1e293b] border border-white/10 flex items-center justify-center p-1 overflow-hidden">
                      <img
                        src={generatedAsset.sprite.url}
                        alt={generatedAsset.name}
                        className="max-w-full max-h-full pixelated object-contain"
                      />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white">{generatedAsset.name}</h4>
                      <p className="text-xs text-slate-400">
                        サイズ: {generatedAsset.sprite.width}x{generatedAsset.sprite.height}px | アンカー: (
                        {generatedAsset.anchor.x}, {generatedAsset.anchor.y})
                      </p>
                      <p className="text-[11px] text-emerald-300">
                        足元当たり判定・深度Yソート自動設定済み
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleApplyGeneratedAsset}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>パレットに登録して世界に配置する</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* フッターアクション */}
        <div className="px-6 py-3 bg-slate-900/90 border-t border-white/10 flex items-center justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition-all"
          >
            閉じる
          </button>
          {activeTab === 'world' && currentPlan && (
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
