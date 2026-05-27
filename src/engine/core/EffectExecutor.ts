import { WorldStateManager } from './WorldState';
import { EventBus } from './EventBus';
import { EventEffect } from '../types';

export class EffectExecutor {
  private stateManager: WorldStateManager;
  private eventBus: EventBus;

  constructor(stateManager: WorldStateManager, eventBus: EventBus) {
    this.stateManager = stateManager;
    this.eventBus = eventBus;
  }

  execute(effect: EventEffect, tick: number): void {
    const { type, params } = effect;

    switch (type) {
      case 'modify_attribute': {
        const agentId = params.agentId as string;
        const attribute = params.attribute as string;
        const delta = params.delta as number;
        const agent = this.stateManager.getAgent(agentId);
        if (agent) {
          // Check both attributes and personality for the key
          const state = agent.getState();
          if (state.attributes[attribute] !== undefined) {
            agent.modifyAttribute(attribute, delta);
          } else if (state.personality[attribute] !== undefined) {
            // Personality traits are modifiable via the same interface
            agent.modifyAttribute(attribute, delta);
          }
        }
        break;
      }
      case 'modify_relation': {
        const fromId = (params.fromId ?? params.from) as string;
        const toId = (params.toId ?? params.to) as string;
        const field = params.field as string;
        const delta = params.delta as number;
        const relation = this.stateManager.getRelation(fromId, toId);
        if (relation) {
          if (field === 'favorability' || field === '好感度') relation.modifyFavorability(delta);
          else if (field === 'trust' || field === '信任度') relation.modifyTrust(delta);
          else if (field === 'intimacy' || field === '亲密度') relation.modifyIntimacy(delta);
          relation.recordEvent(`效果: ${field} ${delta}`, tick, field === 'favorability' ? delta : 0, field === 'trust' ? delta : 0, field === 'intimacy' ? delta : 0);
        }
        break;
      }
      case 'set_flag': {
        const flagName = params.flagName as string;
        const value = params.value;
        this.stateManager.setGlobalFlag(flagName, value);
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
        const agent = this.stateManager.getAgent(agentId);
        if (agent) {
          agent.moveTo(locationId);
        }
        break;
      }
      case 'create_item': {
        const itemId = params.itemId as string;
        const locationId = params.locationId as string;
        const item = this.stateManager.getItem(itemId);
        if (item) {
          item.moveToLocation(locationId);
        }
        break;
      }
      case 'trigger_event': {
        const targetEventId = (params.targetEventId ?? params.eventId) as string;
        this.eventBus.emit('trigger_event', { eventId: targetEventId });
        break;
      }
    }
  }
}