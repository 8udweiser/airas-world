import { create } from 'zustand';
import { AirasWorldData, WeatherType, WorldEntity, PlayerState, Direction } from '../core/types/world';
import { AirasAsset } from '../core/types/asset';
import { DEFAULT_ASSETS } from '../core/asset/defaultAssets';
import { createInitialWorld } from '../core/world/initialWorld';
import { CommandManager } from '../core/commands/CommandManager';
import { IWorldCommand, SerializedCommand } from '../core/types/command';
import { ChangeWeatherCommand, MoveObjectCommand, DeleteObjectCommand, CreateObjectCommand } from '../core/commands/WorldCommands';

interface WorldStoreState {
  world: AirasWorldData;
  assets: Record<string, AirasAsset>;
  commandManager: CommandManager;
  canUndo: boolean;
  canRedo: boolean;
  undoHistory: SerializedCommand[];
  redoHistory: SerializedCommand[];
  
  // アクション
  executeCommand: (cmd: IWorldCommand) => boolean;
  undo: () => boolean;
  redo: () => boolean;
  
  // オブジェクト操作ショートカット
  createObject: (assetId: string, x: number, y: number) => string;
  moveObject: (entityId: string, toX: number, toY: number) => boolean;
  deleteObject: (entityId: string) => boolean;
  
  // 環境操作
  setWeather: (weather: WeatherType) => void;
  setTime: (time: number) => void;
  
  // プレイヤー移動（ゲームループ用）
  updatePlayerPosition: (x: number, y: number, direction: Direction, isMoving: boolean) => void;
  updatePlayerState: (updates: Partial<PlayerState>) => void;
  
  // アセット登録
  registerAsset: (asset: AirasAsset) => void;
}

const initialCommandManager = new CommandManager();

export const useWorldStore = create<WorldStoreState>((set, get) => {
  const initialWorld = createInitialWorld();

  // CommandManagerの履歴変化を購読
  initialCommandManager.subscribe((undoStack, redoStack) => {
    set({
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,
      undoHistory: undoStack,
      redoHistory: redoStack,
    });
  });

  return {
    world: initialWorld,
    assets: { ...DEFAULT_ASSETS },
    commandManager: initialCommandManager,
    canUndo: false,
    canRedo: false,
    undoHistory: [],
    redoHistory: [],

    executeCommand: (cmd: IWorldCommand) => {
      const { world, commandManager } = get();
      // 世界データのshallow copyでReact再レンダリングをトリガー
      const newWorld = {
        ...world,
        entities: { ...world.entities },
        environment: { ...world.environment },
      };
      const res = commandManager.execute(cmd, newWorld);
      if (res.success) {
        set({ world: newWorld });
        return true;
      }
      return false;
    },

    undo: () => {
      const { world, commandManager } = get();
      const newWorld = {
        ...world,
        entities: { ...world.entities },
        environment: { ...world.environment },
      };
      const res = commandManager.undo(newWorld);
      if (res.success) {
        set({ world: newWorld });
        return true;
      }
      return false;
    },

    redo: () => {
      const { world, commandManager } = get();
      const newWorld = {
        ...world,
        entities: { ...world.entities },
        environment: { ...world.environment },
      };
      const res = commandManager.redo(newWorld);
      if (res.success) {
        set({ world: newWorld });
        return true;
      }
      return false;
    },

    createObject: (assetId: string, x: number, y: number) => {
      const { assets, executeCommand } = get();
      const asset = assets[assetId];
      if (!asset) return '';

      const id = `${asset.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const entity: WorldEntity = {
        id,
        assetId: asset.id,
        name: asset.name,
        type: asset.type === 'character' || asset.category === 'npc' ? 'npc' : 'object',
        position: { x, y, z: 0 },
      };

      const cmd = new CreateObjectCommand(entity);
      executeCommand(cmd);
      return id;
    },

    moveObject: (entityId: string, toX: number, toY: number) => {
      const { world, executeCommand } = get();
      const target = world.entities[entityId];
      if (!target) return false;

      const cmd = new MoveObjectCommand(
        entityId,
        { ...target.position },
        { x: toX, y: toY, z: target.position.z },
        target.name
      );
      return executeCommand(cmd);
    },

    deleteObject: (entityId: string) => {
      const { world, executeCommand } = get();
      const target = world.entities[entityId];
      if (!target) return false;

      const cmd = new DeleteObjectCommand(target);
      return executeCommand(cmd);
    },

    setWeather: (weather: WeatherType) => {
      const { executeCommand } = get();
      executeCommand(new ChangeWeatherCommand(weather));
    },

    setTime: (time: number) => {
      set((state) => ({
        world: {
          ...state.world,
          environment: {
            ...state.world.environment,
            time: Math.max(0, Math.min(24, time)),
          },
        },
      }));
    },

    updatePlayerPosition: (x, y, direction, isMoving) => {
      set((state) => ({
        world: {
          ...state.world,
          player: {
            ...state.world.player,
            position: { ...state.world.player.position, x, y },
            direction,
            isMoving,
          },
        },
      }));
    },

    updatePlayerState: (updates: Partial<PlayerState>) => {
      set((state) => ({
        world: {
          ...state.world,
          player: {
            ...state.world.player,
            ...updates,
            position: updates.position
              ? { ...state.world.player.position, ...updates.position }
              : state.world.player.position,
          },
        },
      }));
    },

    registerAsset: (asset: AirasAsset) => {
      set((state) => ({
        assets: {
          ...state.assets,
          [asset.id]: asset,
        },
      }));
    },
  };
});
