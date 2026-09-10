import { create } from 'zustand';

export type EditorTool = 'select' | 'place' | 'delete';

interface UIStoreState {
  selectedEntityId: string | null;
  activeMode: 'play' | 'edit';
  activeTool: EditorTool;
  placingAssetId: string | null;
  isAIPanelOpen: boolean;
  isAssetPickerOpen: boolean;
  activeDialogue: { title: string; lines: string[] } | null;
  notification: string | null;

  // アクション
  setSelectedEntityId: (id: string | null) => void;
  setActiveMode: (mode: 'play' | 'edit') => void;
  setActiveTool: (tool: EditorTool) => void;
  setPlacingAssetId: (assetId: string | null) => void;
  setAIPanelOpen: (open: boolean) => void;
  setAssetPickerOpen: (open: boolean) => void;
  setDialogue: (dialogue: { title: string; lines: string[] } | null) => void;
  showNotification: (msg: string) => void;
}

export const useUIStore = create<UIStoreState>((set) => ({
  selectedEntityId: null,
  activeMode: 'edit', // プロトタイプ初期状態はエディットしやすいモード
  activeTool: 'select',
  placingAssetId: null,
  isAIPanelOpen: false,
  isAssetPickerOpen: false,
  activeDialogue: null,
  notification: null,

  setSelectedEntityId: (id) => set({ selectedEntityId: id }),
  setActiveMode: (mode) => set({ activeMode: mode, selectedEntityId: null, placingAssetId: null }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setPlacingAssetId: (assetId) => set({ placingAssetId: assetId, activeTool: assetId ? 'place' : 'select' }),
  setAIPanelOpen: (open) => set({ isAIPanelOpen: open }),
  setAssetPickerOpen: (open) => set({ isAssetPickerOpen: open }),
  setDialogue: (dialogue) => set({ activeDialogue: dialogue }),
  showNotification: (msg) => {
    set({ notification: msg });
    setTimeout(() => {
      set((state) => (state.notification === msg ? { notification: null } : state));
    }, 3000);
  },
}));
