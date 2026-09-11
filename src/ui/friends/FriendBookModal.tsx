import React, { useState, useEffect } from 'react';
import { X, BookOpen, UserPlus, Home, Trash2, Copy, Check, Share2, Sparkles, ExternalLink, Users } from 'lucide-react';
import { FriendStorage, FriendProfile } from '../../core/storage/FriendStorage';
import { multiplayerManager } from '../../core/multiplayer/MultiplayerManager';

interface FriendBookModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FriendBookModal: React.FC<FriendBookModalProps> = ({ isOpen, onClose }) => {
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [copied, setCopied] = useState(false);
  const [newFriendInput, setNewFriendInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // 自分の招待リンクを生成
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  const myHouseId = `house_${multiplayerManager.myId}`;
  const myInviteUrl = `${currentOrigin}/?friend=${encodeURIComponent(multiplayerManager.myName)}&room=${multiplayerManager.roomId}&house=${myHouseId}`;

  useEffect(() => {
    if (isOpen) {
      loadFriends();
    }
  }, [isOpen]);

  const loadFriends = async () => {
    const list = await FriendStorage.getFriends();
    setFriends(list);
  };

  if (!isOpen) return null;

  const handleCopyMyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(myInviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleLineShare = () => {
    const shareText = `Airas（アイラス）の私の家に遊びに来てね！\n${myInviteUrl}`;
    const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(shareText)}`;
    window.open(lineUrl, '_blank');
  };

  const handleVisitFriend = (friend: FriendProfile) => {
    FriendStorage.updateLastVisited(friend.id);
    const targetUrl = `${currentOrigin}/?room=${friend.roomId}&house=${friend.houseId}&hostFriend=${encodeURIComponent(friend.name)}`;
    window.location.href = targetUrl;
  };

  const handleDeleteFriend = async (friendId: string, name: string) => {
    if (window.confirm(`「${name}」さんをフレンド帳から削除しますか？`)) {
      await FriendStorage.removeFriend(friendId);
      loadFriends();
      showToast(`「${name}」さんを削除しました`);
    }
  };

  const handleAddFriendManual = async () => {
    const text = newFriendInput.trim();
    if (!text) return;

    try {
      let friendName = '新しい友達';
      let roomId = 'airas_room_main';
      let houseId = `house_${Date.now()}`;

      if (text.includes('?')) {
        const url = new URL(text);
        friendName = url.searchParams.get('friend') || friendName;
        roomId = url.searchParams.get('room') || roomId;
        houseId = url.searchParams.get('house') || houseId;
      } else {
        friendName = text;
        roomId = `airas_room_${text.replace(/\s+/g, '_')}`;
      }

      const newFriend: FriendProfile = {
        id: `f_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: friendName,
        assetId: 'character_student',
        houseId,
        roomId,
        lastVisitedAt: Date.now(),
      };

      await FriendStorage.saveFriend(newFriend);
      setNewFriendInput('');
      setIsAdding(false);
      loadFriends();
      showToast(`「${friendName}」さんをフレンド登録しました！`);
    } catch (e) {
      alert('無効なURLまたは入力形式です。');
    }
  };

  const showToast = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto glass-panel rounded-3xl border border-cyan-400/40 p-6 md:p-7 shadow-2xl space-y-5 text-slate-100 bg-slate-950/95">
        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* ヘッダー */}
        <div className="space-y-1 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs font-semibold">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Airas Friend Book</span>
          </div>
          <h2 className="text-xl md:text-2xl font-extrabold bg-gradient-to-r from-cyan-300 via-sky-200 to-amber-200 bg-clip-text text-transparent">
            フレンド連絡帳
          </h2>
          <p className="text-xs text-slate-400">
            登録した友達の家にいつでもテレポート！LINEやリンクで友達を招待しよう。
          </p>
        </div>

        {/* 🔗 自分の招待リンク共有エリア */}
        <div className="p-4 rounded-2xl bg-cyan-950/50 border border-cyan-500/30 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>あなたの招待リンク（あなたの家へ直接ワープ）</span>
            </span>
            <span className="text-[10px] text-cyan-400/80 font-mono">
              名前: {multiplayerManager.myName}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2">
            <div className="flex-1 w-full bg-black/60 px-3 py-2 rounded-xl border border-white/10 text-[11px] font-mono text-cyan-300 truncate select-all">
              {myInviteUrl}
            </div>
            <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0">
              <button
                onClick={handleCopyMyLink}
                className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-cyan-500/30 hover:bg-cyan-500/50 border border-cyan-400/50 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'コピー済' : 'リンクコピー'}</span>
              </button>
              <button
                onClick={handleLineShare}
                className="px-3 py-2 rounded-xl bg-[#06C755]/30 hover:bg-[#06C755]/50 border border-[#06C755]/60 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                title="LINEで共有"
              >
                <Share2 className="w-3.5 h-3.5 text-[#06C755]" />
                <span>LINE</span>
              </button>
            </div>
          </div>
        </div>

        {/* 👥 登録済みフレンド一覧 */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              <span>フレンド一覧 ({friends.length}人)</span>
            </h3>
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="text-xs text-cyan-300 hover:text-cyan-200 flex items-center gap-1 font-semibold transition-colors cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{isAdding ? '閉じる' : '手動で友達追加'}</span>
            </button>
          </div>

          {/* 手動追加フォーム */}
          {isAdding && (
            <div className="p-3 rounded-2xl bg-black/40 border border-cyan-500/30 space-y-2 animate-in fade-in duration-150">
              <div className="text-[11px] text-slate-400">
                友達からもらった招待URL（または友達のお名前）を入力：
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newFriendInput}
                  onChange={(e) => setNewFriendInput(e.target.value)}
                  placeholder="https://.../?friend=〇〇 または 名前"
                  className="flex-1 bg-black/60 border border-white/20 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
                <button
                  onClick={handleAddFriendManual}
                  className="px-4 py-1.5 rounded-xl bg-cyan-600/40 hover:bg-cyan-600/60 border border-cyan-400/50 text-white font-bold text-xs transition-all active:scale-95 cursor-pointer shrink-0"
                >
                  登録
                </button>
              </div>
            </div>
          )}

          {/* フレンドカードリスト */}
          {friends.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-900/40 border border-white/5 text-center space-y-2">
              <p className="text-xs text-slate-400">
                まだフレンドが登録されていません。
              </p>
              <p className="text-[11px] text-slate-500">
                上の「招待リンク」をLINEやSNSで友達に送り、友達の家を訪れると自動的にここに登録されます！
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {friends.map((friend) => (
                <div
                  key={friend.id}
                  className="p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800/80 border border-white/10 hover:border-cyan-400/40 transition-all flex items-center justify-between gap-3 shadow-sm group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center font-bold text-white text-sm shadow shrink-0 border border-white/20">
                      {friend.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-white truncate group-hover:text-cyan-300 transition-colors">
                        {friend.name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        最終訪問: {formatDate(friend.lastVisitedAt)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleVisitFriend(friend)}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs flex items-center gap-1 shadow transition-all active:scale-95 cursor-pointer"
                      title="この友達の家に遊びに行く"
                    >
                      <Home className="w-3.5 h-3.5" />
                      <span>遊びに行く</span>
                    </button>
                    <button
                      onClick={() => handleDeleteFriend(friend.id, friend.name)}
                      className="p-1.5 rounded-xl hover:bg-rose-500/20 text-slate-500 hover:text-rose-300 transition-colors cursor-pointer"
                      title="フレンド削除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* トーストメッセージ */}
        {statusMessage && (
          <div className="p-2.5 rounded-xl bg-cyan-950/90 border border-cyan-400/60 text-cyan-200 text-xs text-center font-bold animate-in fade-in zoom-in duration-200">
            {statusMessage}
          </div>
        )}

        {/* フッター */}
        <div className="pt-2 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs transition-all cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
