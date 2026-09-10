import React from 'react';
import { useUIStore } from '../../store/useUIStore';
import { MessageSquare, X } from 'lucide-react';

export const DialogueModal: React.FC = () => {
  const { activeDialogue, setDialogue } = useUIStore();

  if (!activeDialogue) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[90vw] max-w-lg glass-panel rounded-2xl border border-cyan-400/40 p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
        <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs">
          <MessageSquare className="w-3.5 h-3.5" />
          <span>{activeDialogue.title}</span>
        </div>
        <button
          onClick={() => setDialogue(null)}
          className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-2 py-1 font-dot text-sm text-slate-100 leading-relaxed">
        {activeDialogue.lines.map((line, idx) => (
          <p key={idx}>{line}</p>
        ))}
      </div>

      <div className="pt-2 flex justify-end">
        <button
          onClick={() => setDialogue(null)}
          className="px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all cursor-pointer"
        >
          OK
        </button>
      </div>
    </div>
  );
};
