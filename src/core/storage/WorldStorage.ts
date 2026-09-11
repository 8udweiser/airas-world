import { get, set, del } from 'idb-keyval';
import { AirasWorldData } from '../types/world';
import { createInitialWorld } from '../world/initialWorld';

const STORAGE_KEY_WORLD = 'airas_saved_world_v1';
const AUTO_SAVE_DEBOUNCE_MS = 1200;

let autoSaveTimer: any = null;
let lastSavedHash: string = '';

export interface SavedWorldMetadata {
  savedAt: number;
  objectCount: number;
  name: string;
}

/**
 * 簡易ハッシュ計算（無駄なIndexedDB書き込みを防止）
 */
function computeWorldHash(world: AirasWorldData): string {
  const entityKeys = Object.keys(world.entities).sort();
  const entityCount = entityKeys.length;
  return `${entityCount}_${world.environment.weather}_${world.environment.time.toFixed(1)}`;
}

export class WorldStorage {
  /**
   * ローカルIndexedDBからワールドデータをロード
   */
  public static async loadLocalWorld(): Promise<AirasWorldData | null> {
    if (typeof window === 'undefined') return null;
    try {
      const saved = await get<AirasWorldData>(STORAGE_KEY_WORLD);
      if (saved && saved.entities && saved.map) {
        // 新しく initialWorld に追加された初期エンティティ（四季の木など）を既存セーブデータに自動マージ
        try {
          const initial = createInitialWorld();
          let addedCount = 0;
          for (const [key, ent] of Object.entries(initial.entities)) {
            if (!saved.entities[key]) {
              saved.entities[key] = ent;
              addedCount++;
            }
          }
          if (addedCount > 0) {
            console.log(`[WorldStorage] 🌸 新しい初期エンティティ (${addedCount}件) を既存ワールドにマージしました`);
          }
        } catch (mergeErr) {
          console.warn('[WorldStorage] 初期エンティティのマージに失敗しました:', mergeErr);
        }

        console.log('[WorldStorage] 💾 保存されたワールドデータを復元しました (オブジェクト数:', Object.keys(saved.entities).length, ')');
        return saved;
      }
    } catch (err) {
      console.warn('[WorldStorage] ワールドデータのロードに失敗しました:', err);
    }
    return null;
  }

  /**
   * ローカルIndexedDBに即座に保存
   */
  public static async saveImmediate(world: AirasWorldData): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      const dataToSave: AirasWorldData = {
        ...world,
        name: world.name || 'マイワールド',
      };
      await set(STORAGE_KEY_WORLD, dataToSave);
      console.log('[WorldStorage] ✅ ワールドをIndexedDBに保存しました');
      return true;
    } catch (err) {
      console.error('[WorldStorage] ワールドの保存に失敗しました:', err);
      return false;
    }
  }

  /**
   * 変更を検知してデバウンス（遅延）自動保存
   */
  public static scheduleAutoSave(world: AirasWorldData, onSaved?: () => void) {
    if (typeof window === 'undefined') return;

    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }

    autoSaveTimer = setTimeout(async () => {
      const currentHash = computeWorldHash(world);
      if (currentHash !== lastSavedHash) {
        lastSavedHash = currentHash;
        const success = await this.saveImmediate(world);
        if (success && onSaved) {
          onSaved();
        }
      }
    }, AUTO_SAVE_DEBOUNCE_MS);
  }

  /**
   * ローカル保存データを削除して初期状態にリセット
   */
  public static async clearLocalWorld(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      await del(STORAGE_KEY_WORLD);
      console.log('[WorldStorage] 🔄 保存されたワールドデータを消去しました');
      return true;
    } catch (err) {
      console.error('[WorldStorage] リセットに失敗しました:', err);
      return false;
    }
  }

  /**
   * ワールドデータをJSONファイルとしてダウンロード（エクスポート）
   */
  public static exportToJson(world: AirasWorldData, filename?: string) {
    if (typeof window === 'undefined') return;
    const jsonStr = JSON.stringify(world, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `airas_house_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * JSON文字列からワールドデータを検証・パース（インポート）
   */
  public static parseFromJson(jsonStr: string): AirasWorldData | null {
    try {
      const data = JSON.parse(jsonStr);
      if (data && data.map && data.entities && typeof data.entities === 'object') {
        return data as AirasWorldData;
      }
    } catch (err) {
      console.warn('[WorldStorage] JSONパース失敗:', err);
    }
    return null;
  }
}
