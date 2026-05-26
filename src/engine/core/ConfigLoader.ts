import { WorldConfig, AgentData, AgentTemplate, WorldMapData, LocationData, ItemData, RelationData, EventData, DialogueData, ScheduleData, SystemConfig } from '../types.js';
import { Clock } from '../models/Clock.js';
import { Agent } from '../models/Agent.js';
import { Item } from '../models/Item.js';
import { Relation } from '../models/Relation.js';
import { Event } from '../models/Event.js';
import { Dialogue } from '../models/Dialogue.js';

export interface LoadedWorld {
  config: WorldConfig;
  clock: Clock;
  agents: Map<string, Agent>;
  items: Map<string, Item>;
  relations: Map<string, Map<string, Relation>>;
  events: Event[];
  locations: Record<string, LocationData>;
  dialogues: Map<string, Dialogue>;
  schedules: Record<string, ScheduleData>;
}

export class ConfigLoader {
  private baseUrl: string;

  constructor(baseUrl: string = '/worlds') {
    this.baseUrl = baseUrl;
  }

  async loadWorld(worldId: string): Promise<LoadedWorld> {
    const worldPath = `${this.baseUrl}/${worldId}`;

    // Load world config and normalize it to match engine types
    const rawConfig = await this.fetchJson<Record<string, unknown>>(`${worldPath}/world.json`);
    const config = this.normalizeWorldConfig(rawConfig);

    // Load maps
    const worldmap = await this.fetchJson<WorldMapData>(`${worldPath}/maps/worldmap.json`);
    const locations: Record<string, LocationData> = {};
    for (const node of worldmap.nodes) {
      locations[node.id] = node;
    }

    // Load additional indoor maps
    try {
      const mapFiles = await this.fetchJson<string[]>(`${worldPath}/maps/_index.json`);
      if (mapFiles) {
        for (const file of mapFiles) {
          if (file !== 'worldmap.json' && file !== '_index.json') {
            const mapData = await this.fetchJson<WorldMapData>(`${worldPath}/maps/${file}`);
            for (const node of mapData.nodes) {
              locations[node.id] = node;
            }
          }
        }
      }
    } catch {
      // No index file, try to load known maps
    }

    // Load agent template and normalize it
    let template: AgentTemplate | null = null;
    try {
      const rawTemplate = await this.fetchJson<Record<string, unknown>>(`${worldPath}/agents/_template.json`);
      template = this.normalizeAgentTemplate(rawTemplate);
    } catch {
      // No template
    }

    // Load agents
    const agentFiles = await this.fetchJson<string[]>(`${worldPath}/agents/_index.json`);
    const agents = new Map<string, Agent>();
    for (const file of agentFiles ?? []) {
      if (!file.startsWith('_')) {
        const agentData = await this.fetchJson<AgentData>(`${worldPath}/agents/${file}`);
        if (template && agentData.extends) {
          agentData.attributes = { ...template.defaults.attributes, ...agentData.attributes };
          agentData.personality = { ...template.defaults.personality, ...agentData.personality };
        }
        agents.set(agentData.id, new Agent(agentData));
      }
    }

    // Load items
    const items = new Map<string, Item>();
    try {
      const itemFiles = await this.fetchJson<string[]>(`${worldPath}/items/_index.json`);
      for (const file of itemFiles ?? []) {
        if (!file.startsWith('_')) {
          const itemArray = await this.fetchJson<ItemData[]>(`${worldPath}/items/${file}`);
          for (const itemData of itemArray) {
            const location = locations[itemData.id]?.id ?? null;
            items.set(itemData.id, new Item(itemData, location));
          }
        }
      }
    } catch {
      // No items
    }

    // Load relations
    const relations = new Map<string, Map<string, Relation>>();
    try {
      const relationFiles = await this.fetchJson<string[]>(`${worldPath}/relations/_index.json`);
      for (const file of relationFiles ?? []) {
        const relationArray = await this.fetchJson<RelationData[]>(`${worldPath}/relations/${file}`);
        for (const rData of relationArray) {
          if (!relations.has(rData.from)) {
            relations.set(rData.from, new Map());
          }
          relations.get(rData.from)?.set(rData.to, new Relation(rData));
        }
      }
    } catch {
      // No relations
    }

    // Load events
    const events: Event[] = [];
    try {
      const eventFiles = await this.fetchJson<string[]>(`${worldPath}/events/_index.json`);
      for (const file of eventFiles ?? []) {
        const eventArray = await this.fetchJson<EventData[]>(`${worldPath}/events/${file}`);
        for (const eData of eventArray) {
          events.push(new Event(eData));
        }
      }
    } catch {
      // No events
    }

    // Load dialogues
    const dialogues = new Map<string, Dialogue>();
    try {
      const dialogueFiles = await this.fetchJson<string[]>(`${worldPath}/dialogues/_index.json`);
      for (const file of dialogueFiles ?? []) {
        const dialogueData = await this.fetchJson<DialogueData>(`${worldPath}/dialogues/${file}`);
        dialogues.set(dialogueData.id, new Dialogue(dialogueData));
      }
    } catch {
      // No dialogues
    }

    // Load schedules
    const schedules: Record<string, ScheduleData> = {};
    try {
      const scheduleFiles = await this.fetchJson<string[]>(`${worldPath}/schedules/_index.json`);
      for (const file of scheduleFiles ?? []) {
        const schedule = await this.fetchJson<ScheduleData>(`${worldPath}/schedules/${file}`);
        schedules[schedule.id] = schedule;
      }
    } catch {
      // No schedules
    }

    // Create clock
    const clock = new Clock(config.initialTime, config.calendar, config.tickSize);

    return {
      config,
      clock,
      agents,
      items,
      relations,
      events,
      locations,
      dialogues,
      schedules,
    };
  }

  async listWorlds(): Promise<WorldConfig[]> {
    const index = await this.fetchJson<{ id: string; displayName: string; description: string }[]>(`${this.baseUrl}/_index.json`);
    const worlds: WorldConfig[] = [];
    for (const entry of index) {
      try {
        const config = await this.fetchJson<WorldConfig>(`${this.baseUrl}/${entry.id}/world.json`);
        worlds.push(config);
      } catch {
        // Skip broken worlds
      }
    }
    return worlds;
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }
}