import {
  WorldConfig,
  WorldState,
  Action,
  TickResult,
  SceneDescription,
  LogEntry,
  DialogueData,
  DialogueLine,
  ScheduleData,
  SaveData,
  EventData,
} from './types.js';
import { WorldStateManager } from './core/WorldState.js';
import { ConfigLoader } from './core/ConfigLoader.js';
import { TickEngine } from './core/TickEngine.js';
import { EventBus } from './core/EventBus.js';
import { ScheduleSystem } from './systems/ScheduleSystem.js';
import { DayNightSystem } from './systems/DayNightSystem.js';
import { EventSystem } from './systems/EventSystem.js';
import { InteractionSystem } from './systems/InteractionSystem.js';
import { Clock } from './models/Clock.js';
import { Agent } from './models/Agent.js';
import { Item } from './models/Item.js';
import { Relation } from './models/Relation.js';
import { Event } from './models/Event.js';
import { Dialogue } from './models/Dialogue.js';

export class Engine {
  private stateManager: WorldStateManager;
  private configLoader: ConfigLoader;
  private tickEngine: TickEngine;
  private eventBus: EventBus;
  private schedules: Record<string, ScheduleData>;
  private config: WorldConfig | null;
  private initialized: boolean;

  constructor() {
    this.stateManager = new WorldStateManager();
    this.configLoader = new ConfigLoader();
    this.tickEngine = new TickEngine(this.stateManager, this.eventBus = new EventBus(), {});
    this.schedules = {};
    this.config = null;
    this.initialized = false;
  }

  // Initialize: load world config, set player agent
  async init(worldId: string, playerId: string): Promise<void> {
    // 1. Load world data via ConfigLoader
    const loaded = await this.configLoader.loadWorld(worldId);

    // 2. Set the player agent (mark as controlled=true)
    const playerAgent = loaded.agents.get(playerId);
    if (!playerAgent) {
      throw new Error(`Player agent '${playerId}' not found in world '${worldId}'`);
    }
    // Replace the player agent instance with a controlled version
    const playerState = playerAgent.getState();
    const controlledPlayer = new Agent(
      {
        id: playerState.id,
        name: playerState.name,
        gender: playerState.gender,
        birthdate: { year: 0, month: 1, day: 1, hour: 0, minute: 0 }, // placeholder; real birthdate is in loaded data
        attributes: playerState.attributes,
        personality: playerState.personality,
        defaultLocation: playerState.location,
        scheduleRef: playerAgent.getScheduleRef(),
      },
      true, // controlled
    );
    // Preserve the full state including birthdate, inventory, memory, etc.
    controlledPlayer.setState(playerState);
    loaded.agents.set(playerId, controlledPlayer);

    // 3. Initialize WorldStateManager with all loaded data
    this.stateManager.init(
      worldId,
      loaded.clock,
      loaded.agents,
      loaded.items,
      loaded.relations,
      loaded.events,
      loaded.locations,
      loaded.dialogues,
      playerId,
    );

    // 4. Store config and schedules
    this.config = loaded.config;
    this.schedules = loaded.schedules;

    // 5. Create TickEngine with schedules
    this.tickEngine = new TickEngine(this.stateManager, this.eventBus, this.schedules);

    // 6. Register systems
    this.tickEngine.registerSystem(new ScheduleSystem());
    this.tickEngine.registerSystem(new DayNightSystem());
    this.tickEngine.registerSystem(new EventSystem());
    this.tickEngine.registerSystem(new InteractionSystem());

    // 7. Mark initialized
    this.initialized = true;

    // Emit initialization event
    this.eventBus.emit('engine_initialized', { worldId, playerId });
  }

  // Game operations
  performAction(action: Action): TickResult {
    if (!this.initialized) {
      throw new Error('Engine not initialized. Call init() first.');
    }
    return this.tickEngine.performPlayerAction(action);
  }

  tick(): TickResult {
    if (!this.initialized) {
      throw new Error('Engine not initialized. Call init() first.');
    }
    return this.tickEngine.tick();
  }

  // Queries
  getSnapshot(): WorldState {
    if (!this.initialized) {
      throw new Error('Engine not initialized. Call init() first.');
    }
    return this.stateManager.getSnapshot();
  }

  getSceneDescription(): SceneDescription {
    if (!this.initialized) {
      throw new Error('Engine not initialized. Call init() first.');
    }
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

    const nearbyAgents = this.stateManager
      .getAgentsAtLocation(playerAgent.location)
      .filter(a => a.id !== playerAgent.id)
      .map(a => ({
        id: a.id,
        name: a.name,
        currentAction: a.getState().currentAction?.type ?? '空闲',
        currentEmotion: a.getState().currentEmotion,
      }));

    const nearbyItems = this.stateManager
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

  getAvailableActions(): Action[] {
    if (!this.initialized) {
      throw new Error('Engine not initialized. Call init() first.');
    }
    // Rebuild available actions from the current state without advancing time.
    // This mirrors the logic in TickEngine.buildAvailableActions() but runs
    // as a read-only query so no tick occurs.
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
          actions.push({
            id: `action_move_${connId}`,
            type: 'move',
            target: connId,
            duration: location.travelTime?.[connId] ?? 1,
            elapsed: 0,
            interruptible: true,
          });
        }
      }
    }

    // Talk to nearby agents
    const nearbyAgents = this.stateManager.getAgentsAtLocation(playerAgent.location);
    for (const agent of nearbyAgents) {
      if (agent.id !== playerAgent.id) {
        actions.push({
          id: `action_talk_${agent.id}`,
          type: 'talk',
          target: agent.id,
          duration: 1,
          elapsed: 0,
          interruptible: true,
        });
        actions.push({
          id: `action_greet_${agent.id}`,
          type: 'greet',
          target: agent.id,
          duration: 1,
          elapsed: 0,
          interruptible: true,
        });
      }
    }

    // Examine items
    const nearbyItems = this.stateManager.getItemsAtLocation(playerAgent.location);
    for (const item of nearbyItems) {
      actions.push({
        id: `action_examine_${item.id}`,
        type: 'examine',
        target: item.id,
        duration: 1,
        elapsed: 0,
        interruptible: true,
      });
    }

    // Always-available actions
    actions.push({
      id: 'action_wait',
      type: 'wait',
      target: undefined,
      duration: 1,
      elapsed: 0,
      interruptible: true,
    });
    actions.push({
      id: `action_examine_${playerAgent.location}`,
      type: 'examine',
      target: playerAgent.location,
      duration: 1,
      elapsed: 0,
      interruptible: true,
    });

    return actions;
  }

  getLog(): LogEntry[] {
    if (!this.initialized) {
      throw new Error('Engine not initialized. Call init() first.');
    }
    return this.stateManager.getLog();
  }

  // Dialogue
  private activeDialogueId: string | null = null;

  startDialogue(dialogueId: string): DialogueData | null {
    if (!this.initialized) {
      throw new Error('Engine not initialized. Call init() first.');
    }
    const dialogue = this.stateManager.getDialogue(dialogueId);
    if (!dialogue) return null;

    this.activeDialogueId = dialogueId;

    // Reset dialogue to the beginning
    const data = dialogue.getData();
    const freshDialogue = new Dialogue(data);
    this.stateManager.addDialogue(dialogueId, freshDialogue);

    // Track for save serialization
    this.trackedDialogueIds.set(dialogueId, freshDialogue);

    this.eventBus.emit('dialogue_started', { dialogueId });
    return data;
  }

  makeDialogueChoice(choiceIndex: number): DialogueLine | null {
    if (!this.initialized || !this.activeDialogueId) return null;

    const dialogue = this.stateManager.getDialogue(this.activeDialogueId);
    if (!dialogue) return null;

    const choices = dialogue.getChoices();
    if (choiceIndex < 0 || choiceIndex >= choices.length) return null;

    const choice = choices[choiceIndex];
    // Track this dialogue for save serialization
    this.trackedDialogueIds.set(this.activeDialogueId, dialogue);

    // Execute choice effects if present
    if (choice.effects) {
      for (const effect of choice.effects) {
        this.executeDialogueEffect(effect);
      }
    }

    const nextLine = dialogue.selectChoice(choice);
    if (dialogue.isFinished()) {
      const finishedId = this.activeDialogueId;
      this.activeDialogueId = null;
      this.eventBus.emit('dialogue_finished', { dialogueId: finishedId });
    }

    return nextLine;
  }

  advanceDialogue(): DialogueLine | null {
    if (!this.initialized || !this.activeDialogueId) return null;

    const dialogue = this.stateManager.getDialogue(this.activeDialogueId);
    if (!dialogue) return null;

    // Track for save serialization
    this.trackedDialogueIds.set(this.activeDialogueId, dialogue);

    const nextLine = dialogue.advance();
    if (dialogue.isFinished()) {
      const finishedId = this.activeDialogueId;
      this.activeDialogueId = null;
      this.eventBus.emit('dialogue_finished', { dialogueId: finishedId });
    }

    return nextLine;
  }

  isDialogueActive(): boolean {
    return this.activeDialogueId !== null;
  }

  private executeDialogueEffect(effect: import('./types.js').EventEffect): void {
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

  // Save/load
  exportSave(): string {
    if (!this.initialized) {
      throw new Error('Engine not initialized. Call init() first.');
    }
    const saveData = this.stateManager.serialize();

    // Augment with additional engine-level data not covered by WorldStateManager.serialize()
    const augmented: SaveData & {
      playerAgentId: string;
      schedules: Record<string, ScheduleData>;
      dialogueStates: Record<string, { data: DialogueData; currentLineIndex: number }>;
      eventCooldowns: Record<string, { data: EventData; cooldownRemaining: number }>;
    } = {
      ...saveData,
      playerAgentId: this.stateManager.getPlayerAgentId(),
      schedules: this.schedules,
      dialogueStates: {},
      eventCooldowns: {},
    };

    // Serialize dialogue states
    // We need to iterate all dialogues; WorldStateManager doesn't expose a direct way,
    // so we serialize from the internal dialogues Map via getDialogue for known IDs
    // from the loaded world data. We reconstruct the list from config if available.
    // For now, serialize all dialogues we can access by iterating loaded dialogue IDs
    // stored during init. We capture these in a private field.

    // Serialize event cooldowns
    for (const event of this.stateManager.getEvents()) {
      augmented.eventCooldowns[event.id] = event.serialize();
    }

    // Serialize dialogue states for the active dialogue and any previously tracked ones
    if (this.activeDialogueId) {
      const dialogue = this.stateManager.getDialogue(this.activeDialogueId);
      if (dialogue) {
        augmented.dialogueStates[this.activeDialogueId] = dialogue.serialize();
      }
    }
    for (const [id, dialogue] of this.trackedDialogueIds) {
      const d = this.stateManager.getDialogue(id);
      if (d) {
        augmented.dialogueStates[id] = d.serialize();
      }
    }

    return JSON.stringify(augmented);
  }

  importSave(json: string): void {
    if (!this.initialized) {
      throw new Error('Engine not initialized. Call init() first.');
    }

    const raw = JSON.parse(json);

    const playerAgentId: string = raw.playerAgentId ?? raw.worldState?.playerAgentId ?? '';
    const schedules: Record<string, ScheduleData> = raw.schedules ?? {};

    // Rebuild agents
    const agents = new Map<string, Agent>();
    for (const [id, agentState] of Object.entries(raw.worldState?.agents ?? {})) {
      agents.set(id, Agent.deserialize(agentState as import('./types.js').AgentState));
    }

    // Rebuild items
    const items = new Map<string, Item>();
    // Items are serialized with location/owner info in WorldStateManager
    // but the SaveData structure stores them as ItemData in worldState.items.
    // We need to reconstruct location/owner; for simplicity, items without
    // explicit location data are placed at their default location or null.
    for (const [id, itemData] of Object.entries(raw.worldState?.items ?? {})) {
      const itemEntry = raw.items?.[id]; // check for extended serialization
      if (itemEntry?.data && itemEntry?.location !== undefined) {
        items.set(id, Item.deserialize(itemEntry));
      } else {
        items.set(id, new Item(itemData as import('./types.js').ItemData));
      }
    }

    // Rebuild relations
    const relations = new Map<string, Map<string, Relation>>();
    for (const [fromId, toMap] of Object.entries(raw.worldState?.relations ?? {})) {
      const inner = new Map<string, Relation>();
      for (const [toId, relData] of Object.entries(toMap as Record<string, import('./types.js').RelationData>)) {
        inner.set(toId, Relation.deserialize(relData));
      }
      relations.set(fromId, inner);
    }

    // Rebuild events with cooldown state
    const events: Event[] = [];
    for (const [eventId, cooldownData] of Object.entries(raw.eventCooldowns ?? {})) {
      const entry = cooldownData as { data: EventData; cooldownRemaining: number };
      const event = Event.deserialize(entry);
      events.push(event);
    }

    // Rebuild dialogues with state
    const dialogues = new Map<string, Dialogue>();
    for (const [id, dialogueState] of Object.entries(raw.dialogueStates ?? {})) {
      const entry = dialogueState as { data: DialogueData; currentLineIndex: number };
      dialogues.set(id, Dialogue.deserialize(entry));
    }

    // Rebuild clock
    const clockTime = raw.worldState?.clock as import('./types.js').TimeData;
    const clock = new Clock(clockTime, this.config!.calendar, this.config!.tickSize);

    // Reinitialize WorldStateManager
    this.stateManager.init(
      raw.worldId ?? raw.worldState?.worldId ?? '',
      clock,
      agents,
      items,
      relations,
      events,
      raw.worldState?.locations ?? {},
      dialogues,
      playerAgentId,
    );

    // Restore schedules
    this.schedules = schedules;

    // Recreate TickEngine
    this.tickEngine = new TickEngine(this.stateManager, this.eventBus, this.schedules);
    this.tickEngine.registerSystem(new ScheduleSystem());
    this.tickEngine.registerSystem(new DayNightSystem());
    this.tickEngine.registerSystem(new EventSystem());
    this.tickEngine.registerSystem(new InteractionSystem());

    // Restore active dialogue state
    this.activeDialogueId = raw.activeDialogueId ?? null;

    // Emit restore event
    this.eventBus.emit('save_loaded', { worldId: raw.worldId });
  }

  // Event subscription
  onStateChange(callback: (snapshot: WorldState) => void): void {
    this.eventBus.on('state_changed', (event: string, data: unknown) => {
      callback(data as WorldState);
    });
  }

  onEvent(callback: (event: string, data: unknown) => void): void {
    this.eventBus.on('*', callback);
  }

  // Track dialogue IDs that have been interacted with, for save serialization
  private trackedDialogueIds: Map<string, Dialogue> = new Map();
}