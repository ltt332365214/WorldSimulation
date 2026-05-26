import { EventData, EventTrigger, EventCondition, EventEffect } from './types.js';

export class Event {
  private data: EventData;
  private cooldownRemaining: number;

  constructor(data: EventData) {
    this.data = { ...data };
    this.cooldownRemaining = 0;
  }

  get id(): string { return this.data.id; }
  get name(): string { return this.data.name; }
  get priority(): number { return this.data.priority; }
  get trigger(): EventTrigger { return this.data.trigger; }
  get effects(): EventEffect[] { return this.data.effects; }
  get scope(): string { return this.data.scope; }
  get repeatable(): boolean { return this.data.repeatable; }

  getData(): EventData {
    return { ...this.data };
  }

  isOnCooldown(): boolean {
    return this.cooldownRemaining > 0;
  }

  startCooldown(): void {
    this.cooldownRemaining = this.data.cooldown;
  }

  tickCooldown(): void {
    if (this.cooldownRemaining > 0) {
      this.cooldownRemaining--;
    }
  }

  checkConditions(worldState: import('./types.js').WorldState): boolean {
    const { logic = 'AND' } = this.trigger;

    const results = this.trigger.conditions.map(cond => this.evaluateCondition(cond, worldState));

    if (logic === 'AND') {
      return results.every(r => r);
    }
    return results.some(r => r);
  }

  private evaluateCondition(condition: EventCondition, worldState: import('./types.js').WorldState): boolean {
    const { type, params } = condition;

    switch (type) {
      case 'agent_location': {
        const agentId = params.agentId as string;
        const locationId = params.locationId as string;
        const agent = worldState.agents[agentId];
        return agent?.location === locationId;
      }
      case 'flag_set': {
        const flagName = params.flagName as string;
        const expected = params.value;
        return worldState.globalFlags[flagName] === expected;
      }
      case 'flag_not_set': {
        const flagName = params.flagName as string;
        return worldState.globalFlags[flagName] === undefined || worldState.globalFlags[flagName] === false;
      }
      case 'agents_meeting': {
        const agentA = params.agentA as string;
        const agentB = params.agentB as string;
        const a = worldState.agents[agentA];
        const b = worldState.agents[agentB];
        return a && b && a.location === b.location;
      }
      case 'time_reached': {
        const hour = params.hour as number;
        return worldState.clock.hour >= hour;
      }
      case 'relation_threshold': {
        const from = params.from as string;
        const to = params.to as string;
        const field = params.field as string; // 'favorability', 'trust', 'intimacy'
        const threshold = params.threshold as number;
        const relation = worldState.relations[from]?.[to];
        if (!relation) return false;
        return (relation[field as keyof RelationData] as number) >= threshold;
      }
      case 'agent_attribute': {
        const agentId = params.agentId as string;
        const attr = params.attribute as string;
        const threshold = params.threshold as number;
        const agent = worldState.agents[agentId];
        return agent?.attributes[attr] !== undefined && agent.attributes[attr] >= threshold;
      }
      default:
        return false;
    }
  }

  serialize(): { data: EventData; cooldownRemaining: number } {
    return { data: this.data, cooldownRemaining: this.cooldownRemaining };
  }

  static deserialize(serialized: { data: EventData; cooldownRemaining: number }): Event {
    const event = new Event(serialized.data);
    event.cooldownRemaining = serialized.cooldownRemaining;
    return event;
  }
}

type RelationData = import('./types.js').RelationData;