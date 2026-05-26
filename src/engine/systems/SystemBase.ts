import { WorldStateManager } from '../core/WorldState.js';

export abstract class SystemBase {
  abstract name: string;
  abstract onInit(stateManager: WorldStateManager): void;
  abstract onTick(stateManager: WorldStateManager): void;
  abstract onEvent(event: string, data: unknown, stateManager: WorldStateManager): void;
}