import { WorldConfig, AgentData, AgentTemplate, WorldMapData, LocationData, ItemData, RelationData, EventData, DialogueData, ScheduleData, SystemConfig, CalendarConfig, TimeData } from '../types.js';
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

  private normalizeWorldConfig(raw: Record<string, unknown>): WorldConfig {
    const calendar = this.normalizeCalendarConfig(raw.calendar as Record<string, unknown> | undefined);
    const initialTime = this.normalizeInitialTime(raw.initialTime as Record<string, unknown> | undefined);
    return {
      id: raw.id as string,
      displayName: raw.displayName as string ?? '',
      description: raw.description as string ?? '',
      tickSize: raw.tickSize as number ?? 15,
      calendar,
      timeMode: (raw.timeMode as string ?? 'turn-based') as 'turn-based' | 'realtime-pause',
      initialTime,
      systems: raw.systems as string[] ?? [],
    };
  }

  private normalizeCalendarConfig(raw?: Record<string, unknown>): CalendarConfig {
    if (!raw) {
      return {
        months: [{ name: '一月', days: 30 }],
        seasons: [],
        festivals: [],
        timeUnits: [],
      };
    }

    // Normalize months: support both array format and { months: number, monthNames: string[] } format
    let months: { name: string; days: number }[];
    const rawMonths = raw.months;
    if (Array.isArray(rawMonths)) {
      months = rawMonths as { name: string; days: number }[];
    } else if (typeof rawMonths === 'number' && Array.isArray(raw.monthNames)) {
      months = (raw.monthNames as string[]).map((name: string) => ({ name, days: 30 }));
    } else {
      months = [{ name: '一月', days: 30 }];
    }

    // Normalize seasons: support both { startMonth, endMonth } and { months: number[] } formats
    const seasons: { name: string; startMonth: number; endMonth: number }[] = [];
    if (Array.isArray(raw.seasons)) {
      for (const s of raw.seasons as Record<string, unknown>[]) {
        if (s.startMonth !== undefined && s.endMonth !== undefined) {
          seasons.push({ name: s.name as string, startMonth: s.startMonth as number, endMonth: s.endMonth as number });
        } else if (Array.isArray(s.months)) {
          const monthArr = s.months as number[];
          seasons.push({ name: s.name as string, startMonth: monthArr[0], endMonth: monthArr[monthArr.length - 1] });
        }
      }
    }

    // Normalize festivals
    const festivals: { name: string; month: number; day: number }[] = [];
    if (Array.isArray(raw.festivals)) {
      for (const f of raw.festivals as Record<string, unknown>[]) {
        festivals.push({ name: f.name as string, month: f.month as number, day: f.day as number });
      }
    }

    // Normalize timeUnits: support both string[] and { names: string[] } formats
    let timeUnits: string[];
    const rawTimeUnits = raw.timeUnits;
    if (Array.isArray(rawTimeUnits)) {
      timeUnits = rawTimeUnits as string[];
    } else if (rawTimeUnits && typeof rawTimeUnits === 'object') {
      const tuObj = rawTimeUnits as Record<string, unknown>;
      timeUnits = Array.isArray(tuObj.names) ? tuObj.names as string[] : [];
    } else {
      timeUnits = [];
    }

    return { months, seasons, festivals, timeUnits };
  }

  private normalizeInitialTime(raw?: Record<string, unknown>): TimeData {
    if (!raw) return { year: 1, month: 1, day: 1, hour: 6, minute: 0 };
    return {
      year: raw.year as number ?? 1,
      month: raw.month as number ?? 1,
      day: raw.day as number ?? 1,
      hour: raw.hour as number ?? 6,
      minute: raw.minute as number ?? 0,
    };
  }

  private normalizeAgentTemplate(raw?: Record<string, unknown>): AgentTemplate | null {
    if (!raw) return null;

    // Transform from { "体质": { description, min, max, default } } format
    // to { "体质": 5 } defaults format expected by engine
    const defaultAttrs: Record<string, number> = {};
    const rawAttrs = raw.attributes as Record<string, unknown> | undefined;
    if (rawAttrs) {
      for (const [key, val] of Object.entries(rawAttrs)) {
        defaultAttrs[key] = typeof val === 'object' && val !== null
          ? (val as Record<string, unknown>).default as number ?? 5
          : val as number;
      }
    }

    const defaultPersonality: Record<string, number> = {};
    const rawPersonality = raw.personality as Record<string, unknown> | undefined;
    if (rawPersonality) {
      for (const [key, val] of Object.entries(rawPersonality)) {
        defaultPersonality[key] = typeof val === 'object' && val !== null
          ? (val as Record<string, unknown>).default as number ?? 5
          : val as number;
      }
    }

    return {
      fields: {
        attributes: Object.keys(rawAttrs ?? {}),
        personality: Object.keys(rawPersonality ?? {}),
      },
      defaults: {
        attributes: defaultAttrs,
        personality: defaultPersonality,
      },
    };
  }
}