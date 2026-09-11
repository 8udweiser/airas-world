import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, X, Trash2, Smartphone } from 'lucide-react';
import { multiplayerManager, RemotePlayerInfo } from '../../core/multiplayer/MultiplayerManager';
import { ChatStorage, SavedChatMessage } from '../../core/storage/ChatStorage';

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
        // 👤 キャラクタースプライトの真上中心に配置
        containerRef.current.style.transform = `translate3d(${Math.round(sPos.x)}px, ${Math.round(sPos.y - 70)}px, 0) translate(-50%, -100%)`;
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
      className="fixed top-0 left-0 pointer-events-none z-30 flex flex-col items-center gap-1 will-change-transform"
      style={{
        transform: `translate3d(${Math.round(initialPos.x)}px, ${Math.round(initialPos.y - 70)}px, 0) translate(-50%, -100%)`,
      }}
    >
      {/* 📱 リモートプレイヤー入力中スマホアイコン */}
      {player.isTyping && (
        <div className="px-2 py-0.5 rounded-full bg-slate-950/90 border border-amber-400/80 text-amber-300 text-[10px] font-bold shadow-lg flex items-center gap-1 animate-bounce mb-0.5 backdrop-blur-md">
          <Smartphone className="w-3 h-3 text-amber-300 animate-pulse" />
          <span>入力中...</span>
        </div>
      )}

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
 * 👤 60fps/120fps RAF 滑らか追従 自分の頭上フキダシ & スマホ入力中アイコン
 */
const FloatingSelfHUD: React.FC<{
  renderer: PixiWorldRenderer | null;
  myBubble: { text: string; time: number } | null;
  isTyping?: boolean;
  onBubbleFinished: () => void;
}> = ({ renderer, myBubble, isTyping = false, onBubbleFinished }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animId: number;
    const updatePos = () => {
      if (containerRef.current && renderer) {
        const px = renderer.playerState.x;
        const py = renderer.playerState.y;
        const pz = renderer.playerState.z;
        const sPos = renderer.worldToScreen(px, py - pz);
        // 💬 自分のキャラ頭上中心に配置
        containerRef.current.style.transform = `translate3d(${Math.round(sPos.x)}px, ${Math.round(sPos.y - 72)}px, 0) translate(-50%, -100%)`;
      }
      animId = requestAnimationFrame(updatePos);
    };
    animId = requestAnimationFrame(updatePos);
    return () => cancelAnimationFrame(animId);
  }, [renderer]);

  if (!myBubble && !isTyping) return null;

  const initialPos = renderer
    ? renderer.worldToScreen(renderer.playerState.x, renderer.playerState.y - renderer.playerState.z)
    : { x: 0, y: 0 };

  return (
    <div
      ref={containerRef}
      className="fixed top-0 left-0 pointer-events-none z-30 flex flex-col items-center gap-1 will-change-transform"
      style={{
        transform: `translate3d(${Math.round(initialPos.x)}px, ${Math.round(initialPos.y - 72)}px, 0) translate(-50%, -100%)`,
      }}
    >
      {/* 📱 自分の入力中スマホアイコン */}
      {isTyping && (
        <div className="px-2.5 py-0.5 rounded-full bg-slate-950/90 border border-cyan-400/80 text-cyan-300 text-[10px] font-bold shadow-lg flex items-center gap-1 animate-bounce mb-0.5 backdrop-blur-md">
          <Smartphone className="w-3 h-3 text-cyan-300 animate-pulse" />
          <span>入力中...</span>
        </div>
      )}

      {/* 💬 自分の発言吹き出し */}
      {myBubble && (
        <SpeechBubble
          key={`self_${myBubble.time}`}
          text={myBubble.text}
          timestamp={myBubble.time}
          isSelf={true}
          onFinished={onBubbleFinished}
        />
      )}
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
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [keepOpenAfterSend, setKeepOpenAfterSend] = useState(() => {
    try {
      return localStorage.getItem('airas_chat_keep_open') === 'true';
    } catch {
      return false;
    }
  });
  const [messages, setMessages] = useState<SavedChatMessage[]>([]);
  const [myBubble, setMyBubble] = useState<{ text: string; time: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 📱 入力中判定 (開いていてフォーカス中、または文字入力中)
  const isSelfTyping = isOpen && (isInputFocused || inputText.trim().length > 0);

  useEffect(() => {
    multiplayerManager.setTypingStatus(isSelfTyping);
    return () => {
      multiplayerManager.setTypingStatus(false);
    };
  }, [isSelfTyping]);

  // 起動時にIndexedDBから過去ログをロード
  useEffect(() => {
    ChatStorage.loadChatHistory().then((history) => {
      if (history.length > 0) {
        setMessages(history);
      }
    });
  }, []);

  useEffect(() => {
    multiplayerManager.onChatReceived = (senderName, text) => {
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const newMsg: SavedChatMessage = {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        sender: senderName,
        text,
        isSelf: false,
        time: timeStr,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev.slice(-100), newMsg]);
      ChatStorage.saveMessage(newMsg);
    };
  }, []);

  // チャットを開いた瞬間、上からの流れるスクロールを完全に排除し、即座に1番下の最新ログを表示！
  useEffect(() => {
    if (isOpen) {
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
      setTimeout(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
        textareaRef.current?.focus();
      }, 40);
    }
  }, [isOpen]);

  // メッセージ追加時のみスムーズスクロール
  useEffect(() => {
    if (isOpen && chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages.length]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;

    multiplayerManager.sendChat(text);
    onSendMessage?.(text);

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const newMsg: SavedChatMessage = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sender: multiplayerManager.myName,
      text,
      isSelf: true,
      time: timeStr,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev.slice(-100), newMsg]);
    ChatStorage.saveMessage(newMsg);

    setMyBubble({ text, time: Date.now() });
    setInputText('');

    // 送信後の自動クローズ制御
    if (!keepOpenAfterSend) {
      setIsOpen(false);
      setIsInputFocused(false);
      multiplayerManager.setTypingStatus(false);
    } else {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 40);
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm('チャット履歴を消去しますか？')) {
      await ChatStorage.clearChatHistory();
      setMessages([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl + Enter または Cmd + Enter で送信
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
    // 通常のEnterキーは自然に改行される
  };

  return (
    <>
      {/* 自分の頭上フキダシ & スマホ入力中アイコン (60fps RAF 滑らか追従) */}
      <FloatingSelfHUD
        renderer={renderer || null}
        myBubble={myBubble}
        isTyping={isSelfTyping}
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
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  端末保存
                </span>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={handleClearHistory}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleClearHistory();
                    }}
                    className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-all cursor-pointer"
                    title="チャット履歴を消去"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsOpen(false);
                  }}
                  className="p-1.5 rounded-xl hover:bg-white/15 text-slate-400 hover:text-white transition-all cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
                  title="閉じる"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* チャット履歴 */}
            <div ref={chatScrollRef} className="h-36 sm:h-40 overflow-y-auto allow-scroll space-y-2 pr-1 text-xs">
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
                      className={`px-3 py-1.5 rounded-2xl max-w-[85%] break-words whitespace-pre-wrap ${
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

            {/* 入力欄 (Enterで改行、Ctrl+Enterまたは送信ボタンで送信) */}
            <div className="flex items-end gap-2 pt-1">
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                onKeyDown={handleKeyDown}
                placeholder="メッセージを入力... (Ctrl+Enter で送信)"
                rows={1}
                className="flex-1 bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-all resize-none min-h-[38px] max-h-[80px]"
                maxLength={200}
              />
              <button
                onClick={handleSend}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSend();
                }}
                className="px-3.5 py-2 rounded-xl bg-cyan-500/40 hover:bg-cyan-500/60 active:bg-cyan-400 border border-cyan-400/60 text-cyan-100 hover:text-white transition-all shadow-sm active:scale-95 cursor-pointer flex items-center justify-center min-h-[38px]"
                title="送信 (Ctrl+Enter)"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 送信後もチャット欄を開いたままにする設定 */}
            <div className="flex items-center justify-between px-1 text-[10px] text-slate-400">
              <label className="flex items-center gap-1.5 cursor-pointer select-none hover:text-slate-200 transition-colors">
                <input
                  type="checkbox"
                  checked={keepOpenAfterSend}
                  onChange={(e) => {
                    setKeepOpenAfterSend(e.target.checked);
                    try {
                      localStorage.setItem('airas_chat_keep_open', String(e.target.checked));
                    } catch (_) {}
                  }}
                  className="rounded border-white/20 bg-slate-900 text-cyan-500 focus:ring-0 w-3 h-3 accent-cyan-500 cursor-pointer"
                />
                <span>送信後もチャット欄を開いたままにする</span>
              </label>
              <span className="text-[9px] text-slate-500 hidden sm:inline">Ctrl+Enterで即送信</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
