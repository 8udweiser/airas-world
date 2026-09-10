import React, { useState, useRef } from 'react';
import { useWorldStore } from '../../store/useWorldStore';
import { useUIStore } from '../../store/useUIStore';
import { MockAIProvider } from '../../ai/providers/MockAIProvider';
import { GeminiImageProvider } from '../../ai/providers/GeminiImageProvider';
import { AssetConverter } from '../../ai/pipeline/AssetConverter';
import { ProposedPlan } from '../../ai/IAIProvider';
import { Sparkles, Check, X, Bot, ArrowRight, Lightbulb, CornerDownLeft, ImagePlus, Key, Upload, Copy, BookOpen, User, Car, Box, CheckCheck } from 'lucide-react';

interface AIPanelModalProps {
  onSetGhostPreview: (ghosts: Array<{ assetId: string; x: number; y: number; name: string }>) => void;
  onOpenSettings: () => void;
}

const aiProvider = new MockAIProvider();

export const AIPanelModal: React.FC<AIPanelModalProps> = ({ onSetGhostPreview, onOpenSettings }) => {
  const { world, assets, executeCommand, registerAsset, createObject } = useWorldStore();
  const { isAIPanelOpen, setAIPanelOpen, selectedEntityId, showNotification } = useUIStore();
  
  const [activeTab, setActiveTab] = useState<'world' | 'image' | 'guide'>('image');
  const [prompt, setPrompt] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<ProposedPlan | null>(null);

  // 画像生成ステート
  const [imagePrompt, setImagePrompt] = useState('');
  const [assetName, setAssetName] = useState('');
  const [assetType, setAssetType] = useState<'character' | 'vehicle' | 'object'>('character');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedAsset, setGeneratedAsset] = useState<any | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // 📚 公式プロンプトお手本集
  const promptTemplates = [
    {
      id: 'schoolgirl_3dir',
      type: 'character' as const,
      title: '可愛い女子高生（3方向＋自動反転）',
      subtitle: '紺色ブレザー制服、黒髪ボブ、学生鞄、NPC/アバター用',
      name: '可愛い女子高生',
      prompt: '16bitレトロゲーム風のドット絵スプライトシート。可愛い日本の女子高生キャラクター。横一列に並んだ3つの視点のゲーム素材：1. 正面向き（フロントビュー、前を向いて笑顔、紺色ブレザー制服とリボン、チェックスカート） 2. 背面向き（リアビュー、後ろ姿、黒髪ボブヘア、学生鞄を肩に掛けている） 3. 右側面向き（右を向いたサイドビュー、横顔、立ち姿）。等間隔に配置、各キャラは完全に同じサイズ（2.5等身、高さ48px比率）、ドットの輪郭がシャープ、HD-2Dピクセルアート。背景は純粋な白一色（#FFFFFFの単色ベタ塗り）、影なし、切り抜き用。ネガティブ：同じ向きの重複、左向き、斜め向き、3Dパース、グラデーション背景',
    },
    {
      id: 'supercar_3dir',
      type: 'vehicle' as const,
      title: '黄色いスーパーカー（3方向＋自動反転）',
      subtitle: 'ランボルギーニ風、低重心エアロボディ、乗車爆走用',
      name: '黄色いスーパーカー',
      prompt: '16bitレトロゲーム風のドット絵スプライトシート。黄色いスーパーカー（ランボルギーニ風）。横一列に並んだ3つの視点のゲーム素材：1. 正面向き（フロントビュー、シャープなLEDヘッドライト、低いノーズ） 2. 背面向き（リアビュー、横一文字のテールランプ、デュアルマフラー） 3. 右側面向き（右を向いたサイドビュー、ウェッジシェイプのエアロボディ）。等間隔に配置、各アングルは完全に同じスケール、ドットの輪郭がシャープ、HD-2Dピクセルアート。背景は純粋な白一色（#FFFFFFの単色ベタ塗り）、影なし、切り抜き用。ネガティブ：重複、同じ向きの繰り返し、3Dリアル写真、グラデーション背景',
    },
    {
      id: 'phone_booth',
      type: 'object' as const,
      title: '昭和レトロな緑の公衆電話ボックス',
      subtitle: '四角いガラス窓、緑の電話機、コイン投入口',
      name: 'レトロ公衆電話',
      prompt: '16bitレトロゲーム風のドット絵。昭和レトロな緑色の四角い公衆電話ボックス。正面から見たゲーム用スプライト素材。中に緑の電話機が見える。ドットの輪郭がシャープ、HD-2Dピクセルアート、サイズ約48x64px比率。背景は純粋な白一色（#FFFFFFの単色ベタ塗り）、影なし、切り抜き用。',
    },
    {
      id: 'red_post',
      type: 'object' as const,
      title: '昭和の丸型赤ポスト',
      subtitle: '円筒形、〒マーク、ノスタルジックな街路資材',
      name: '丸型赤ポスト',
      prompt: '16bitレトロゲーム風のドット絵。昭和の丸型円筒形の赤い郵便ポスト。「〒」マーク、正面向き、ノスタルジックな質感。ドットの輪郭がシャープ、HD-2Dピクセルアート、サイズ約32x48px比率。背景は純粋な白一色（#FFFFFFの単色ベタ塗り）、影なし、切り抜き用。',
    },
    {
      id: 'diagonal_8dir',
      type: 'character' as const,
      title: '【将来用】斜め対応・多方向スプライト (8方向向け)',
      subtitle: '2x3グリッド配置、斜め前・斜め後を含む先進素材',
      name: '多方向女子高生',
      prompt: '16bitレトロゲーム風のドット絵スプライトシート。可愛い女子高生（制服姿）。2行3列のグリッド配置された多方向ゲーム素材：[上段] 左:正面向き(南)、中央:背面向き(北)、右:右側面向き(東)。[下段] 左:斜め右前向き(南東)、中央:斜め右後向き(北東)、右:予備。ドットの輪郭がシャープ、等身・スケール統一、HD-2Dスタイル。背景は純粋な白一色（#FFFFFFの単色ベタ塗り）、影なし、切り抜き用。',
    },
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

  // Gemini 画像生成 & アセット自動スライス変換
  const handleGenerateImage = async (presetPrompt?: string, presetName?: string, presetType?: 'character' | 'vehicle' | 'object') => {
    const p = presetPrompt || imagePrompt;
    const n = presetName || assetName || (presetType === 'character' ? 'AI女子高生' : presetType === 'vehicle' ? 'AIスーパーカー' : 'AIオブジェクト');
    const t = presetType || assetType;
    if (!p.trim() || isGeneratingImage) return;

    setIsGeneratingImage(true);
    setGeneratedAsset(null);

    try {
      // 1. 画像生成API (Gemini / Imagen 3)
      const rawImageUrl = await GeminiImageProvider.generatePixelArtImage(p);

      // 2. 自動透過 & スプライトスライス変換パイプライン
      let newAsset;
      if (t === 'character' || t === 'vehicle') {
        newAsset = await AssetConverter.convertToSpriteSheetAsset(rawImageUrl, {
          name: n,
          type: t,
          promptUsed: p,
          layout: 'horizontal_3',
        });
      } else {
        newAsset = await AssetConverter.convertToAirasAsset(rawImageUrl, n, p);
      }

      setGeneratedAsset(newAsset);
      showNotification(`「${n}」の生成と4方向スライス・背景透過が完了しました！`);
    } catch (err: any) {
      console.error(err);
      showNotification(`画像生成エラー: ${err.message || '生成に失敗しました'}`);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // ローカル画像ファイルを取り込んで自動スライス＆アセット化
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsGeneratingImage(true);
    setGeneratedAsset(null);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) {
        setIsGeneratingImage(false);
        return;
      }

      try {
        const name = assetName || file.name.replace(/\.[^/.]+$/, '');
        let newAsset;
        if (assetType === 'character' || assetType === 'vehicle') {
          newAsset = await AssetConverter.convertToSpriteSheetAsset(dataUrl, {
            name,
            type: assetType,
            promptUsed: 'ローカル画像インポート',
            layout: 'horizontal_3',
          });
        } else {
          newAsset = await AssetConverter.convertToAirasAsset(dataUrl, name, 'ローカル画像インポート');
        }

        setGeneratedAsset(newAsset);
        showNotification(`画像「${name}」の取り込み・4方向スライス・背景透過が完了しました！`);
      } catch (err: any) {
        console.error(err);
        showNotification(`画像処理エラー: ${err.message || '取り込みに失敗しました'}`);
      } finally {
        setIsGeneratingImage(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // テンプレートを適用して即画像生成タブへ
  const handleApplyTemplate = (tmpl: typeof promptTemplates[0], autoGenerate: boolean = false) => {
    setImagePrompt(tmpl.prompt);
    setAssetName(tmpl.name);
    setAssetType(tmpl.type);
    setActiveTab('image');
    if (autoGenerate) {
      handleGenerateImage(tmpl.prompt, tmpl.name, tmpl.type);
    }
  };

  // クリップボードにコピー
  const handleCopyPrompt = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    showNotification('プロンプトをクリップボードにコピーしました！');
    setTimeout(() => setCopiedIndex(null), 2000);
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
            onClick={() => setActiveTab('image')}
            className={`pb-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'image'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ImagePlus className="w-3.5 h-3.5" />
            <span>AI画像創出 & スプライトスライス</span>
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`pb-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'guide'
                ? 'border-purple-400 text-purple-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>プロンプトお手本集</span>
          </button>
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
        </div>

        {/* コンテンツエリア */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'image' && (
            /* 🎨 AI画像創出 & スライス取り込みタブ */
            <div className="space-y-4">
              {/* アセット種別セレクタ */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                  創出・インポートするアセットの種類
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAssetType('character')}
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 ${
                      assetType === 'character'
                        ? 'bg-amber-500/20 border-amber-400 text-white shadow-sm'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <User className={`w-4 h-4 ${assetType === 'character' ? 'text-amber-400' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-bold">キャラクター</div>
                      <div className="text-[10px] text-slate-400">3面 ➜ 4方向自動展開</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssetType('vehicle')}
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 ${
                      assetType === 'vehicle'
                        ? 'bg-amber-500/20 border-amber-400 text-white shadow-sm'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Car className={`w-4 h-4 ${assetType === 'vehicle' ? 'text-amber-400' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-bold">乗り物</div>
                      <div className="text-[10px] text-slate-400">乗車＆爆走システム</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssetType('object')}
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 ${
                      assetType === 'object'
                        ? 'bg-amber-500/20 border-amber-400 text-white shadow-sm'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Box className={`w-4 h-4 ${assetType === 'object' ? 'text-amber-400' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-bold">オブジェクト</div>
                      <div className="text-[10px] text-slate-400">家具・ポスト・自販機</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    アセット名
                  </label>
                  <input
                    type="text"
                    value={assetName}
                    onChange={(e) => setAssetName(e.target.value)}
                    placeholder={
                      assetType === 'character'
                        ? '例: 可愛い女子高生'
                        : assetType === 'vehicle'
                        ? '例: 黄色いスーパーカー'
                        : '例: レトロ公衆電話'
                    }
                    className="w-full px-4 py-2.5 bg-black/40 border border-white/15 focus:border-amber-400 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none transition-all font-sans"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-300">
                      画像生成プロンプト (Gemini / Imagen 3)
                    </label>
                    <button
                      type="button"
                      onClick={() => setActiveTab('guide')}
                      className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1"
                    >
                      <BookOpen className="w-3 h-3" />
                      <span>お手本プロンプトを見る</span>
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={imagePrompt}
                      onChange={(e) => setImagePrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleGenerateImage();
                      }}
                      placeholder="例: 16bitレトロゲーム風のドット絵スプライトシート。可愛い女子高生..."
                      className="w-full pl-4 pr-12 py-3 bg-black/40 border border-white/15 focus:border-amber-400 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-all font-sans"
                    />
                    <button
                      onClick={() => handleGenerateImage()}
                      disabled={!imagePrompt.trim() || isGeneratingImage}
                      className="absolute right-2 p-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:opacity-30 transition-all cursor-pointer"
                      title="Geminiで生成"
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

              {/* 手元の画像インポート (ファイルアップロード) */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">手持ちの画像を取り込む</div>
                    <div className="text-[10px] text-slate-400">外部で生成したJPG/PNGを自動スライス＆透過</div>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/40 text-purple-200 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>画像を選択</span>
                </button>
              </div>

              {isGeneratingImage && (
                <div className="py-8 flex flex-col items-center justify-center gap-3 text-slate-300">
                  <div className="w-10 h-10 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                  <p className="text-xs text-amber-300 font-mono animate-pulse">
                    スプライトを解析中... 背景自動透過 ➜ 3面スライス ➜ 水平反転生成を実行中
                  </p>
                </div>
              )}

              {/* 生成・取り込み完了アセットのプレビュー */}
              {generatedAsset && !isGeneratingImage && (
                <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 uppercase flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      アセットプレビュー
                    </span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      背景自動透過＆4方向セットアップ済み
                    </span>
                  </div>

                  {/* 4方向スプライト表示 */}
                  {generatedAsset.sprite.directionalUrls ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-4 gap-2 bg-black/40 p-3 rounded-xl border border-white/10">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[10px] text-slate-400 font-mono">正面 (down)</span>
                          <div className="w-16 h-16 rounded-lg bg-[#1e293b] border border-white/10 flex items-center justify-center p-1">
                            <img
                              src={generatedAsset.sprite.directionalUrls.down}
                              alt="正面"
                              className="max-w-full max-h-full pixelated object-contain"
                            />
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[10px] text-slate-400 font-mono">背面 (up)</span>
                          <div className="w-16 h-16 rounded-lg bg-[#1e293b] border border-white/10 flex items-center justify-center p-1">
                            <img
                              src={generatedAsset.sprite.directionalUrls.up}
                              alt="背面"
                              className="max-w-full max-h-full pixelated object-contain"
                            />
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[10px] text-slate-400 font-mono">右側面 (right)</span>
                          <div className="w-16 h-16 rounded-lg bg-[#1e293b] border border-white/10 flex items-center justify-center p-1">
                            <img
                              src={generatedAsset.sprite.directionalUrls.right}
                              alt="右側面"
                              className="max-w-full max-h-full pixelated object-contain"
                            />
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[10px] text-cyan-300 font-mono">左側面 (自動反転)</span>
                          <div className="w-16 h-16 rounded-lg bg-[#1e293b] border border-cyan-400/30 flex items-center justify-center p-1">
                            <img
                              src={generatedAsset.sprite.directionalUrls.left}
                              alt="左側面"
                              className="max-w-full max-h-full pixelated object-contain"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="text-[10px] text-cyan-300 text-center">
                        ✨ 右側面から左側面を水平反転生成したため、完全な左右対称性が保証されています！
                      </div>
                    </div>
                  ) : (
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
                          サイズ: {generatedAsset.sprite.width}x{generatedAsset.sprite.height}px
                        </p>
                      </div>
                    </div>
                  )}

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

          {activeTab === 'guide' && (
            /* 📚 公式プロンプトお手本集タブ */
            <div className="space-y-3.5">
              <div className="p-3 rounded-2xl bg-purple-950/30 border border-purple-500/30 text-xs text-purple-200 leading-relaxed">
                💡 <strong>Airas プロンプト黄金ルール</strong>: 「正面・背面・右側面」の3面だけを指定することでAIの重複エラーを完全に防ぎ、左側面はエンジンが自動反転補完します！
              </div>

              <div className="space-y-3">
                {promptTemplates.map((tmpl, idx) => (
                  <div
                    key={tmpl.id}
                    className="p-3.5 rounded-2xl bg-black/40 border border-white/10 hover:border-purple-400/40 transition-all space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          {tmpl.type === 'character' ? (
                            <User className="w-3.5 h-3.5 text-pink-400" />
                          ) : tmpl.type === 'vehicle' ? (
                            <Car className="w-3.5 h-3.5 text-amber-400" />
                          ) : (
                            <Box className="w-3.5 h-3.5 text-cyan-400" />
                          )}
                          <span>{tmpl.title}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">{tmpl.subtitle}</div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleCopyPrompt(tmpl.prompt, idx)}
                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-[11px] flex items-center gap-1 transition-all"
                          title="プロンプトをコピー"
                        >
                          {copiedIndex === idx ? (
                            <CheckCheck className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3 text-slate-400" />
                          )}
                          <span>{copiedIndex === idx ? 'コピー完了' : 'コピー'}</span>
                        </button>
                        <button
                          onClick={() => handleApplyTemplate(tmpl, false)}
                          className="px-2.5 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/40 text-purple-200 text-[11px] font-bold flex items-center gap-1 transition-all"
                        >
                          <span>創出タブへ転記</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-black/50 border border-white/5 text-[11px] text-slate-300 font-mono leading-relaxed line-clamp-3">
                      {tmpl.prompt}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'world' && (
            /* 🌍 世界生成・編集タブ */
            <div className="space-y-4">
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
                <div className="space-y-4">
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
