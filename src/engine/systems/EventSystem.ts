import { WorldStateManager } from '../core/WorldState';
import { SystemBase } from './SystemBase';
import { EventBus } from '../core/EventBus';
import { EffectExecutor } from '../core/EffectExecutor';
import { LogEntry, WorldState } from '../types';
import { Event } from '../models/Event';

export class EventSystem extends SystemBase {
  name = 'EventSystem';

  private eventBus: EventBus;
  private effectExecutor!: EffectExecutor;

  constructor(eventBus: EventBus) {
    super();
    this.eventBus = eventBus;
  }

  onInit(stateManager: WorldStateManager): void {
    this.effectExecutor = new EffectExecutor(stateManager, this.eventBus);
  }

  onTick(stateManager: WorldStateManager): void {
    const snapshot = stateManager.getSnapshot();
    const events = stateManager.getEvents();

    for (const event of events) {
      event.tickCooldown();

      if (!this.canFire(event, snapshot)) continue;

      if (event.checkConditions(snapshot)) {
        this.fireEvent(event, stateManager, snapshot);
      }
    }
  }

  onEvent(event: string, data: unknown, stateManager: WorldStateManager): void {
    // Handle externally triggered events (e.g., from InteractionSystem)
    if (event === 'trigger_event') {
      const eventId = (data as { eventId: string }).eventId;
      const evt = stateManager.getEvents().find(e => e.id === eventId);
      if (evt) {
        const snapshot = stateManager.getSnapshot();
        this.fireEvent(evt, stateManager, snapshot);
      }
    }
  }

  private canFire(event: Event, worldState: WorldState): boolean {
    if (event.isOnCooldown()) return false;

    if (!event.repeatable) {
      const firedFlag = `event_fired_${event.id}`;
      if (worldState.globalFlags[firedFlag] === true) return false;
    }

    return true;
  }

  private fireEvent(event: Event, stateManager: WorldStateManager, worldState: WorldState): void {
    const tick = worldState.tickCount;

    for (const effect of event.effects) {
      this.effectExecutor.execute(effect, tick);
    }

    if (!event.repeatable) {
      stateManager.setGlobalFlag(`event_fired_${event.id}`, true);
    }

    event.startCooldown();

    const logEntry: LogEntry = {
      tick,
      type: 'event',
      description: `事件「${event.name}」触发`,
    };
    stateManager.addLogEntry(logEntry);

    this.eventBus.emit(`event:${event.id}`, { eventId: event.id, scope: event.scope });
  }
}