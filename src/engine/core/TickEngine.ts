import { WorldStateManager } from './WorldState.js';
import { EventBus } from './EventBus.js';
import { TickResult, LogEntry, SceneDescription, NearbyAgent, NearbyItem, Action, ActionType } from '../types.js';
import { ScheduleData } from '../types.js';
import { describeAction, createAction } from '../models/Action.js';

export class TickEngine {
  private stateManager: WorldStateManager;
  private eventBus: EventBus;
  private schedules: Record<string, ScheduleData>;
  private systems: import('../systems/SystemBase.js').SystemBase[];

  constructor(
    stateManager: WorldStateManager,
    eventBus: EventBus,
    schedules: Record<string, ScheduleData>,
  ) {
    this.stateManager = stateManager;
    this.eventBus = eventBus;
    this.schedules = schedules;
    this.systems = [];
  }

  registerSystem(system: import('../systems/SystemBase.js').SystemBase): void {
    this.systems.push(system);
  }

  tick(): TickResult {
    const clock = this.stateManager.getClock();
    const newTime = clock.tick();
    const tickCount = this.stateManager.getSnapshot().tickCount;

    // 1. Run systems
    for (const system of this.systems) {
      system.onTick(this.stateManager);
    }

    // 2. Process NPC actions (schedule-driven)
    this.processNPCActions(newTime);

    // 3. Check events
    this.checkEvents();

    // 4. Tick agent needs
    for (const agent of this.stateManager.getAllAgents()) {
      if (!agent.controlled) {
        agent.tickNeeds();
      }
    }

    // 5. Build result
    const log = this.stateManager.getLog();
    const playerAgent = this.stateManager.getPlayerAgent();
    const scene = this.buildSceneDescription();

    return {
      tickNumber: tickCount,
      clock: newTime,
      sceneDescription: scene.description,
      availableActions: this.buildAvailableActions(),
      logEntries: log,
    };
  }

  performPlayerAction(action: Action): TickResult {
    const playerAgent = this.stateManager.getPlayerAgent();
    if (!playerAgent) {
      throw new Error('No player agent');
    }

    // Execute the action immediately
    const logEntry = this.executeAction(action, playerAgent);
    if (logEntry) {
      this.stateManager.addLogEntry(logEntry);
    }

    // Then tick the world forward
    return this.tick();
  }

  private executeAction(action: Action, agent: import('../models/Agent.js').Agent): LogEntry | null {
    switch (action.type) {
      case 'move': {
        const target = action.target;
        if (!target) return null;
        const location = this.stateManager.getSnapshot().locations[target];
        if (!location) {
          return { tick: this.stateManager.getSnapshot().tickCount, type: 'system', description: `无法前往${target}，该地点不存在` };
        }
        agent.moveTo(target);
        return { tick: this.stateManager.getSnapshot().tickCount, type: 'move', description: `${agent.name}前往${location.name}`, agentId: agent.id };
      }
      case 'talk': {
        return { tick: this.stateManager.getSnapshot().tickCount, type: 'action', description: `${agent.name}与${action.target ?? '某人'}交谈`, agentId: agent.id };
      }
      case 'examine': {
        return { tick: this.stateManager.getSnapshot().tickCount, type: 'action', description: `${agent.name}查看${action.target ?? '周围'}`, agentId: agent.id };
      }
      case 'wait': {
        return { tick: this.stateManager.getSnapshot().tickCount, type: 'action', description: `${agent.name}静静等待`, agentId: agent.id };
      }
      case 'rest': {
        agent.setEmotion('平静');
        return { tick: this.stateManager.getSnapshot().tickCount, type: 'action', description: `${agent.name}休息片刻`, agentId: agent.id };
      }
      case 'greet': {
        const targetAgent = this.stateManager.getAgent(action.target ?? '');
        if (targetAgent) {
          return { tick: this.stateManager.getSnapshot().tickCount, type: 'action', description: `${agent.name}向${targetAgent.name}问候`, agentId: agent.id };
        }
        return null;
      }
      default: {
        return { tick: this.stateManager.getSnapshot().tickCount, type: 'action', description: describeAction(action, agent.name), agentId: agent.id };
      }
    }
  }

  private processNPCActions(time: import('../types.js').TimeData): void {
    for (const agent of this.stateManager.getAllAgents()) {
      if (agent.controlled) continue;

      const scheduleRef = agent.getState().attributes?.scheduleRef;
      if (!scheduleRef) continue;

      const schedule = this.schedules[scheduleRef];
      if (!schedule) continue;

      // Find matching schedule entry for current time
      const entry = schedule.entries.find(e => e.hour === time.hour && e.minute === time.minute);
      if (!entry) continue;

      const action = createAction(
        entry.action as ActionType,
        entry.target,
        1,
        true,
      );

      const logEntry = this.executeAction(action, agent);
      if (logEntry) {
        this.stateManager.addLogEntry(logEntry);
      }
    }
  }

  private checkEvents(): void {
    const snapshot = this.stateManager.getSnapshot();
    for (const event of this.stateManager.getEvents()) {
      event.tickCooldown();
      if (event.isOnCooldown()) continue;
      if (!event.repeatable && this.stateManager.getGlobalFlag(`event_${event.id}_triggered`)) continue;

      if (event.checkConditions(snapshot)) {
        this.triggerEvent(event);
      }
    }
  }

  private triggerEvent(event: import('../models/Event.js').Event): void {
    event.startCooldown();
    this.stateManager.setGlobalFlag(`event_${event.id}_triggered`, true);

    for (const effect of event.effects) {
      this.executeEffect(effect);
    }

    this.stateManager.addLogEntry({
      tick: this.stateManager.getSnapshot().tickCount,
      type: 'event',
      description: `事件触发：${event.name}`,
    });

    this.eventBus.emit('event_triggered', { eventId: event.id, name: event.name });
  }

  private executeEffect(effect: import('../types.js').EventEffect): void {
    switch (effect.type) {
      case 'modify_attribute': {
        const agentId = effect.params.agentId as string;
        const attr = effect.params.attribute as string;
        const delta = effect.params.delta as number;
        const agent = this.stateManager.getAgent(agentId);
        if (agent) {
          agent.modifyAttribute(attr, delta);
        }
        break;
      }
      case 'modify_relation': {
        const from = effect.params.from as string;
        const to = effect.params.to as string;
        const field = effect.params.field as string;
        const delta = effect.params.delta as number;
        const relation = this.stateManager.getRelation(from, to);
        if (relation) {
          if (field === 'favorability') relation.modifyFavorability(delta);
          if (field === 'trust') relation.modifyTrust(delta);
          if (field === 'intimacy') relation.modifyIntimacy(delta);
        }
        break;
      }
      case 'set_flag': {
        const flagName = effect.params.flagName as string;
        const value = effect.params.value;
        this.stateManager.setGlobalFlag(flagName, value);
        break;
      }
      case 'move_agent': {
        const agentId = effect.params.agentId as string;
        const locationId = effect.params.locationId as string;
        const agent = this.stateManager.getAgent(agentId);
        if (agent) {
          agent.moveTo(locationId);
        }
        break;
      }
      case 'dialogue': {
        const dialogueId = effect.params.dialogueId as string;
        this.eventBus.emit('dialogue_triggered', { dialogueId });
        break;
      }
    }
  }

  private buildSceneDescription(): SceneDescription {
    const playerAgent = this.stateManager.getPlayerAgent();
    if (!playerAgent) {
      return {
        locationId: '',
        locationName: '',
        description: '',
        ambience: '',
        timeOfDay: '',
        nearbyAgents: [],
        nearbyItems: [],
        availableExits: [],
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

    // Examine items
    const nearbyItems = this.stateManager.getItemsAtLocation(playerAgent.location);
    for (const item of nearbyItems) {
      actions.push(createAction('examine', item.id, 1, true));
    }

    // Always-available actions
    actions.push(createAction('wait', undefined, 1, true));
    actions.push(createAction('examine', playerAgent.location, 1, true)); // examine surroundings

    return actions;
  }
}