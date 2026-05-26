import { WorldStateManager } from './WorldState';
import { EventBus } from './EventBus';
import { TickResult, LogEntry, SceneDescription, NearbyAgent, NearbyItem, Action } from '../types';
import { describeAction, createAction } from '../models/Action';

export class TickEngine {
  private stateManager: WorldStateManager;
  private eventBus: EventBus;
  private systems: import('../systems/SystemBase').SystemBase[];

  constructor(
    stateManager: WorldStateManager,
    eventBus: EventBus,
  ) {
    this.stateManager = stateManager;
    this.eventBus = eventBus;
    this.systems = [];
  }

  registerSystem(system: import('../systems/SystemBase').SystemBase): void {
    this.systems.push(system);
  }

  initSystems(): void {
    for (const system of this.systems) {
      system.onInit(this.stateManager);
    }
  }

  tick(): TickResult {
    const clock = this.stateManager.getClock();
    const newTime = clock.tick();

    // 1. Run systems (ScheduleSystem handles NPC behavior, DayNightSystem handles time effects, etc.)
    for (const system of this.systems) {
      system.onTick(this.stateManager);
    }

    // 2. Tick agent needs (hunger, sleep, energy decay)
    for (const agent of this.stateManager.getAllAgents()) {
      if (!agent.controlled) {
        agent.tickNeeds();
      }
    }

    // 3. Build result
    const scene = this.buildSceneDescription();

    return {
      tickNumber: this.stateManager.getSnapshot().tickCount,
      clock: newTime,
      sceneDescription: scene.description,
      availableActions: this.buildAvailableActions(),
      logEntries: this.stateManager.getLog(),
    };
  }

  performPlayerAction(action: Action): TickResult {
    const playerAgent = this.stateManager.getPlayerAgent();
    if (!playerAgent) {
      throw new Error('No player agent');
    }

    // Execute the player action
    const logEntry = this.executeAction(action, playerAgent);
    if (logEntry) {
      this.stateManager.addLogEntry(logEntry);
    }

    // Tick the world forward
    return this.tick();
  }

  private executeAction(action: Action, agent: import('../models/Agent').Agent): LogEntry | null {
    const tick = this.stateManager.getSnapshot().tickCount;

    switch (action.type) {
      case 'move': {
        const target = action.target;
        if (!target) return null;
        const location = this.stateManager.getSnapshot().locations[target];
        if (!location) {
          return { tick, type: 'system', description: `无法前往该地点` };
        }
        agent.moveTo(target);
        agent.setAction(null);
        return { tick, type: 'move', description: `${agent.name}前往${location.name}`, agentId: agent.id };
      }
      case 'talk': {
        const targetName = this.stateManager.getAgent(action.target ?? '')?.name ?? '某人';
        return { tick, type: 'action', description: `${agent.name}与${targetName}交谈`, agentId: agent.id };
      }
      case 'examine': {
        const itemName = this.stateManager.getItem(action.target ?? '')?.name ?? action.target ?? '周围';
        return { tick, type: 'action', description: `${agent.name}查看${itemName}`, agentId: agent.id };
      }
      case 'use_item': {
        const itemName = this.stateManager.getItem(action.target ?? '')?.name ?? '某物';
        return { tick, type: 'action', description: `${agent.name}使用${itemName}`, agentId: agent.id };
      }
      case 'gift': {
        const targetName = this.stateManager.getAgent(action.target ?? '')?.name ?? '某人';
        return { tick, type: 'action', description: `${agent.name}向${targetName}赠送物品`, agentId: agent.id };
      }
      case 'wait': {
        return { tick, type: 'action', description: `${agent.name}静静等待`, agentId: agent.id };
      }
      case 'rest': {
        agent.setEmotion('平静');
        return { tick, type: 'action', description: `${agent.name}休息片刻`, agentId: agent.id };
      }
      case 'greet': {
        const targetAgent = this.stateManager.getAgent(action.target ?? '');
        if (targetAgent) {
          return { tick, type: 'action', description: `${agent.name}向${targetAgent.name}问候`, agentId: agent.id };
        }
        return null;
      }
      case 'eat': {
        return { tick, type: 'action', description: `${agent.name}进食`, agentId: agent.id };
      }
      case 'read': {
        return { tick, type: 'action', description: `${agent.name}读书`, agentId: agent.id };
      }
      default: {
        return { tick, type: 'action', description: describeAction(action, agent.name), agentId: agent.id };
      }
    }
  }

  private buildSceneDescription(): SceneDescription {
    const playerAgent = this.stateManager.getPlayerAgent();
    if (!playerAgent) {
      return {
        locationId: '', locationName: '', description: '',
        ambience: '', timeOfDay: '', nearbyAgents: [],
        nearbyItems: [], availableExits: [],
      };
    }

    const snapshot = this.stateManager.getSnapshot();
    const location = snapshot.locations[playerAgent.location];
    const clock = this.stateManager.getClock();

    const nearbyAgents: NearbyAgent[] = this.stateManager
      .getAgentsAtLocation(playerAgent.location)
      .filter(a => a.id !== playerAgent.id)
      .map(a => ({
        id: a.id,
        name: a.name,
        currentAction: a.getState().currentAction?.type ?? '空闲',
        currentEmotion: a.getState().currentEmotion,
      }));

    const nearbyItems: NearbyItem[] = this.stateManager
      .getItemsAtLocation(playerAgent.location)
      .map(i => ({
        id: i.id,
        name: i.name,
        interactable: i.getData().interactable,
      }));

    return {
      locationId: playerAgent.location,
      locationName: location?.name ?? '未知地点',
      description: location?.description ?? '',
      ambience: location?.ambience ?? '',
      timeOfDay: clock.getTimeOfDay(),
      nearbyAgents,
      nearbyItems,
      availableExits: location?.connections ?? [],
    };
  }

  private buildAvailableActions(): Action[] {
    const playerAgent = this.stateManager.getPlayerAgent();
    if (!playerAgent) return [];

    const snapshot = this.stateManager.getSnapshot();
    const location = snapshot.locations[playerAgent.location];
    const actions: Action[] = [];

    // Move to connected locations
    if (location?.connections) {
      for (const connId of location.connections) {
        const targetLocation = snapshot.locations[connId];
        if (targetLocation) {
          actions.push(createAction('move', connId, location.travelTime?.[connId] ?? 1, true));
        }
      }
    }

    // Talk to nearby agents
    const nearbyAgents = this.stateManager.getAgentsAtLocation(playerAgent.location);
    for (const agent of nearbyAgents) {
      if (agent.id !== playerAgent.id) {
        actions.push(createAction('talk', agent.id, 1, true));
        actions.push(createAction('greet', agent.id, 1, true));
      }
    }

    // Examine items at location
    const nearbyItems = this.stateManager.getItemsAtLocation(playerAgent.location);
    for (const item of nearbyItems) {
      actions.push(createAction('examine', item.id, 1, true));
      if (item.getData().interactable.includes('use')) {
        actions.push(createAction('use_item', item.id, 1, true));
      }
      if (item.getData().interactable.includes('gift')) {
        // Gift to nearby agents
        for (const agent of nearbyAgents) {
          if (agent.id !== playerAgent.id) {
            actions.push(createAction('gift', agent.id, 1, true));
          }
        }
      }
    }

    // Always-available actions
    actions.push(createAction('wait', undefined, 1, true));
    actions.push(createAction('examine', playerAgent.location, 1, true));

    return actions;
  }
}