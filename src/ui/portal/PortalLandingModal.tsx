import React, { useState, useRef } from 'react';
import { X, Smartphone, Monitor, Globe, Home, Bed, MessageSquare, Copy, Check, QrCode, Sparkles, Download, Upload, RotateCcw, Share2, Save, HardDrive } from 'lucide-react';
import { useWorldStore } from '../../store/useWorldStore';
import { WorldStorage } from '../../core/storage/WorldStorage';

interface PortalLandingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWeather?: (weather: string) => void;
}

export const PortalLandingModal: React.FC<PortalLandingModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [lineCopied, setLineCopied] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { world, importWorldData, resetWorldToDefault } = useWorldStore();

  if (!isOpen) return null;

  const isProduction = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
  const currentBaseUrl = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : 'https://8udweiser.github.io/airas-world/';
  const port = typeof window !== 'undefined' ? window.location.port || '5173' : '5173';
  const mobileAccessUrl = isProduction ? currentBaseUrl : `http://192.168.0.16:${port}/`;
  const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(mobileAccessUrl)}&bgcolor=0f172a&color=38bdf8`;

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(mobileAccessUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleLineShare = () => {
    const shareText = `Airas（アイラス）の私のワールドに遊びに来てね！\n${mobileAccessUrl}`;
    const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(shareText)}`;
    window.open(lineUrl, '_blank');
  };

  const handleSaveNow = async () => {
    const ok = await WorldStorage.saveImmediate(world);
    if (ok) {
      setSaveStatus('ブラウザ内(IndexedDB)に保存しました！');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  const handleExport = () => {
    WorldStorage.exportToJson(world);
    setSaveStatus('ワールドデータをJSONとしてダウンロードしました！');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsed = WorldStorage.parseFromJson(content);
      if (parsed) {
        importWorldData(parsed);
        setSaveStatus('ワールドデータを正常に読み込みました！');
        setTimeout(() => setSaveStatus(null), 3000);
      } else {
        alert('無効なワールドJSONファイルです。');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetWorld = async () => {
    if (window.confirm('現在のオブジェクト配置や川を初期状態にリセットしますか？\n（元に戻せなくなります）')) {
      await resetWorldToDefault();
      setSaveStatus('初期ワールドにリセットしました。');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto glass-panel rounded-3xl border border-cyan-400/40 p-6 md:p-8 shadow-2xl space-y-6 text-slate-100">
        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* ヘッダー */}
        <div className="space-y-2 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Airas World Portal & Roadmap</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-cyan-300 via-sky-200 to-amber-200 bg-clip-text text-transparent">
            あいらす・ワールド 公開ポータル
          </h2>
          <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
            低スペックPCから最新スマホまで、誰でもブラウザひとつで即座に繋がる昭和レトロ×AIメタバース。
          </p>
        </div>

        {/* 📱 スマホで今すぐ一緒に遊ぶ（マルチプレイヤー共有） */}
        <div className="p-4 md:p-5 rounded-2xl bg-gradient-to-r from-cyan-950/60 to-blue-950/60 border border-cyan-500/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm text-cyan-200">
              <Smartphone className="w-4 h-4 text-cyan-400" />
              <span>スマホでアクセスして二人で同期プレイ！</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-bold">
              オンライン同期稼働中
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            スマホのブラウザで開くだけで、画面上に二人目のキャラクターが現れてリアルタイム同期します！
            <span className="block mt-1 text-[11px] text-amber-300/90 font-medium">
              ※ スマホとPCが同じWi-Fiに接続されている必要があります（「localhost」はスマホ自身を指してしまうため繋がりません）。
            </span>
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 bg-black/40 p-4 rounded-2xl border border-white/10">
            {/* 📷 QRコード */}
            <div className="flex flex-col items-center gap-1.5 p-2 bg-slate-900 rounded-xl border border-cyan-400/40 shadow-inner">
              <img
                src={qrCodeApiUrl}
                alt="スマホ接続用QRコード"
                className="w-28 h-28 rounded-lg"
                loading="lazy"
              />
              <span className="text-[10px] text-cyan-300 font-semibold flex items-center gap-1">
                <QrCode className="w-3 h-3" /> カメラで読み取り
              </span>
            </div>

            {/* 🔗 手動入力 / コピー */}
            <div className="flex-1 w-full space-y-2">
              <div className="text-[11px] text-slate-400 font-medium">
                または以下のURLをスマホのブラウザに入力：
              </div>
              <div className="flex items-center gap-2 bg-black/60 p-2.5 rounded-xl border border-cyan-500/30 text-xs font-mono text-cyan-300 select-all">
                <span className="flex-1 truncate font-bold">{mobileAccessUrl}</span>
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500/30 hover:bg-cyan-500/50 border border-cyan-400/50 text-white font-sans font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'コピー完了！' : 'URLコピー'}</span>
                </button>
              </div>
              <div className="text-[10px] text-slate-400">
                LAN内IP: <span className="font-mono text-slate-300">192.168.0.16</span> | ポート: <span className="font-mono text-slate-300">5173</span>
              </div>

              {/* 🟢 LINEで友達を招待ボタン */}
              <div className="pt-1">
                <button
                  onClick={handleLineShare}
                  className="w-full py-2 px-3 rounded-xl bg-[#06C755]/30 hover:bg-[#06C755]/50 border border-[#06C755]/60 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer shadow-lg"
                >
                  <Share2 className="w-4 h-4 text-[#06C755]" />
                  <span>LINEの友達・トークに招待URLを送る</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 💾 オブジェクト・家の保存 ＆ 友達の家読み込み (IndexedDB / JSON) */}
        <div className="p-4 md:p-5 rounded-2xl bg-gradient-to-r from-slate-900/90 to-cyan-950/50 border border-cyan-500/30 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm text-cyan-200">
              <HardDrive className="w-4 h-4 text-cyan-400" />
              <span>マイホーム（オブジェクト・川）の保存 ＆ 共有</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-[10px] font-mono font-bold">
              オブジェクト: {Object.keys(world.entities).length}件
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            配置した家具・車・掘った川などは、<span className="text-cyan-300 font-bold">ブラウザ内（IndexedDB）に自動保存</span>され、リロードしてもそのまま残ります。
            JSONファイルとして保存すれば、友達に渡してあなたの家に遊びに来てもらうこともできます。
          </p>

          {/* セーブ操作ボタングリッド */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {/* 今すぐ保存 */}
            <button
              onClick={handleSaveNow}
              className="px-3 py-2.5 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-400/40 text-xs font-bold text-cyan-100 flex flex-col items-center gap-1 transition-all active:scale-95 cursor-pointer shadow"
            >
              <Save className="w-4 h-4 text-cyan-300" />
              <span>今すぐ手動保存</span>
            </button>

            {/* JSONエクスポート */}
            <button
              onClick={handleExport}
              className="px-3 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-white/20 text-xs font-bold text-slate-200 flex flex-col items-center gap-1 transition-all active:scale-95 cursor-pointer shadow"
            >
              <Download className="w-4 h-4 text-amber-300" />
              <span>JSONファイル保存</span>
            </button>

            {/* JSONインポート */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-white/20 text-xs font-bold text-slate-200 flex flex-col items-center gap-1 transition-all active:scale-95 cursor-pointer shadow"
            >
              <Upload className="w-4 h-4 text-emerald-300" />
              <span>友達の家を読込</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportFile}
            />

            {/* 初期化リセット */}
            <button
              onClick={handleResetWorld}
              className="px-3 py-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/30 text-xs font-bold text-rose-200 flex flex-col items-center gap-1 transition-all active:scale-95 cursor-pointer shadow"
            >
              <RotateCcw className="w-4 h-4 text-rose-400" />
              <span>初期ワールドに戻す</span>
            </button>
          </div>

          {/* 通知トースト */}
          {saveStatus && (
            <div className="p-2 rounded-xl bg-cyan-950/90 border border-cyan-400/60 text-cyan-200 text-xs text-center font-bold animate-in fade-in zoom-in duration-200">
              {saveStatus}
            </div>
          )}
        </div>

        {/* 🌟 将来の全プラットフォーム展開 */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-amber-400" />
            <span>全プラットフォーム展開構想</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-900/70 border border-white/10 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-xs text-cyan-300">
                <Globe className="w-4 h-4" />
                <span>Webブラウザ版</span>
              </div>
              <p className="text-[11px] text-slate-400">
                インストール不要。URLを開くだけで低スペックPCでも60FPS爆速動作。
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/70 border border-white/10 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-xs text-emerald-300">
                <Smartphone className="w-4 h-4" />
                <span>iOS / Android PWA</span>
              </div>
              <p className="text-[11px] text-slate-400">
                ホーム画面に追加してアプリ化。タッチ専用ジョイスティックで快適移動。
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/70 border border-white/10 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-xs text-purple-300">
                <Monitor className="w-4 h-4" />
                <span>PC・Steam展開</span>
              </div>
              <p className="text-[11px] text-slate-400">
                高解像度テクスチャ、コントローラー完全対応、MODサポート。
              </p>
            </div>
          </div>
        </div>

        {/* 🏡 マイホーム建築 ＆ ベッド同衾 ＆ チャットシステム */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Home className="w-4 h-4 text-emerald-400" />
            <span>マイホーム建築・訪問・ベッドで一緒に寝る</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-900/70 border border-white/10 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-white">
                <Bed className="w-4 h-4 text-amber-400" />
                <span>ふかふかダブルベッド</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                ベッドに右クリック/タップで横たわることができ、オンラインの友達と並んで一緒に休めます。安らぎの就寝サウンドと夜明けの演出付き。
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/70 border border-white/10 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-white">
                <MessageSquare className="w-4 h-4 text-cyan-400" />
                <span>頭上フキダシチャット</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                発言するとキャラクターの頭上にリアルタイムでフキダシが出現。マルチプレイヤー相手にも瞬時に届き、会話が弾みます。
              </p>
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
          <div>Airas World Engine v0.3.0</div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold shadow-lg shadow-cyan-500/30 transition-all cursor-pointer"
          >
            ワールドに戻る
          </button>
        </div>
      </div>
    </div>
  );
};
