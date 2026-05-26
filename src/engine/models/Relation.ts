import { RelationData, RelationEventRecord } from './types.js';

export class Relation {
  private data: RelationData;

  constructor(data: RelationData) {
    this.data = { ...data, history: data.history ?? [] };
  }

  get from(): string { return this.data.from; }
  get to(): string { return this.data.to; }
  get favorability(): number { return this.data.favorability; }
  get trust(): number { return this.data.trust; }
  get intimacy(): number { return this.data.intimacy; }
  get tags(): string[] { return [...this.data.tags]; }

  getData(): RelationData {
    return { ...this.data };
  }

  modifyFavorability(delta: number): void {
    this.data.favorability = Math.max(-100, Math.min(100, this.data.favorability + delta));
  }

  modifyTrust(delta: number): void {
    this.data.trust = Math.max(0, Math.min(100, this.data.trust + delta));
  }

  modifyIntimacy(delta: number): void {
    this.data.intimacy = Math.max(0, Math.min(100, this.data.intimacy + delta));
  }

  addTag(tag: string): void {
    if (!this.data.tags.includes(tag)) {
      this.data.tags.push(tag);
    }
  }

  removeTag(tag: string): void {
    this.data.tags = this.data.tags.filter(t => t !== tag);
  }

  recordEvent(description: string, tick: number, favorabilityDelta: number, trustDelta: number, intimacyDelta: number): void {
    this.data.history?.push({
      tick,
      description,
      favorabilityDelta,
      trustDelta,
      intimacyDelta,
    });
  }

  decayIntimacy(amount: number): void {
    // Long-term no interaction decay
    this.data.intimacy = Math.max(0, this.data.intimacy - amount);
  }

  serialize(): RelationData {
    return { ...this.data };
  }

  static deserialize(data: RelationData): Relation {
    return new Relation(data);
  }
}