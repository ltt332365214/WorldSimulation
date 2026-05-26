import { WorldStateManager } from '../core/WorldState';
import { SystemBase } from './SystemBase';
import { EventBus } from '../core/EventBus';
import { LogEntry, EventEffect, WorldState } from '../types';
import { Agent } from '../models/Agent';
import { Event } from '../models/Event';

export class EventSystem extends SystemBase {
  name = 'EventSystem';

  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    super();
    this.eventBus = eventBus;
  }

  onInit(stateManager: WorldStateManager): void {
    // Events are pre-registered on the WorldStateManager; nothing extra to init
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
      this.applyEffect(effect, stateManager, tick);
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

  private applyEffect(effect: EventEffect, stateManager: WorldStateManager, tick: number): void {
    const { type, params } = effect;

    switch (type) {
      case 'modify_attribute': {
        const agentId = params.agentId as string;
        const attribute = params.attribute as string;
        const delta = params.delta as number;
        const agent = stateManager.getAgent(agentId);
        if (agent) {
          agent.modifyAttribute(attribute, delta);
        }
        break;
      }
      case 'modify_relation': {
        const fromId = params.fromId as string;
        const toId = params.toId as string;
        const field = params.field as string;
        const delta = params.delta as number;
        const relation = stateManager.getRelation(fromId, toId);
        if (relation) {
          if (field === 'favorability') relation.modifyFavorability(delta);
          else if (field === 'trust') relation.modifyTrust(delta);
          else if (field === 'intimacy') relation.modifyIntimacy(delta);
          relation.recordEvent(`事件效果: ${field} ${delta}`, tick, field === 'favorability' ? delta : 0, field === 'trust' ? delta : 0, field === 'intimacy' ? delta : 0);
        }
        break;
      }
      case 'set_flag': {
        const flagName = params.flagName as string;
        const value = params.value;
        stateManager.setGlobalFlag(flagName, value);
        break;
      }
      case 'dialogue': {
        const dialogueId = params.dialogueId as string;
        this.eventBus.emit('dialogue_trigger', { dialogueId });
        break;
      }
      case 'move_agent': {
        const agentId = params.agentId as string;
        const locationId = params.locationId as string;
        const agent = stateManager.getAgent(agentId);
        if (agent) {
          agent.moveTo(locationId);
        }
        break;
      }
      case 'create_item': {
        const itemId = params.itemId as string;
        const locationId = params.locationId as string;
        const item = stateManager.getItem(itemId);
        if (item) {
          item.moveToLocation(locationId);
        }
        break;
      }
      case 'trigger_event': {
        const targetEventId = params.targetEventId as string;
        this.onEvent('trigger_event', { eventId: targetEventId }, stateManager);
        break;
      }
    }
  }
}