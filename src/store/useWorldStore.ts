import { create } from 'zustand';
import { AirasWorldData, WeatherType, WorldEntity, PlayerState, Direction } from '../core/types/world';
import { AirasAsset } from '../core/types/asset';
import { DEFAULT_ASSETS } from '../core/asset/defaultAssets';
import { createInitialWorld } from '../core/world/initialWorld';
import { CommandManager } from '../core/commands/CommandManager';
import { IWorldCommand, SerializedCommand } from '../core/types/command';
import { ChangeWeatherCommand, MoveObjectCommand, DeleteObjectCommand, CreateObjectCommand } from '../core/commands/WorldCommands';
import { WorldStorage } from '../core/storage/WorldStorage';
import { multiplayerManager } from '../core/multiplayer/MultiplayerManager';

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
  updateObjectPositionDirect: (entityId: string, toX: number, toY: number, direction?: Direction) => void;
  updateObjectDirectionDirect: (entityId: string, direction: Direction) => void;
  rotateObject: (entityId: string, toDir: Direction) => boolean;
  commitMoveObject: (
    entityId: string,
    fromPos: { x: number; y: number; z?: number },
    toPos: { x: number; y: number; z?: number },
    fromDir?: Direction,
    toDir?: Direction
  ) => boolean;
  deleteObject: (entityId: string) => boolean;
  
  // 環境操作
  setWeather: (weather: WeatherType) => void;
  setTime: (time: number) => void;
  
  // プレイヤー移動（ゲームループ用）
  updatePlayerPosition: (x: number, y: number, direction: Direction, isMoving: boolean) => void;
  updatePlayerState: (updates: Partial<PlayerState>) => void;
  
  // タイル操作（川作り・地形変更）
  setTileAt: (worldX: number, worldY: number, tileId: string) => boolean;

  // アセット登録
  registerAsset: (asset: AirasAsset) => void;

  // 保存・復元・リセット・リモート同期
  isSaveLoaded: boolean;
  loadSavedWorld: (worldData: AirasWorldData) => void;
  resetWorldToDefault: () => Promise<void>;
  importWorldData: (worldData: AirasWorldData) => void;
  applyRemoteWorldEdit: (packet: any) => void;
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
    isSaveLoaded: false,

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
        WorldStorage.scheduleAutoSave(newWorld);

        // 🌐 マルチプレイヤー同期: コマンド種別に応じたパケットを他プレイヤーに即時配信
        try {
          const serialized = cmd.serialize();
          if (serialized.type === 'CREATE_OBJECT') {
            multiplayerManager.broadcastWorldEdit('place_entity', serialized.payload.entity);
          } else if (serialized.type === 'DELETE_OBJECT') {
            multiplayerManager.broadcastWorldEdit('remove_entity', { entityId: serialized.payload.entity?.id || serialized.payload.entityId });
          } else if (serialized.type === 'MOVE_OBJECT') {
            multiplayerManager.broadcastWorldEdit('move_entity', {
              entityId: serialized.payload.entityId,
              position: serialized.payload.to,
              direction: serialized.payload.toDir,
            });
          } else if (serialized.type === 'CHANGE_WEATHER') {
            multiplayerManager.broadcastWorldEdit('change_weather', { weather: serialized.payload.weather });
          }
        } catch (_) {}

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
        WorldStorage.scheduleAutoSave(newWorld);
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
        WorldStorage.scheduleAutoSave(newWorld);
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

    updateObjectPositionDirect: (entityId: string, toX: number, toY: number, direction?: Direction) => {
      const { world } = get();
      const target = world.entities[entityId];
      if (!target) return;
      set({
        world: {
          ...world,
          entities: {
            ...world.entities,
            [entityId]: {
              ...target,
              position: { ...target.position, x: toX, y: toY },
              direction: direction || target.direction,
            },
          },
        },
      });
    },

    updateObjectDirectionDirect: (entityId: string, direction: Direction) => {
      const { world } = get();
      const target = world.entities[entityId];
      if (!target) return;
      set({
        world: {
          ...world,
          entities: {
            ...world.entities,
            [entityId]: {
              ...target,
              direction,
            },
          },
        },
      });
    },

    rotateObject: (entityId: string, toDir: Direction) => {
      const { world, executeCommand } = get();
      const target = world.entities[entityId];
      if (!target) return false;

      const cmd = new MoveObjectCommand(
        entityId,
        { ...target.position },
        { ...target.position },
        target.name,
        target.direction || 'down',
        toDir
      );
      return executeCommand(cmd);
    },

    commitMoveObject: (
      entityId: string,
      fromPos: { x: number; y: number; z?: number },
      toPos: { x: number; y: number; z?: number },
      fromDir?: Direction,
      toDir?: Direction
    ) => {
      const { world, executeCommand } = get();
      const target = world.entities[entityId];
      if (!target) return false;

      const cmd = new MoveObjectCommand(
        entityId,
        { x: fromPos.x, y: fromPos.y, z: fromPos.z ?? target.position.z },
        { x: toPos.x, y: toPos.y, z: toPos.z ?? target.position.z },
        target.name,
        fromDir ?? target.direction,
        toDir ?? target.direction
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
      try {
        multiplayerManager.broadcastWorldEdit('set_time', { time });
      } catch (_) {}
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

    setTileAt: (worldX: number, worldY: number, tileId: string) => {
      const { world } = get();
      const tileSize = world.map.tileSize || 32;
      const chunkSize = world.map.chunkSize || 16;
      const tileX = Math.floor(worldX / tileSize);
      const tileY = Math.floor(worldY / tileSize);
      const cx = Math.floor(tileX / chunkSize);
      const cy = Math.floor(tileY / chunkSize);
      const chunkKey = `${cx},${cy}`;
      const chunk = world.map.chunks[chunkKey];
      if (!chunk || !chunk.tiles) return false;

      const lx = ((tileX % chunkSize) + chunkSize) % chunkSize;
      const ly = ((tileY % chunkSize) + chunkSize) % chunkSize;
      if (!chunk.tiles[ly] || !chunk.tiles[ly][lx]) return false;

      const newTiles = chunk.tiles.map((row, rIdx) => {
        if (rIdx !== ly) return row;
        return row.map((t, cIdx) => {
          if (cIdx !== lx) return t;
          return { ...t, tileId };
        });
      });

      const newChunks = {
        ...world.map.chunks,
        [chunkKey]: {
          ...chunk,
          tiles: newTiles,
        },
      };

      const newWorld = {
        ...world,
        map: {
          ...world.map,
          chunks: newChunks,
        },
      };

      set({ world: newWorld });
      WorldStorage.scheduleAutoSave(newWorld);

      try {
        multiplayerManager.broadcastWorldEdit('set_tile', { worldX, worldY, tileId });
      } catch (_) {}

      return true;
    },

    registerAsset: (asset: AirasAsset) => {
      set((state) => ({
        assets: {
          ...state.assets,
          [asset.id]: asset,
        },
      }));
    },

    loadSavedWorld: (worldData: AirasWorldData) => {
      set({
        world: worldData,
        isSaveLoaded: true,
      });
    },

    resetWorldToDefault: async () => {
      await WorldStorage.clearLocalWorld();
      const freshWorld = createInitialWorld();
      set({
        world: freshWorld,
        canUndo: false,
        canRedo: false,
        undoHistory: [],
        redoHistory: [],
      });
    },

    importWorldData: (worldData: AirasWorldData) => {
      set({
        world: worldData,
      });
      WorldStorage.scheduleAutoSave(worldData);
      try {
        multiplayerManager.broadcastWorldEdit('full_sync', worldData);
      } catch (_) {}
    },

    // 🌐 他プレイヤーからのリアルタイム編集パケットの適用
    applyRemoteWorldEdit: (packet: any) => {
      const { world } = get();
      if (!packet || !packet.action) return;

      if (packet.action === 'place_entity') {
        const entity: WorldEntity = packet.data;
        if (!entity || !entity.id) return;
        const newWorld = {
          ...world,
          entities: {
            ...world.entities,
            [entity.id]: entity,
          },
        };
        set({ world: newWorld });
        WorldStorage.scheduleAutoSave(newWorld);
      } else if (packet.action === 'remove_entity') {
        const { entityId } = packet.data;
        if (!entityId || !world.entities[entityId]) return;
        const newEntities = { ...world.entities };
        delete newEntities[entityId];
        const newWorld = {
          ...world,
          entities: newEntities,
        };
        set({ world: newWorld });
        WorldStorage.scheduleAutoSave(newWorld);
      } else if (packet.action === 'move_entity') {
        const { entityId, position, direction } = packet.data;
        const target = world.entities[entityId];
        if (!target) return;
        const newWorld = {
          ...world,
          entities: {
            ...world.entities,
            [entityId]: {
              ...target,
              position: { ...target.position, ...position },
              direction: direction || target.direction,
            },
          },
        };
        set({ world: newWorld });
        WorldStorage.scheduleAutoSave(newWorld);
      } else if (packet.action === 'set_tile') {
        const { worldX, worldY, tileId } = packet.data;
        const tileSize = world.map.tileSize || 32;
        const chunkSize = world.map.chunkSize || 16;
        const tileX = Math.floor(worldX / tileSize);
        const tileY = Math.floor(worldY / tileSize);
        const cx = Math.floor(tileX / chunkSize);
        const cy = Math.floor(tileY / chunkSize);
        const chunkKey = `${cx},${cy}`;
        const chunk = world.map.chunks[chunkKey];
        if (!chunk || !chunk.tiles) return;

        const lx = ((tileX % chunkSize) + chunkSize) % chunkSize;
        const ly = ((tileY % chunkSize) + chunkSize) % chunkSize;
        if (!chunk.tiles[ly] || !chunk.tiles[ly][lx]) return;

        const newTiles = chunk.tiles.map((row, rIdx) => {
          if (rIdx !== ly) return row;
          return row.map((t, cIdx) => {
            if (cIdx !== lx) return t;
            return { ...t, tileId };
          });
        });

        const newChunks = {
          ...world.map.chunks,
          [chunkKey]: { ...chunk, tiles: newTiles },
        };
        const newWorld = {
          ...world,
          map: { ...world.map, chunks: newChunks },
        };
        set({ world: newWorld });
        WorldStorage.scheduleAutoSave(newWorld);
      } else if (packet.action === 'change_weather') {
        const { weather } = packet.data;
        set((state) => ({
          world: {
            ...state.world,
            environment: { ...state.world.environment, weather },
          },
        }));
      } else if (packet.action === 'set_time') {
        const { time } = packet.data;
        set((state) => ({
          world: {
            ...state.world,
            environment: { ...state.world.environment, time },
          },
        }));
      } else if (packet.action === 'full_sync') {
        const syncedWorld = packet.data;
        if (syncedWorld && syncedWorld.map && syncedWorld.entities) {
          set({ world: syncedWorld });
          WorldStorage.scheduleAutoSave(syncedWorld);
        }
      }
    },
  };
});

// アプリ起動時にローカル保存データを自動復元
if (typeof window !== 'undefined') {
  WorldStorage.loadLocalWorld().then((saved) => {
    if (saved) {
      useWorldStore.getState().loadSavedWorld(saved);
    } else {
      useWorldStore.setState({ isSaveLoaded: true });
    }
  });
}
