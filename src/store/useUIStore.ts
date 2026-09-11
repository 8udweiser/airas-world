import { create } from 'zustand';

export type EditorTool = 'select' | 'place' | 'delete';

// 🎒 デフォルトのホットバー10スロット (1〜9, 0)
export const DEFAULT_HOTBAR_SLOTS: string[] = [
  'vending_machine_retro', // 1: 昭和レトロ自販機
  'retro_cafe',            // 2: 昭和純喫茶「あいらす」
  'street_lamp_warm',       // 3: 温光の街灯
  'vehicle_lamborghini',   // 4: ランボルギーニ
  'park_fountain',         // 5: 公園の噴水
  'npc_cat',               // 6: 三毛猫ミケ
  'retro_bench',           // 7: 木製ベンチ
  'tree_sakura_dome',      // 8: 満開の桜
  'telegraph_pole',        // 9: 電柱
  'furniture_bed_double',  // 0: 昭和レトロベッド
];

function loadSavedHotbar(): string[] {
  if (typeof window === 'undefined') return DEFAULT_HOTBAR_SLOTS;
  try {
    const saved = localStorage.getItem('airas_hotbar_slots');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length === 10) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load saved hotbar slots', e);
  }
  return DEFAULT_HOTBAR_SLOTS;
}

interface UIStoreState {
  selectedEntityId: string | null;
  activeMode: 'play' | 'edit';
  activeTool: EditorTool;
  placingAssetId: string | null;
  isAIPanelOpen: boolean;
  isAssetPickerOpen: boolean;
  activeDialogue: { title: string; lines: string[] } | null;
  notification: string | null;
  fps: number;
  isMuted: boolean;
  isSnapToGrid: boolean;

  // 🎒 マイクラ風インベントリ ＆ 10枠固定ホットバー
  hotbarSlots: string[];
  isInventoryOpen: boolean;

  // アクション
  setSelectedEntityId: (id: string | null) => void;
  setActiveMode: (mode: 'play' | 'edit') => void;
  setActiveTool: (tool: EditorTool) => void;
  setPlacingAssetId: (assetId: string | null) => void;
  setAIPanelOpen: (open: boolean) => void;
  setAssetPickerOpen: (open: boolean) => void;
  setDialogue: (dialogue: { title: string; lines: string[] } | null) => void;
  showNotification: (msg: string) => void;
  setFps: (fps: number) => void;
  toggleMute: () => void;
  setMuted: (muted: boolean) => void;
  toggleSnapToGrid: () => void;
  setSnapToGrid: (snap: boolean) => void;

  // 🎒 ホットバー＆インベントリ操作
  setHotbarSlot: (index: number, assetId: string) => void;
  resetHotbarSlots: () => void;
  setIsInventoryOpen: (open: boolean) => void;
  toggleInventory: () => void;
}

export const useUIStore = create<UIStoreState>((set) => ({
  selectedEntityId: null,
  activeMode: 'play', // 起動直後から快適に歩き回れるようデフォルトは play
  activeTool: 'select',
  placingAssetId: null,
  isAIPanelOpen: false,
  isAssetPickerOpen: false,
  activeDialogue: null,
  notification: null,
  fps: 60,
  isMuted: false,
  isSnapToGrid: true, // デフォルトはマス吸着ON (32pxスナップ)

  // 🎒 10枠固定ホットバー＆インベントリ
  hotbarSlots: loadSavedHotbar(),
  isInventoryOpen: false,

  setSelectedEntityId: (id) => set({ selectedEntityId: id }),
  setActiveMode: (mode) => set({ activeMode: mode, selectedEntityId: null, placingAssetId: null }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setPlacingAssetId: (assetId) => set({ placingAssetId: assetId, activeTool: assetId ? 'place' : 'select' }),
  setAIPanelOpen: (open) => set({ isAIPanelOpen: open }),
  setAssetPickerOpen: (open) => set({ isAssetPickerOpen: open }),
  setDialogue: (dialogue) => set({ activeDialogue: dialogue }),
  setFps: (fps) => set({ fps }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  setMuted: (muted) => set({ isMuted: muted }),
  toggleSnapToGrid: () => set((state) => ({ isSnapToGrid: !state.isSnapToGrid })),
  setSnapToGrid: (snap) => set({ isSnapToGrid: snap }),
  showNotification: (msg) => {
    set({ notification: msg });
    setTimeout(() => {
      set((state) => (state.notification === msg ? { notification: null } : state));
    }, 3000);
  },

  // 🎒 ホットバー操作
  setHotbarSlot: (index, assetId) => {
    set((state) => {
      const next = [...state.hotbarSlots];
      if (index >= 0 && index < 10) {
        next[index] = assetId;
        try {
          localStorage.setItem('airas_hotbar_slots', JSON.stringify(next));
        } catch {}
      }
      return { hotbarSlots: next };
    });
  },
  resetHotbarSlots: () => {
    try {
      localStorage.setItem('airas_hotbar_slots', JSON.stringify(DEFAULT_HOTBAR_SLOTS));
    } catch {}
    set({ hotbarSlots: DEFAULT_HOTBAR_SLOTS });
  },
  setIsInventoryOpen: (open) => set({ isInventoryOpen: open }),
  toggleInventory: () => set((state) => ({ isInventoryOpen: !state.isInventoryOpen })),
}));
