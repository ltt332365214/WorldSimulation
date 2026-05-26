import { ItemData } from '../types';

export class Item {
  private data: ItemData;
  private location: string | null; // null means in someone's inventory
  private owner: string | null;

  constructor(data: ItemData, location?: string, owner?: string) {
    this.data = { ...data };
    this.location = location ?? null;
    this.owner = owner ?? null;
  }

  get id(): string { return this.data.id; }
  get name(): string { return this.data.name; }
  get type(): string { return this.data.type; }

  getData(): ItemData {
    return { ...this.data };
  }

  getLocation(): string | null { return this.location; }
  getOwner(): string | null { return this.owner; }

  moveToLocation(locationId: string): void {
    this.location = locationId;
    this.owner = null;
  }

  giveToAgent(agentId: string): void {
    this.owner = agentId;
    this.location = null;
  }

  serialize(): { data: ItemData; location: string | null; owner: string | null } {
    return { data: this.data, location: this.location, owner: this.owner };
  }

  static deserialize(serialized: { data: ItemData; location: string | null; owner: string | null }): Item {
    return new Item(serialized.data, serialized.location ?? undefined, serialized.owner ?? undefined);
  }
}