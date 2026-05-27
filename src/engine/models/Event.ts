import { EventData, EventTrigger, EventCondition, EventEffect } from '../types';

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

  checkConditions(worldState: import('../types').WorldState): boolean {
    const { logic = 'AND' } = this.trigger;

    const results = this.trigger.conditions.map(cond => this.evaluateCondition(cond, worldState));

    if (logic === 'AND') {
      return results.every(r => r);
    }
    return results.some(r => r);
  }

  private evaluateCondition(condition: EventCondition, worldState: import('../types').WorldState): boolean {
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
      case 'time_in_range': {
        const hourRange = params.hourRange as number[];
        const hour = worldState.clock.hour;
        if (!Array.isArray(hourRange) || hourRange.length < 2) return false;
        return hour >= hourRange[0] && hour < hourRange[1];
      }
      case 'season': {
        const seasonName = params.season as string;
        const month = worldState.clock.month;
        const seasons = worldState.seasons;
        const match = seasons.find(s => s.name === seasonName);
        if (!match) return false;
        return month >= match.startMonth && month <= match.endMonth;
      }
      case 'month': {
        const expectedMonth = params.month as number;
        return worldState.clock.month === expectedMonth;
      }
      case 'relation_threshold': {
        const from = params.from as string;
        const to = params.to as string;
        const field = params.field as string;
        const threshold = params.threshold as number;
        const relation = worldState.relations[from]?.[to];
        if (!relation) return false;
        const numericFields: Record<string, number | undefined> = {
          favorability: relation.favorability,
          trust: relation.trust,
          intimacy: relation.intimacy,
        };
        const value = numericFields[field];
        if (value === undefined) return false;
        return value >= threshold;
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

type RelationData = import('../types').RelationData;