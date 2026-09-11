import { AirasWorldData, WorldEntity, WeatherType } from '../types/world';
import { IWorldCommand, CommandType, SerializedCommand, CommandExecutionResult } from '../types/command';

// 1. オブジェクト生成コマンド
export class CreateObjectCommand implements IWorldCommand {
  readonly type: CommandType = 'CREATE_OBJECT';
  readonly description: string;
  private entity: WorldEntity;

  constructor(entity: WorldEntity) {
    this.entity = { ...entity };
    this.description = `「${entity.name}」を配置 (${Math.round(entity.position.x)}, ${Math.round(entity.position.y)})`;
  }

  execute(world: AirasWorldData): CommandExecutionResult {
    world.entities[this.entity.id] = { ...this.entity };
    return {
      success: true,
      affectedEntityIds: [this.entity.id],
      message: this.description,
    };
  }

  undo(world: AirasWorldData): CommandExecutionResult {
    delete world.entities[this.entity.id];
    return {
      success: true,
      affectedEntityIds: [this.entity.id],
      message: `「${this.entity.name}」の配置を取り消し`,
    };
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      description: this.description,
      payload: { entity: this.entity },
      timestamp: Date.now(),
    };
  }
}

// 2. オブジェクト移動コマンド
export class MoveObjectCommand implements IWorldCommand {
  readonly type: CommandType = 'MOVE_OBJECT';
  readonly description: string;
  private entityId: string;
  private fromPos: { x: number; y: number; z: number };
  private toPos: { x: number; y: number; z: number };
  private entityName: string = '';

  constructor(
    entityId: string,
    fromPos: { x: number; y: number; z: number },
    toPos: { x: number; y: number; z: number },
    name?: string
  ) {
    this.entityId = entityId;
    this.fromPos = { ...fromPos };
    this.toPos = { ...toPos };
    this.entityName = name || entityId;
    this.description = `「${this.entityName}」を移動 (${Math.round(toPos.x)}, ${Math.round(toPos.y)})`;
  }

  execute(world: AirasWorldData): CommandExecutionResult {
    const target = world.entities[this.entityId];
    if (!target) {
      return { success: false, error: `Entity ${this.entityId} not found` };
    }
    this.entityName = target.name;
    target.position = { ...this.toPos };
    return {
      success: true,
      affectedEntityIds: [this.entityId],
      message: `「${target.name}」を移動しました`,
    };
  }

  undo(world: AirasWorldData): CommandExecutionResult {
    const target = world.entities[this.entityId];
    if (!target) {
      return { success: false, error: `Entity ${this.entityId} not found` };
    }
    target.position = { ...this.fromPos };
    return {
      success: true,
      affectedEntityIds: [this.entityId],
      message: `「${target.name}」の移動を取り消し`,
    };
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      description: this.description,
      payload: {
        entityId: this.entityId,
        fromPos: this.fromPos,
        toPos: this.toPos,
        entityName: this.entityName,
      },
      timestamp: Date.now(),
    };
  }
}

// 3. オブジェクト削除コマンド
export class DeleteObjectCommand implements IWorldCommand {
  readonly type: CommandType = 'DELETE_OBJECT';
  readonly description: string;
  private entity: WorldEntity | null = null;
  private entityId: string;

  constructor(entityOrId: WorldEntity | string) {
    if (typeof entityOrId === 'string') {
      this.entityId = entityOrId;
      this.description = `オブジェクトを削除`;
    } else {
      this.entityId = entityOrId.id;
      this.entity = { ...entityOrId };
      this.description = `「${entityOrId.name}」を削除`;
    }
  }

  execute(world: AirasWorldData): CommandExecutionResult {
    if (!this.entity && world.entities[this.entityId]) {
      this.entity = { ...world.entities[this.entityId] };
    }
    delete world.entities[this.entityId];
    return {
      success: true,
      affectedEntityIds: [this.entityId],
      message: this.description,
    };
  }

  undo(world: AirasWorldData): CommandExecutionResult {
    if (this.entity) {
      world.entities[this.entity.id] = { ...this.entity };
      return {
        success: true,
        affectedEntityIds: [this.entity.id],
        message: `「${this.entity.name}」の削除を取り消し`,
      };
    }
    return { success: false, error: 'Cannot undo delete without entity backup' };
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      description: this.description,
      payload: { entityId: this.entityId, entity: this.entity },
      timestamp: Date.now(),
    };
  }
}

// 4. 天候変更コマンド
export class ChangeWeatherCommand implements IWorldCommand {
  readonly type: CommandType = 'CHANGE_WEATHER';
  readonly description: string;
  private newWeather: WeatherType;
  private prevWeather: WeatherType = 'clear';

  constructor(weather: WeatherType) {
    this.newWeather = weather;
    const names: Record<WeatherType, string> = {
      clear: '快晴',
      rain: '雨',
      heavy_rain: '大雨',
      typhoon: '台風（超大雨・落雷）',
      snow: '雪',
      fog: '霧',
      sunset: '夕焼け',
    };
    this.description = `天候を「${names[weather] || weather}」に変更`;
  }

  execute(world: AirasWorldData): CommandExecutionResult {
    this.prevWeather = world.environment.weather;
    world.environment.weather = this.newWeather;
    return {
      success: true,
      message: this.description,
    };
  }

  undo(world: AirasWorldData): CommandExecutionResult {
    world.environment.weather = this.prevWeather;
    return {
      success: true,
      message: `天候を元に戻しました`,
    };
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      description: this.description,
      payload: { newWeather: this.newWeather, prevWeather: this.prevWeather },
      timestamp: Date.now(),
    };
  }
}

// 5. バッチ（一括）コマンド
export class BatchCommand implements IWorldCommand {
  readonly type: CommandType = 'BATCH_COMMAND';
  readonly description: string;
  private commands: IWorldCommand[];

  constructor(description: string, commands: IWorldCommand[]) {
    this.description = description;
    this.commands = commands;
  }

  execute(world: AirasWorldData): CommandExecutionResult {
    const allAffected: string[] = [];
    for (const cmd of this.commands) {
      const res = cmd.execute(world);
      if (res.affectedEntityIds) {
        allAffected.push(...res.affectedEntityIds);
      }
    }
    return {
      success: true,
      affectedEntityIds: allAffected,
      message: this.description,
    };
  }

  undo(world: AirasWorldData): CommandExecutionResult {
    const allAffected: string[] = [];
    // 逆順でUndo
    for (let i = this.commands.length - 1; i >= 0; i--) {
      const res = this.commands[i].undo(world);
      if (res.affectedEntityIds) {
        allAffected.push(...res.affectedEntityIds);
      }
    }
    return {
      success: true,
      affectedEntityIds: allAffected,
      message: `${this.description} を取り消しました`,
    };
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      description: this.description,
      payload: {
        commands: this.commands.map((c) => c.serialize()),
      },
      timestamp: Date.now(),
    };
  }
}
