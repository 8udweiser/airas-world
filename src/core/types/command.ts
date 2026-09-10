import { AirasWorldData, WorldEntity, WeatherType } from './world';

export type CommandType = 
  | 'CREATE_OBJECT'
  | 'MOVE_OBJECT'
  | 'DELETE_OBJECT'
  | 'ROTATE_OBJECT'
  | 'SCALE_OBJECT'
  | 'CHANGE_WEATHER'
  | 'CHANGE_TIME'
  | 'BATCH_COMMAND';

export interface SerializedCommand {
  type: CommandType;
  description: string;
  payload: any;
  timestamp: number;
}

export interface CommandExecutionResult {
  success: boolean;
  affectedEntityIds?: string[];
  message?: string;
  error?: string;
}

export interface IWorldCommand {
  readonly type: CommandType;
  readonly description: string;
  execute(world: AirasWorldData): CommandExecutionResult;
  undo(world: AirasWorldData): CommandExecutionResult;
  serialize(): SerializedCommand;
}
