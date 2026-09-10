import React from 'react';
import { X, Keyboard, Mouse, Sparkles } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg glass-panel rounded-3xl overflow-hidden border border-white/15 shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-white">Airas 操作ガイド</h2>
              <p className="text-[11px] text-slate-400">マインクラフトPC版準拠のキーボード＆マウス操作</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs text-slate-300 max-h-[60vh] overflow-y-auto pr-1">
          {/* Minecraft準拠キーボード操作 */}
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <div className="flex items-center gap-2 text-cyan-300 font-bold">
              <Keyboard className="w-4 h-4" />
              <span>基本移動 & アクション（マイクラ準拠）</span>
            </div>
            <div className="grid grid-cols-2 gap-2 font-mono">
              <div className="bg-black/40 p-2 rounded-lg border border-white/5 flex justify-between">
                <span className="text-amber-300">W / A / S / D</span>
                <span className="text-slate-300 font-sans">歩行移動</span>
              </div>
              <div className="bg-black/40 p-2 rounded-lg border border-white/5 flex justify-between">
                <span className="text-cyan-300">Space</span>
                <span className="text-slate-300 font-sans">ジャンプ！</span>
              </div>
              <div className="bg-black/40 p-2 rounded-lg border border-white/5 flex justify-between">
                <span className="text-emerald-300">Ctrl</span>
                <span className="text-slate-300 font-sans">ダッシュ（高速）</span>
              </div>
              <div className="bg-black/40 p-2 rounded-lg border border-white/5 flex justify-between">
                <span className="text-purple-300">Shift</span>
                <span className="text-slate-300 font-sans">スニーク（しゃがみ）</span>
              </div>
              <div className="bg-black/40 p-2 rounded-lg border border-white/5 flex justify-between">
                <span className="text-amber-300">E</span>
                <span className="text-slate-300 font-sans">パレット開閉</span>
              </div>
              <div className="bg-black/40 p-2 rounded-lg border border-white/5 flex justify-between">
                <span className="text-sky-300">1 〜 9</span>
                <span className="text-slate-300 font-sans">スロット選択</span>
              </div>
              <div className="bg-black/40 p-2 rounded-lg border border-white/5 flex justify-between">
                <span className="text-amber-300">F3</span>
                <span className="text-slate-300 font-sans">デバッグ画面</span>
              </div>
              <div className="bg-black/40 p-2 rounded-lg border border-white/5 flex justify-between">
                <span className="text-slate-300">Esc / Q</span>
                <span className="text-slate-300 font-sans">選択解除</span>
              </div>
            </div>
          </div>

          {/* マウス操作 */}
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <div className="flex items-center gap-2 text-amber-300 font-bold">
              <Mouse className="w-4 h-4" />
              <span>マウス操作</span>
            </div>
            <ul className="space-y-1.5 list-disc list-inside text-slate-300 leading-relaxed">
              <li><strong className="text-white">右クリック</strong>: オブジェクトの<span className="text-amber-300 font-bold">使用・インタラクション</span>（自販機でジュース購入、ベンチに座る、喫茶店に入る、猫を撫でる、NPC会話等）</li>
              <li><strong className="text-white">左クリック</strong>: オブジェクトの選択 / アセットの配置</li>
              <li><strong className="text-white">ドラッグ</strong>: オブジェクトの位置移動</li>
              <li><strong className="text-white">右ドラッグ / 中ドラッグ</strong>: カメラの移動（パン）</li>
              <li><strong className="text-white">マウスホイール</strong>: 画面の拡大 / 縮小（ズーム）</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
