import React from 'react';
import { X, Keyboard, Mouse, Smartphone, Sparkles } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg glass-panel rounded-3xl overflow-hidden border border-white/15 shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300">
              <Sparkles className="w-5 h-5" />
            </span>
            <h2 className="text-base font-bold text-white">Airas（あいらす）操作ガイド</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs text-slate-300">
          {/* PC操作 */}
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <div className="flex items-center gap-2 text-cyan-300 font-bold">
              <Mouse className="w-4 h-4" />
              <span>PCでの操作</span>
            </div>
            <ul className="space-y-1.5 list-disc list-inside text-slate-300 leading-relaxed">
              <li><strong className="text-white">左クリック</strong>: オブジェクトの選択 / アセットの配置</li>
              <li><strong className="text-white">ドラッグ</strong>: オブジェクトの位置移動</li>
              <li><strong className="text-white">右ドラッグ / Altドラッグ</strong>: カメラの移動（パン）</li>
              <li><strong className="text-white">マウスホイール</strong>: 拡大 / 縮小（ズーム）</li>
              <li><strong className="text-white">WASD / 矢印キー</strong>: 探索モード時のキャラクター歩行</li>
            </ul>
          </div>

          {/* ショートカット */}
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <div className="flex items-center gap-2 text-amber-300 font-bold">
              <Keyboard className="w-4 h-4" />
              <span>キーボードショートカット</span>
            </div>
            <div className="grid grid-cols-2 gap-2 font-mono">
              <div className="bg-black/30 p-2 rounded-lg border border-white/5 flex justify-between">
                <span>Ctrl + Z</span>
                <span className="text-slate-400 font-sans">元に戻す</span>
              </div>
              <div className="bg-black/30 p-2 rounded-lg border border-white/5 flex justify-between">
                <span>Ctrl + Y</span>
                <span className="text-slate-400 font-sans">やり直す</span>
              </div>
              <div className="bg-black/30 p-2 rounded-lg border border-white/5 flex justify-between">
                <span>Ctrl / ⌘ + K</span>
                <span className="text-slate-400 font-sans">AIパネルを開く</span>
              </div>
              <div className="bg-black/30 p-2 rounded-lg border border-white/5 flex justify-between">
                <span>Esc</span>
                <span className="text-slate-400 font-sans">選択解除</span>
              </div>
            </div>
          </div>

          {/* スマホ操作 */}
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <div className="flex items-center gap-2 text-emerald-300 font-bold">
              <Smartphone className="w-4 h-4" />
              <span>スマートフォン・タブレットでの操作</span>
            </div>
            <ul className="space-y-1 list-disc list-inside text-slate-300 leading-relaxed">
              <li><strong className="text-white">タップ</strong>: オブジェクト選択 / 配置</li>
              <li><strong className="text-white">ドラッグ</strong>: オブジェクト移動 / カメラ移動</li>
              <li><strong className="text-white">ピンチイン・アウト</strong>: 画面のズーム</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all cursor-pointer"
          >
            理解した
          </button>
        </div>
      </div>
    </div>
  );
};
