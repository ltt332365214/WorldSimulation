import { WorldState as WorldStateType, AgentState, LocationData, ItemData, RelationData, TimeData } from '../types';
import { Clock } from '../models/Clock';
import { Agent } from '../models/Agent';
import { Item } from '../models/Item';
import { Relation } from '../models/Relation';
import { Event } from '../models/Event';
import { Dialogue } from '../models/Dialogue';

export class WorldStateManager {
  private state: WorldStateType;
  private clock: Clock;
  private agents: Map<string, Agent>;
  private items: Map<string, Item>;
  private relations: Map<string, Map<string, Relation>>; // fromId → toId → Relation
  private events: Event[];
  private dialogues: Map<string, Dialogue>;
  private log: import('../types').LogEntry[];
  private logIdCounter: number;

  constructor() {
    this.agents = new Map();
    this.items = new Map();
    this.relations = new Map();
    this.events = [];
    this.dialogues = new Map();
    this.log = [];
    this.logIdCounter = 0;
    this.clock = new Clock(
      { year: 1, month: 1, day: 1, hour: 6, minute: 0 },
      {
        months: [{ name: '一月', days: 30 }],
        seasons: [{ name: '春', startMonth: 1, endMonth: 3 }],
        festivals: [],
        timeUnits: ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'],
      },
      15,
    );
    this.state = this.buildState();
  }

  init(
    worldId: string,
    clock: Clock,
    agents: Map<string, Agent>,
    items: Map<string, Item>,
    relations: Map<string, Map<string, Relation>>,
    events: Event[],
    locations: Record<string, LocationData>,
    dialogues: Map<string, Dialogue>,
    playerAgentId: string,
  ): void {
    this.clock = clock;
    this.agents = agents;
    this.items = items;
    this.relations = relations;
    this.events = events;
    this.dialogues = dialogues;
    this.state = this.buildState();
    this.state.worldId = worldId;
    this.state.playerAgentId = playerAgentId;
    this.state.locations = locations;
  }

  getClock(): Clock {
    return this.clock;
  }

  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  getItem(id: string): Item | undefined {
    return this.items.get(id);
  }

  getRelation(fromId: string, toId: string): Relation | undefined {
    return this.relations.get(fromId)?.get(toId);
  }

  setRelation(fromId: string, toId: string, relation: Relation): void {
    if (!this.relations.has(fromId)) {
      this.relations.set(fromId, new Map());
    }
    this.relations.get(fromId)?.set(toId, relation);
  }

  getEvents(): Event[] {
    return this.events;
  }

  getDialogue(id: string): Dialogue | undefined {
    return this.dialogues.get(id);
  }

  addDialogue(id: string, dialogue: Dialogue): void {
    this.dialogues.set(id, dialogue);
  }

  addLogEntry(entry: import('../types').LogEntry): void {
    entry.id = this.logIdCounter++;
    this.log.push(entry);
    // Keep log bounded
    if (this.log.length > 200) {
      this.log = this.log.slice(-200);
    }
  }

  getLog(): import('../types').LogEntry[] {
    return [...this.log];
  }

  getPlayerAgentId(): string {
    return this.state.playerAgentId;
  }

  getPlayerAgent(): Agent | undefined {
    return this.agents.get(this.state.playerAgentId);
  }

  getAgentsAtLocation(locationId: string): Agent[] {
    return this.getAllAgents().filter(a => a.location === locationId);
  }

  getItemsAtLocation(locationId: string): Item[] {
    return Array.from(this.items.values()).filter(
      i => i.getLocation() === locationId && i.getOwner() === null,
    );
  }

  setGlobalFlag(key: string, value: unknown): void {
    this.state.globalFlags[key] = value;
  }

  getGlobalFlag(key: string): unknown {
    return this.state.globalFlags[key];
  }

  private buildState(): WorldStateType {
    const agentsState: Record<string, AgentState> = {};
    for (const [id, agent] of this.agents) {
      agentsState[id] = agent.getState();
    }

    const relationsState: Record<string, Record<string, RelationData>> = {};
    for (const [fromId, toMap] of this.relations) {
      relationsState[fromId] = {};
      for (const [toId, relation] of toMap) {
        relationsState[fromId][toId] = relation.getData();
      }
    }

    const itemsState: Record<string, ItemData> = {};
    for (const [id, item] of this.items) {
      itemsState[id] = item.getData();
    }

    return {
      worldId: '',
      clock: this.clock.getTime(),
      tickCount: 0,
      agents: agentsState,
      locations: {},
      items: itemsState,
      relations: relationsState,
      globalFlags: {},
      playerAgentId: '',
      eventCooldowns: {},
    };
  }

  advanceTick(): void {
    this.state.tickCount++;
  }

  // Build a snapshot for UI consumption
  getSnapshot(): WorldStateType {
    this.state.clock = this.clock.getTime();

    // Update agent states in snapshot
    for (const [id, agent] of this.agents) {
      this.state.agents[id] = agent.getState();
    }

    // Update relations in snapshot
    for (const [fromId, toMap] of this.relations) {
      this.state.relations[fromId] = {};
      for (const [toId, relation] of toMap) {
        this.state.relations[fromId][toId] = relation.getData();
      }
    }

    return { ...this.state };
  }

  // Full serialization for save/load
  serialize(): import('../types').SaveData {
    const agentStates: Record<string, AgentState> = {};
    for (const [id, agent] of this.agents) {
      agentStates[id] = agent.getState();
    }

    const itemData: Record<string, { data: ItemData; location: string | null; owner: string | null }> = {};
    for (const [id, item] of this.items) {
      itemData[id] = item.serialize();
    }

    const relationData: Record<string, Record<string, RelationData>> = {};
    for (const [fromId, toMap] of this.relations) {
      relationData[fromId] = {};
      for (const [toId, relation] of toMap) {
        relationData[fromId][toId] = relation.serialize();
      }
    }

    const eventData: Record<string, { data: import('../types').EventData; cooldownRemaining: number }> = {};
    for (const event of this.events) {
      eventData[event.id] = event.serialize();
    }

    return {
      version: '1.0.0',
      worldId: this.state.worldId,
      worldState: {
        ...this.state,
        agents: agentStates,
        clock: this.clock.getTime(),
      },
      savedAt: new Date().toISOString(),
    };
  }
}