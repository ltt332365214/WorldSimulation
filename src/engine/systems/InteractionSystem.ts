import { WorldStateManager } from '../core/WorldState.js';
import { SystemBase } from './SystemBase.js';
import { EventBus } from '../core/EventBus.js';
import { Action, ActionType, ActionRequirement, LogEntry, DialogueData } from '../types.js';
import { Agent } from '../models/Agent.js';
import { Item } from '../models/Item.js';
import { createAction, isActionComplete, describeAction } from '../models/Action.js';
import { Dialogue } from '../models/Dialogue.js';

export class InteractionSystem extends SystemBase {
  name = 'InteractionSystem';

  private eventBus: EventBus;
  private activeDialogues: Map<string, Dialogue>;

  constructor(eventBus: EventBus) {
    super();
    this.eventBus = eventBus;
    this.activeDialogues = new Map();
  }

  onInit(stateManager: WorldStateManager): void {
    this.eventBus.on('dialogue_trigger', (_event, data) => {
      const { dialogueId } = data as { dialogueId: string };
      this.initiateDialogue(dialogueId, stateManager);
    });
  }

  onTick(stateManager: WorldStateManager): void {
    // Advance all active player actions
    const player = stateManager.getPlayerAgent();
    if (!player) return;

    const state = player.getState();
    if (state.currentAction) {
      if (isActionComplete(state.currentAction)) {
        this.completeAction(player, state.currentAction, stateManager);
        player.setAction(null);
      } else {
        player.setAction({ ...state.currentAction, elapsed: state.currentAction.elapsed + 1 });
      }
    }
  }

  onEvent(event: string, data: unknown, stateManager: WorldStateManager): void {
    switch (event) {
      case 'player_action':
        this.handlePlayerAction(data as Action, stateManager);
        break;
      case 'dialogue_choice':
        this.handleDialogueChoice(data as { dialogueId: string; choiceIndex: number }, stateManager);
        break;
    }
  }

  initiateDialogue(dialogueId: string, stateManager: WorldStateManager): void {
    const dialogueData = stateManager.getDialogue(dialogueId);
    if (!dialogueData) return;

    const dialogue = Dialogue.deserialize({ data: dialogueData.getData(), currentLineIndex: 0 });
    this.activeDialogues.set(dialogueId, dialogue);

    const player = stateManager.getPlayerAgent();
    if (player) {
      const action = createAction('talk', dialogueId, 1, true);
      player.setAction(action);
    }

    const tick = stateManager.getSnapshot().tickCount;
    const logEntry: LogEntry = {
      tick,
      type: 'dialogue',
      description: `对话「${dialogueId}」开始`,
      agentId: player?.id,
    };
    stateManager.addLogEntry(logEntry);

    this.eventBus.emit('dialogue_started', { dialogueId, participants: dialogue.participants });
  }

  handleDialogueChoice(choiceData: { dialogueId: string; choiceIndex: number }, stateManager: WorldStateManager): void {
    const dialogue = this.activeDialogues.get(choiceData.dialogueId);
    if (!dialogue) return;

    const choices = dialogue.getChoices();
    const choice = choices[choiceData.choiceIndex];
    if (!choice) return;

    const nextLine = dialogue.selectChoice(choice);

    if (choice.effects) {
      const tick = stateManager.getSnapshot().tickCount;
      for (const effect of choice.effects) {
        this.applyDialogueEffect(effect, stateManager, tick);
      }
    }

    if (dialogue.isFinished() || !nextLine) {
      this.endDialogue(choiceData.dialogueId, stateManager);
    } else {
      this.eventBus.emit('dialogue_line', {
        dialogueId: choiceData.dialogueId,
        line: nextLine,
      });
    }
  }

  private handlePlayerAction(action: Action, stateManager: WorldStateManager): void {
    const player = stateManager.getPlayerAgent();
    if (!player) return;

    if (!this.validateAction(action, player, stateManager)) {
      this.eventBus.emit('action_invalid', { actionId: action.id, agentId: player.id });
      return;
    }

    player.setAction(action);
    const tick = stateManager.getSnapshot().tickCount;
    const description = describeAction(action, player.name);
    const logEntry: LogEntry = {
      tick,
      type: 'action',
      description,
      agentId: player.id,
    };
    stateManager.addLogEntry(logEntry);

    this.eventBus.emit('action_started', { actionId: action.id, agentId: player.id, type: action.type });
  }

  private validateAction(action: Action, agent: Agent, stateManager: WorldStateManager): boolean {
    if (!action.requirements) return true;

    for (const req of action.requirements) {
      if (!this.checkRequirement(req, agent, stateManager)) return false;
    }
    return true;
  }

  private checkRequirement(req: ActionRequirement, agent: Agent, stateManager: WorldStateManager): boolean {
    const { type, params } = req;
    const agentState = agent.getState();

    switch (type) {
      case 'at_location':
        return agentState.location === (params.locationId as string);
      case 'has_item':
        return agentState.inventory.includes(params.itemId as string);
      case 'agent_present': {
        const agentsAtLoc = stateManager.getAgentsAtLocation(agentState.location);
        return agentsAtLoc.some(a => a.id === (params.agentId as string));
      }
      case 'attribute_threshold':
        return (agentState.attributes[params.attribute as string] ?? 0) >= (params.threshold as number);
      case 'energy_min':
        return agentState.energy >= (params.minEnergy as number);
      default:
        return true;
    }
  }

  private completeAction(agent: Agent, action: Action, stateManager: WorldStateManager): void {
    const tick = stateManager.getSnapshot().tickCount;

    switch (action.type) {
      case 'move':
        if (action.target) {
          agent.moveTo(action.target);
          const moveLog: LogEntry = {
            tick,
            type: 'move',
            description: `${agent.name}到达了${action.target}`,
            agentId: agent.id,
          };
          stateManager.addLogEntry(moveLog);
        }
        break;
      case 'examine': {
        const item = action.target ? stateManager.getItem(action.target) : undefined;
        if (item) {
          const itemData = item.getData();
          agent.addMemory({
            tick,
            description: `查看了${itemData.name}: ${itemData.description}`,
            importance: 10,
          });
        }
        break;
      }
      case 'use_item': {
        const item = action.target ? stateManager.getItem(action.target) : undefined;
        if (item && action.effects) {
          for (const effect of action.effects) {
            this.applyItemEffect(effect, agent, stateManager, tick);
          }
        }
        break;
      }
      case 'gift': {
        const targetAgentId = action.target;
        if (targetAgentId) {
          const targetAgent = stateManager.getAgent(targetAgentId);
          const relation = stateManager.getRelation(agent.id, targetAgentId);
          if (relation) {
            relation.modifyFavorability(5);
            relation.modifyIntimacy(3);
            relation.recordEvent(`${agent.name}赠予礼物`, tick, 5, 0, 3);
          }
          if (targetAgent) {
            targetAgent.addMemory({
              tick,
              description: `收到${agent.name}的礼物`,
              importance: 40,
            });
          }
        }
        break;
      }
      case 'greet': {
        const targetAgentId = action.target;
        if (targetAgentId) {
          const relation = stateManager.getRelation(agent.id, targetAgentId);
          if (relation) {
            relation.modifyFavorability(1);
            relation.recordEvent(`${agent.name}向对方问候`, tick, 1, 0, 0);
          }
        }
        break;
      }
    }

    if (action.effects) {
      for (const effect of action.effects) {
        this.applyItemEffect(effect, agent, stateManager, tick);
      }
    }

    this.eventBus.emit('action_completed', { actionId: action.id, agentId: agent.id, type: action.type });
  }

  private applyItemEffect(effect: import('../types.js').ActionEffect, agent: Agent, stateManager: WorldStateManager, tick: number): void {
    const { type, params } = effect;

    switch (type) {
      case 'modify_attribute':
        agent.modifyAttribute(params.attribute as string, params.delta as number);
        break;
      case 'modify_energy':
        agent.setState({
          ...agent.getState(),
          energy: Math.min(100, Math.max(0, agent.getState().energy + (params.delta as number))),
        });
        break;
      case 'modify_hunger':
        agent.setState({
          ...agent.getState(),
          hunger: Math.min(100, Math.max(0, agent.getState().hunger + (params.delta as number))),
        });
        break;
      case 'add_item':
        agent.addInventoryItem(params.itemId as string);
        break;
      case 'remove_item':
        agent.removeInventoryItem(params.itemId as string);
        break;
      case 'trigger_event':
        this.eventBus.emit('trigger_event', { eventId: params.eventId as string });
        break;
    }
  }

  private applyDialogueEffect(effect: import('../types.js').EventEffect, stateManager: WorldStateManager, tick: number): void {
    const { type, params } = effect;

    switch (type) {
      case 'modify_relation': {
        const fromId = params.fromId as string;
        const toId = params.toId as string;
        const relation = stateManager.getRelation(fromId, toId);
        if (relation) {
          const field = params.field as string;
          const delta = params.delta as number;
          if (field === 'favorability') relation.modifyFavorability(delta);
          else if (field === 'trust') relation.modifyTrust(delta);
          else if (field === 'intimacy') relation.modifyIntimacy(delta);
        }
        break;
      }
      case 'modify_attribute': {
        const agentId = params.agentId as string;
        const agent = stateManager.getAgent(agentId);
        if (agent) {
          agent.modifyAttribute(params.attribute as string, params.delta as number);
        }
        break;
      }
      case 'set_flag':
        stateManager.setGlobalFlag(params.flagName as string, params.value);
        break;
      case 'trigger_event':
        this.eventBus.emit('trigger_event', { eventId: params.targetEventId as string });
        break;
    }
  }

  private endDialogue(dialogueId: string, stateManager: WorldStateManager): void {
    this.activeDialogues.delete(dialogueId);

    const player = stateManager.getPlayerAgent();
    if (player) {
      player.setAction(null);
    }

    const tick = stateManager.getSnapshot().tickCount;
    const logEntry: LogEntry = {
      tick,
      type: 'dialogue',
      description: `对话「${dialogueId}」结束`,
      agentId: player?.id,
    };
    stateManager.addLogEntry(logEntry);

    this.eventBus.emit('dialogue_ended', { dialogueId });
  }
}