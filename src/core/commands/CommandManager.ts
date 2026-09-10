import { AirasWorldData } from '../types/world';
import { IWorldCommand, CommandExecutionResult, SerializedCommand } from '../types/command';

export type CommandHistoryListener = (
  undoStack: SerializedCommand[],
  redoStack: SerializedCommand[]
) => void;

export class CommandManager {
  private undoStack: IWorldCommand[] = [];
  private redoStack: IWorldCommand[] = [];
  private maxHistory: number = 50;
  private listeners: Set<CommandHistoryListener> = new Set();

  constructor(maxHistory: number = 50) {
    this.maxHistory = maxHistory;
  }

  // リスナー登録
  subscribe(listener: CommandHistoryListener): () => void {
    this.listeners.add(listener);
    this.notify();
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const undoSerialized = this.undoStack.map((c) => c.serialize());
    const redoSerialized = this.redoStack.map((c) => c.serialize());
    this.listeners.forEach((fn) => fn(undoSerialized, redoSerialized));
  }

  // コマンドを実行してUndoスタックに追加
  execute(command: IWorldCommand, world: AirasWorldData): CommandExecutionResult {
    const result = command.execute(world);
    if (result.success) {
      this.undoStack.push(command);
      if (this.undoStack.length > this.maxHistory) {
        this.undoStack.shift();
      }
      // 新しいアクションを実行したらRedoスタックはクリア
      this.redoStack = [];
      this.notify();
    }
    return result;
  }

  // アンドゥ (元に戻す)
  undo(world: AirasWorldData): CommandExecutionResult {
    const cmd = this.undoStack.pop();
    if (!cmd) {
      return { success: false, message: 'これ以上元に戻せません' };
    }
    const result = cmd.undo(world);
    if (result.success) {
      this.redoStack.push(cmd);
      this.notify();
    } else {
      // 失敗した場合はスタックへ戻す
      this.undoStack.push(cmd);
    }
    return result;
  }

  // リドゥ (やり直す)
  redo(world: AirasWorldData): CommandExecutionResult {
    const cmd = this.redoStack.pop();
    if (!cmd) {
      return { success: false, message: 'これ以上やり直せません' };
    }
    const result = cmd.execute(world);
    if (result.success) {
      this.undoStack.push(cmd);
      this.notify();
    } else {
      this.redoStack.push(cmd);
    }
    return result;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }
}
