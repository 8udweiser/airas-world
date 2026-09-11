import { get, set, del } from 'idb-keyval';

export interface SavedChatMessage {
  id: string;
  sender: string;
  text: string;
  isSelf: boolean;
  time: string;
  timestamp: number;
}

const STORAGE_KEY_CHAT = 'airas_chat_history_v1';
const MAX_SAVED_MESSAGES = 200;

export class ChatStorage {
  /**
   * 保存されているチャット履歴を取得
   */
  public static async loadChatHistory(): Promise<SavedChatMessage[]> {
    if (typeof window === 'undefined') return [];
    try {
      const messages = await get<SavedChatMessage[]>(STORAGE_KEY_CHAT);
      if (Array.isArray(messages)) {
        return messages;
      }
    } catch (err) {
      console.warn('[ChatStorage] チャット履歴のロードに失敗しました:', err);
    }
    return [];
  }

  /**
   * 新しいメッセージを追加保存
   */
  public static async saveMessage(msg: SavedChatMessage): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const existing = (await get<SavedChatMessage[]>(STORAGE_KEY_CHAT)) || [];
      const updated = [...existing, msg].slice(-MAX_SAVED_MESSAGES);
      await set(STORAGE_KEY_CHAT, updated);
    } catch (err) {
      console.warn('[ChatStorage] メッセージの保存に失敗しました:', err);
    }
  }

  /**
   * チャット履歴を一括保存
   */
  public static async saveAllMessages(messages: SavedChatMessage[]): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      await set(STORAGE_KEY_CHAT, messages.slice(-MAX_SAVED_MESSAGES));
    } catch (err) {
      console.warn('[ChatStorage] チャット履歴の一括保存に失敗しました:', err);
    }
  }

  /**
   * チャット履歴を消去
   */
  public static async clearChatHistory(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      await del(STORAGE_KEY_CHAT);
      console.log('[ChatStorage] 🗑️ チャット履歴を消去しました');
      return true;
    } catch (err) {
      console.error('[ChatStorage] チャット履歴の消去に失敗しました:', err);
      return false;
    }
  }
}
