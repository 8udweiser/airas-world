import React, { useState, useEffect } from 'react';
import { GeminiImageProvider } from '../../ai/providers/GeminiImageProvider';
import { X, Key, ExternalLink, Check, Sparkles } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [apiKey, setApiKey] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setApiKey(GeminiImageProvider.getApiKey());
      setIsSaved(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    GeminiImageProvider.setApiKey(apiKey);
    setIsSaved(true);
    onSaved?.();
    setTimeout(() => {
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md glass-panel rounded-3xl overflow-hidden border border-cyan-500/40 shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300">
              <Key className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-white">Gemini API 設定</h2>
              <p className="text-[11px] text-slate-400">画像生成（Imagen 3）との連携</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <label className="text-slate-300 font-semibold block">
            Google Gemini API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full px-4 py-2.5 bg-black/50 border border-white/20 focus:border-cyan-400 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/30 transition-all font-mono"
          />

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>※キーはお使いのブラウザ内（localStorage）にのみ安全に保存されます。</span>
          </div>

          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 underline text-xs"
          >
            <span>Google AI Studio で無料の API キーを取得する</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-200 text-[11px] leading-relaxed flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong>APIキー設定時の効果:</strong>
              <p className="text-slate-300 mt-0.5">
                AIパネルから任意の自然言語で最新の Imagen 3 を直接呼び出し、高精細なドット絵をリアルタイム生成して背景を自動透過した上で世界へ配置できます。（※キー未設定時は内蔵のプロシージャル生成器が動作します）
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
          >
            {isSaved ? <Check className="w-4 h-4" /> : null}
            <span>{isSaved ? '保存完了！' : 'キーを保存'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
