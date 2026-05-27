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
} from './types';
import { WorldStateManager } from './core/WorldState';
import { ConfigLoader } from './core/ConfigLoader';
import { TickEngine } from './core/TickEngine';
import { EventBus } from './core/EventBus';
import { ScheduleSystem } from './systems/ScheduleSystem';
import { DayNightSystem } from './systems/DayNightSystem';
import { EventSystem } from './systems/EventSystem';
import { InteractionSystem } from './systems/InteractionSystem';
import { Clock } from './models/Clock';
import { Agent } from './models/Agent';
import { Item } from './models/Item';
import { Relation } from './models/Relation';
import { Event } from './models/Event';
import { Dialogue } from './models/Dialogue';
import { EffectExecutor } from './core/EffectExecutor';

export class Engine {
  private stateManager: WorldStateManager;
  private configLoader: ConfigLoader;
  private tickEngine!: TickEngine;
  private effectExecutor!: EffectExecutor;
  private eventBus: EventBus;
  private schedules: Record<string, ScheduleData>;
  private config: WorldConfig | null;
  private initialized: boolean;

  constructor() {
    this.stateManager = new WorldStateManager();
    this.configLoader = new ConfigLoader();
    this.eventBus = new EventBus();
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
        description: playerState.description,
        birthdate: playerState.birthdate ?? { year: 0, month: 1, day: 1, hour: 0, minute: 0 },
        attributes: playerState.attributes,
        personality: playerState.personality,
        defaultLocation: playerState.location,
        scheduleRef: playerAgent.getScheduleRef() ?? undefined,
      },
      true, // controlled
    );
    // Preserve the full state including birthdate, inventory, memory, etc.
    controlledPlayer.setState(playerState);
    controlledPlayer.setControlled(true);
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

    // 5. Create TickEngine
    this.tickEngine = new TickEngine(this.stateManager, this.eventBus);
    this.effectExecutor = new EffectExecutor(this.stateManager, this.eventBus);

    // 6. Register dialogue_trigger event listener
    this.eventBus.on('dialogue_trigger', (_event: string, data: unknown) => {
      if (!data || typeof (data as Record<string, unknown>).dialogueId !== 'string') return;
      const { dialogueId } = data as { dialogueId: string };
      if (this.initialized && !this.activeDialogueId) {
        this.startDialogue(dialogueId);
      }
    });

    // 7. Register systems and load schedules
    const scheduleSystem = new ScheduleSystem();
    for (const schedule of Object.values(loaded.schedules)) {
      scheduleSystem.loadSchedule(schedule);
    }
    this.tickEngine.registerSystem(scheduleSystem);
    this.tickEngine.registerSystem(new DayNightSystem());
    this.tickEngine.registerSystem(new EventSystem(this.eventBus));
    this.tickEngine.registerSystem(new InteractionSystem(this.eventBus));
    this.tickEngine.initSystems();

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
    return this.tickEngine.buildSceneDescriptionPublic();
  }

  getAvailableActions(): Action[] {
    if (!this.initialized) {
      throw new Error('Engine not initialized. Call init() first.');
    }
    return this.tickEngine.buildAvailableActionsPublic();
  }

  getWorldId(): string {
    if (!this.initialized) return '';
    return this.stateManager.getSnapshot().worldId;
  }

  getWorldState(): WorldState {
    return this.getSnapshot();
  }

  loadWorldState(state: WorldState): void {
    this.importSave(JSON.stringify({ version: '1.0.0', worldId: state.worldId, worldState: state, savedAt: new Date().toISOString(), playerAgentId: state.playerAgentId, schedules: this.schedules }));
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
      const tick = this.stateManager.getSnapshot().tickCount;
      for (const effect of choice.effects) {
        this.effectExecutor.execute(effect, tick);
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

  getActiveDialogueId(): string | null {
    return this.activeDialogueId;
  }

  getActiveDialogueData(): { data: DialogueData; currentLine: DialogueLine | null; choices: import('./types').DialogueChoice[] } | null {
    if (!this.activeDialogueId) return null;
    const dialogue = this.stateManager.getDialogue(this.activeDialogueId);
    if (!dialogue) return null;
    return {
      data: dialogue.getData(),
      currentLine: dialogue.getCurrentLine(),
      choices: dialogue.getChoices(),
    };
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
      agents.set(id, Agent.deserialize(agentState as import('./types').AgentState));
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
        items.set(id, new Item(itemData as import('./types').ItemData));
      }
    }

    // Rebuild relations
    const relations = new Map<string, Map<string, Relation>>();
    for (const [fromId, toMap] of Object.entries(raw.worldState?.relations ?? {})) {
      const inner = new Map<string, Relation>();
      for (const [toId, relData] of Object.entries(toMap as Record<string, import('./types').RelationData>)) {
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
    const clockTime = raw.worldState?.clock as import('./types').TimeData;
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
    this.tickEngine = new TickEngine(this.stateManager, this.eventBus);
    const scheduleSystem = new ScheduleSystem();
    for (const schedule of Object.values(this.schedules)) {
      scheduleSystem.loadSchedule(schedule);
    }
    this.tickEngine.registerSystem(scheduleSystem);
    this.tickEngine.registerSystem(new DayNightSystem());
    this.tickEngine.registerSystem(new EventSystem(this.eventBus));
    this.tickEngine.registerSystem(new InteractionSystem(this.eventBus));
    this.tickEngine.initSystems();

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