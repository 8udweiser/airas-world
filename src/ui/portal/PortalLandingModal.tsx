import React, { useState } from 'react';
import { X, Smartphone, Monitor, Globe, Home, Bed, MessageSquare, Copy, Check, QrCode, Sparkles } from 'lucide-react';

interface PortalLandingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWeather?: (weather: string) => void;
}

export const PortalLandingModal: React.FC<PortalLandingModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'http://localhost:5173/';

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
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
            同じWi-Fi内、またはオンラインで以下のURLをスマホのブラウザで開くだけで、画面上にもう一人のキャラが現れ、リアルタイムに一緒に歩き回れます！
          </p>
          <div className="flex items-center gap-2 bg-black/50 p-2 rounded-xl border border-white/10 text-xs font-mono text-cyan-300">
            <span className="flex-1 truncate">{currentUrl}</span>
            <button
              onClick={handleCopyLink}
              className="px-3 py-1.5 rounded-lg bg-cyan-500/30 hover:bg-cyan-500/50 border border-cyan-400/50 text-white font-sans font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'コピー完了！' : 'URLコピー'}</span>
            </button>
          </div>
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
