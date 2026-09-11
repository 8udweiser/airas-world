import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, X } from 'lucide-react';
import { multiplayerManager, RemotePlayerInfo } from '../../core/multiplayer/MultiplayerManager';

import { PixiWorldRenderer } from '../../renderer/pixi/PixiWorldRenderer';

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  isSelf: boolean;
  time: string;
}

interface ChatSystemProps {
  onSendMessage?: (text: string) => void;
  remotePlayers: RemotePlayerInfo[];
  playerScreenPos?: { x: number; y: number } | null;
  renderer?: PixiWorldRenderer | null;
}

export const ChatSystem: React.FC<ChatSystemProps> = ({
  onSendMessage,
  remotePlayers,
  playerScreenPos,
  renderer,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [myBubble, setMyBubble] = useState<{ text: string; time: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    multiplayerManager.onChatReceived = (senderName, text) => {
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      setMessages((prev) => [
        ...prev.slice(-40),
        {
          id: `${Date.now()}_${Math.random()}`,
          sender: senderName,
          text,
          isSelf: false,
          time: timeStr,
        },
      ]);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // 自分のフキダシ消去タイマー
  useEffect(() => {
    if (myBubble) {
      const timer = setTimeout(() => {
        setMyBubble(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [myBubble]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;

    multiplayerManager.sendChat(text);
    onSendMessage?.(text);

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    setMessages((prev) => [
      ...prev.slice(-40),
      {
        id: `${Date.now()}_${Math.random()}`,
        sender: multiplayerManager.myName,
        text,
        isSelf: true,
        time: timeStr,
      },
    ]);

    setMyBubble({ text, time: Date.now() });
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* 自分の頭上フキダシ */}
      {myBubble && playerScreenPos && (
        <div
          className="fixed pointer-events-none z-30 -translate-x-1/2 -translate-y-full transition-all duration-150 animate-in fade-in zoom-in-95"
          style={{
            left: playerScreenPos.x,
            top: playerScreenPos.y - 45,
          }}
        >
          <div className="glass-panel px-3.5 py-1.5 rounded-2xl border border-cyan-400/60 shadow-xl text-cyan-100 text-xs font-medium max-w-[200px] text-center break-words">
            {myBubble.text}
          </div>
          <div className="w-2 h-2 bg-slate-900 border-r border-b border-cyan-400/60 rotate-45 mx-auto -mt-1" />
        </div>
      )}

      {/* 👥 リモートプレイヤー（スマホやPCの参加者）の頭上ネームタグ ＆ チャットフキダシ */}
      {renderer &&
        remotePlayers.map((p) => {
          const sPos = renderer.worldToScreen(p.x, p.y - p.z);
          return (
            <div
              key={p.id}
              className="fixed pointer-events-none z-30 -translate-x-1/2 -translate-y-full transition-all duration-75 flex flex-col items-center gap-1"
              style={{
                left: sPos.x,
                top: sPos.y - 42,
              }}
            >
              {/* チャットフキダシ */}
              {p.chatBubble && Date.now() - p.chatBubble.time < 5000 && (
                <div className="glass-panel px-3.5 py-1.5 rounded-2xl border border-amber-400/80 shadow-2xl text-amber-100 text-xs font-bold max-w-[200px] text-center break-words animate-in fade-in zoom-in-95 backdrop-blur-md">
                  {p.chatBubble.text}
                  <div className="w-2 h-2 bg-slate-900 border-r border-b border-amber-400/80 rotate-45 mx-auto -mt-1" />
                </div>
              )}

              {/* 🏷️ ネームタグ & リアルタイムステータスバッジ */}
              <div className="px-2.5 py-0.5 rounded-full bg-slate-950/85 border border-cyan-400/50 text-[10px] font-extrabold text-white shadow-xl flex items-center gap-1.5 backdrop-blur-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="tracking-tight">{p.name}</span>
                {p.z > 2 && (
                  <span className="px-1 py-0.2 rounded bg-cyan-500 text-[9px] text-slate-950 font-black animate-bounce">
                    JUMP
                  </span>
                )}
                {p.isSprinting && (
                  <span className="px-1 py-0.2 rounded bg-amber-500 text-[9px] text-slate-950 font-black animate-pulse">
                    DASH
                  </span>
                )}
              </div>
            </div>
          );
        })}

      {/* チャットトグルボタン (左下HUD上) */}
      <div className="fixed bottom-14 left-4 z-30">
        {!isOpen ? (
          <button
            onClick={() => setIsOpen(true)}
            className="glass-panel px-3 py-2 rounded-2xl flex items-center gap-2 border border-white/15 text-xs text-slate-200 hover:text-white hover:border-cyan-400/60 shadow-xl transition-all cursor-pointer group"
            title="チャットを開く (Enter)"
          >
            <MessageSquare className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
            <span className="font-medium">チャット</span>
            {messages.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            )}
          </button>
        ) : (
          <div className="w-80 sm:w-96 glass-panel rounded-2xl border border-cyan-400/40 p-3 shadow-2xl flex flex-col gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white tracking-wide">
                  ワールドチャット
                </span>
                <span className="text-[10px] text-slate-400">
                  ({multiplayerManager.myName})
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* チャット履歴 */}
            <div className="h-40 overflow-y-auto space-y-2 pr-1 text-xs">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-[11px]">
                  メッセージはありません。話しかけてみよう！
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${
                      m.isSelf ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">
                      <span className="font-semibold text-cyan-300">
                        {m.sender}
                      </span>
                      <span>{m.time}</span>
                    </div>
                    <div
                      className={`px-3 py-1.5 rounded-2xl max-w-[85%] break-words ${
                        m.isSelf
                          ? 'bg-cyan-600/50 border border-cyan-400/50 text-white rounded-tr-none'
                          : 'bg-slate-800/80 border border-white/10 text-slate-200 rounded-tl-none'
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* 入力欄 */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="メッセージを入力... (Enterで送信)"
                className="flex-1 bg-black/40 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/70 transition-all"
                maxLength={100}
              />
              <button
                onClick={handleSend}
                className="px-3 py-1.5 rounded-xl bg-cyan-500/30 hover:bg-cyan-500/50 border border-cyan-400/60 text-cyan-200 hover:text-white transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-1"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
