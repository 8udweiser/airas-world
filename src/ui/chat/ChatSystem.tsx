import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, X } from 'lucide-react';
import { multiplayerManager, RemotePlayerInfo } from '../../core/multiplayer/MultiplayerManager';

import { PixiWorldRenderer } from '../../renderer/pixi/PixiWorldRenderer';
import { SpeechBubble } from './SpeechBubble';

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

/**
 * 🏃 60fps/120fps RAF 滑らか追従 リモートプレイヤーHUD
 * カメラ移動中も1ミリのズレもなく完璧にスプライトに吸い付いてカクつきを完全排除！
 */
const FloatingRemoteHUD: React.FC<{
  player: RemotePlayerInfo;
  renderer: PixiWorldRenderer | null;
}> = ({ player, renderer }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef(player);
  playerRef.current = player;

  useEffect(() => {
    let animId: number;
    const updatePos = () => {
      if (containerRef.current && renderer) {
        const p = playerRef.current;
        const sPos = renderer.worldToScreen(p.x, p.y - p.z);
        containerRef.current.style.transform = `translate3d(${Math.round(sPos.x)}px, ${Math.round(sPos.y - 40)}px, 0)`;
      }
      animId = requestAnimationFrame(updatePos);
    };
    animId = requestAnimationFrame(updatePos);
    return () => cancelAnimationFrame(animId);
  }, [renderer]);

  const initialPos = renderer
    ? renderer.worldToScreen(player.x, player.y - player.z)
    : { x: 0, y: 0 };

  return (
    <div
      ref={containerRef}
      className="fixed top-0 left-0 pointer-events-none z-30 -translate-x-1/2 -translate-y-full flex flex-col items-center gap-1.5 will-change-transform"
      style={{
        transform: `translate3d(${Math.round(initialPos.x)}px, ${Math.round(initialPos.y - 40)}px, 0)`,
      }}
    >
      {/* 💬 チャットフキダシ (1文字ずつタイピング & 2行スクロール & 10秒待機フェード) */}
      {player.chatBubble && (
        <SpeechBubble
          key={`${player.id}_${player.chatBubble.time}`}
          text={player.chatBubble.text}
          timestamp={player.chatBubble.time}
          isSelf={false}
        />
      )}

      {/* 🏷️ ネームタグ & リアルタイムステータスバッジ */}
      <div className="px-2.5 py-0.5 rounded-full bg-slate-950/90 border border-cyan-400/50 text-[10px] font-extrabold text-white shadow-2xl flex items-center gap-1.5 backdrop-blur-md">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="tracking-tight">{player.name}</span>
        {player.z > 2 && (
          <span className="px-1 py-0.2 rounded bg-cyan-500 text-[9px] text-slate-950 font-black animate-bounce">
            JUMP
          </span>
        )}
        {player.isSprinting && (
          <span className="px-1 py-0.2 rounded bg-amber-500 text-[9px] text-slate-950 font-black animate-pulse">
            DASH
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * 👤 60fps/120fps RAF 滑らか追従 自分の頭上フキダシ
 */
const FloatingSelfHUD: React.FC<{
  renderer: PixiWorldRenderer | null;
  myBubble: { text: string; time: number } | null;
  onBubbleFinished: () => void;
}> = ({ renderer, myBubble, onBubbleFinished }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animId: number;
    const updatePos = () => {
      if (containerRef.current && renderer) {
        const px = renderer.playerState.x;
        const py = renderer.playerState.y;
        const pz = renderer.playerState.z;
        const sPos = renderer.worldToScreen(px, py - pz);
        containerRef.current.style.transform = `translate3d(${Math.round(sPos.x)}px, ${Math.round(sPos.y - 45)}px, 0)`;
      }
      animId = requestAnimationFrame(updatePos);
    };
    animId = requestAnimationFrame(updatePos);
    return () => cancelAnimationFrame(animId);
  }, [renderer]);

  if (!myBubble) return null;

  const initialPos = renderer
    ? renderer.worldToScreen(renderer.playerState.x, renderer.playerState.y - renderer.playerState.z)
    : { x: 0, y: 0 };

  return (
    <div
      ref={containerRef}
      className="fixed top-0 left-0 pointer-events-none z-30 -translate-x-1/2 -translate-y-full will-change-transform"
      style={{
        transform: `translate3d(${Math.round(initialPos.x)}px, ${Math.round(initialPos.y - 45)}px, 0)`,
      }}
    >
      <SpeechBubble
        key={`self_${myBubble.time}`}
        text={myBubble.text}
        timestamp={myBubble.time}
        isSelf={true}
        onFinished={onBubbleFinished}
      />
    </div>
  );
};

export const ChatSystem: React.FC<ChatSystemProps> = ({
  onSendMessage,
  remotePlayers,
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
      {/* 自分の頭上フキダシ (60fps RAF 滑らか追従 & タイピング & 2行スクロール & 10秒待機フェード) */}
      <FloatingSelfHUD
        renderer={renderer || null}
        myBubble={myBubble}
        onBubbleFinished={() => setMyBubble(null)}
      />

      {/* 👥 リモートプレイヤー（スマホやPCの参加者）の頭上ネームタグ ＆ チャットフキダシ (60fps RAF 滑らか追従) */}
      {renderer &&
        remotePlayers.map((p) => (
          <FloatingRemoteHUD key={p.id} player={p} renderer={renderer} />
        ))}

      {/* チャットトグルボタン & モーダル (z-50で最前面・タッチイベント伝播保護) */}
      <div
        className="fixed bottom-14 left-4 z-50 pointer-events-auto"
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        {!isOpen ? (
          <button
            onClick={() => setIsOpen(true)}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsOpen(true);
            }}
            className="glass-panel px-3.5 py-2.5 rounded-2xl flex items-center gap-2 border border-white/20 text-xs text-slate-200 hover:text-white hover:border-cyan-400 shadow-2xl active:scale-95 transition-all cursor-pointer group bg-slate-900/80 backdrop-blur-md"
            title="チャットを開く (Enter)"
          >
            <MessageSquare className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
            <span className="font-semibold tracking-wide">チャット</span>
            {messages.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            )}
          </button>
        ) : (
          <div className="w-[calc(100vw-2rem)] max-w-sm sm:w-96 glass-panel rounded-2xl border border-cyan-400/50 p-3 shadow-2xl flex flex-col gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-150 bg-slate-950/90 backdrop-blur-xl">
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
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsOpen(false);
                }}
                className="p-2 rounded-xl hover:bg-white/15 text-slate-400 hover:text-white transition-all cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
                title="閉じる"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* チャット履歴 */}
            <div className="h-36 sm:h-40 overflow-y-auto space-y-2 pr-1 text-xs">
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
                className="flex-1 bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-all"
                maxLength={100}
              />
              <button
                onClick={handleSend}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSend();
                }}
                className="px-3.5 py-2 rounded-xl bg-cyan-500/40 hover:bg-cyan-500/60 active:bg-cyan-400 border border-cyan-400/60 text-cyan-100 hover:text-white transition-all shadow-sm active:scale-95 cursor-pointer flex items-center justify-center min-h-[36px]"
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
