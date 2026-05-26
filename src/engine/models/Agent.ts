import { AgentState, AgentData, Action, AgentMemory, MemoryEntry, ImpressionRecord } from '../types.js';

export class Agent {
  private state: AgentState;
  private scheduleRef: string | null;
  private defaultLocation: string;

  constructor(data: AgentData, controlled: boolean = false) {
    this.scheduleRef = data.scheduleRef ?? null;
    this.defaultLocation = data.defaultLocation;

    this.state = {
      id: data.id,
      name: data.name,
      gender: data.gender,
      location: data.defaultLocation,
      attributes: { ...data.attributes },
      personality: { ...data.personality },
      currentEmotion: '平静',
      currentAction: null,
      currentIntent: '',
      hunger: 20,
      sleepValue: 80,
      energy: 80,
      health: 80,
      inventory: [],
      memory: {
        shortTerm: [],
        keyMemories: [],
        impressions: {},
      },
      controlled,
    };
  }

  get id(): string { return this.state.id; }
  get name(): string { return this.state.name; }
  get location(): string { return this.state.location; }
  get controlled(): boolean { return this.state.controlled; }

  getState(): AgentState {
    return { ...this.state };
  }

  setState(state: AgentState): void {
    this.state = { ...state };
  }

  moveTo(locationId: string): void {
    this.state.location = locationId;
  }

  setAction(action: Action | null): void {
    this.state.currentAction = action;
  }

  setEmotion(emotion: string): void {
    this.state.currentEmotion = emotion;
  }

  addMemory(entry: MemoryEntry): void {
    this.state.memory.shortTerm.push(entry);
    // Keep short-term memory bounded
    if (this.state.memory.shortTerm.length > 50) {
      this.state.memory.shortTerm = this.state.memory.shortTerm.slice(-50);
    }
    if (entry.importance >= 70) {
      this.state.memory.keyMemories.push(entry);
    }
  }

  updateImpression(agentId: string, summary: string, tick: number): void {
    this.state.memory.impressions[agentId] = {
      agentId,
      summary,
      lastUpdatedTick: tick,
    };
  }

  addInventoryItem(itemId: string): void {
    this.state.inventory.push(itemId);
  }

  removeInventoryItem(itemId: string): void {
    this.state.inventory = this.state.inventory.filter(id => id !== itemId);
  }

  modifyAttribute(key: string, delta: number): void {
    if (this.state.attributes[key] !== undefined) {
      this.state.attributes[key] += delta;
    }
  }

  tickNeeds(): void {
    // Natural decay per tick
    this.state.hunger = Math.min(100, this.state.hunger + 1);
    this.state.sleepValue = Math.max(0, this.state.sleepValue - 0.5);
    this.state.energy = Math.max(0, Math.min(100, this.state.energy - 0.3));
  }

  getScheduleRef(): string | null {
    return this.scheduleRef;
  }

  serialize(): AgentState {
    return { ...this.state };
  }

  static deserialize(state: AgentState): Agent {
    const agent = new Agent({
      id: state.id,
      name: state.name,
      gender: state.gender,
      birthdate: { year: 0, month: 1, day: 1, hour: 0, minute: 0 },
      attributes: state.attributes,
      personality: state.personality,
      defaultLocation: state.location,
    }, state.controlled);
    agent.state = { ...state };
    return agent;
  }
}