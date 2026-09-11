import { get, set, del } from 'idb-keyval';

export interface FriendProfile {
  id: string;             // 一意ID (例: friend_abc123)
  name: string;           // 友達の名前 (例: たろう)
  assetId: string;        // アバターアセットID (例: character_student)
  houseId: string;        // 友達の家/ワールドID
  roomId: string;         // P2PルームID
  lastVisitedAt: number;  // 最終訪問日時 (UNIXタイムスタンプ)
  note?: string;          // メモ
}

const STORAGE_KEY_FRIENDS = 'airas_friends_v1';

export class FriendStorage {
  /**
   * 登録済みの全フレンド一覧を取得
   */
  public static async getFriends(): Promise<FriendProfile[]> {
    if (typeof window === 'undefined') return [];
    try {
      const friends = await get<FriendProfile[]>(STORAGE_KEY_FRIENDS);
      if (Array.isArray(friends)) {
        // 最終訪問日時が新しい順にソート
        return friends.sort((a, b) => b.lastVisitedAt - a.lastVisitedAt);
      }
    } catch (err) {
      console.warn('[FriendStorage] フレンド一覧の取得に失敗しました:', err);
    }
    return [];
  }

  /**
   * フレンドを追加または更新
   */
  public static async saveFriend(friend: FriendProfile): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      const friends = (await get<FriendProfile[]>(STORAGE_KEY_FRIENDS)) || [];
      const index = friends.findIndex((f) => f.id === friend.id || f.houseId === friend.houseId);
      if (index >= 0) {
        friends[index] = { ...friends[index], ...friend };
      } else {
        friends.push(friend);
      }
      await set(STORAGE_KEY_FRIENDS, friends);
      console.log('[FriendStorage] 🤝 フレンドを保存しました:', friend.name);
      return true;
    } catch (err) {
      console.error('[FriendStorage] フレンドの保存に失敗しました:', err);
      return false;
    }
  }

  /**
   * フレンドを削除
   */
  public static async removeFriend(friendId: string): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      const friends = (await get<FriendProfile[]>(STORAGE_KEY_FRIENDS)) || [];
      const filtered = friends.filter((f) => f.id !== friendId);
      await set(STORAGE_KEY_FRIENDS, filtered);
      console.log('[FriendStorage] 🗑️ フレンドを削除しました:', friendId);
      return true;
    } catch (err) {
      console.error('[FriendStorage] フレンド削除に失敗しました:', err);
      return false;
    }
  }

  /**
   * 最終訪問日時を更新
   */
  public static async updateLastVisited(friendId: string): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const friends = (await get<FriendProfile[]>(STORAGE_KEY_FRIENDS)) || [];
      const target = friends.find((f) => f.id === friendId);
      if (target) {
        target.lastVisitedAt = Date.now();
        await set(STORAGE_KEY_FRIENDS, friends);
      }
    } catch (_) {}
  }
}
