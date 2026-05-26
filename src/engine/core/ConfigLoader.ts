import { WorldConfig, AgentData, AgentTemplate, WorldMapData, LocationData, ItemData, RelationData, EventData, DialogueData, DialogueLine, DialogueChoice, ScheduleData, SystemConfig, CalendarConfig, TimeData, EventTrigger, EventCondition, EventEffect } from '../types';
import { Clock } from '../models/Clock';
import { Agent } from '../models/Agent';
import { Item } from '../models/Item';
import { Relation } from '../models/Relation';
import { Event } from '../models/Event';
import { Dialogue } from '../models/Dialogue';

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

    // Load maps - handle both "nodes" and "locations" field names
    const worldmapRaw = await this.fetchJson<Record<string, unknown>>(`${worldPath}/maps/worldmap.json`);
    const locations: Record<string, LocationData> = {};
    const worldmapNodes = this.extractMapNodes(worldmapRaw);
    for (const node of worldmapNodes) {
      locations[node.id as string] = this.normalizeLocationData(node);
    }

    // Load additional indoor maps
    try {
      const mapFiles = await this.fetchJson<string[]>(`${worldPath}/maps/_index.json`);
      if (mapFiles) {
        for (const file of mapFiles) {
          if (file !== 'worldmap.json' && file !== '_index.json') {
            const mapRaw = await this.fetchJson<Record<string, unknown>>(`${worldPath}/maps/${file}`);
            const indoorNodes = this.extractMapNodes(mapRaw);
            for (const node of indoorNodes) {
              locations[node.id as string] = this.normalizeLocationData(node);
            }
          }
        }
      }
    } catch {
      // No index file, skip
    }

    // Load agent template and normalize it
    let template: AgentTemplate | null = null;
    try {
      const rawTemplate = await this.fetchJson<Record<string, unknown>>(`${worldPath}/agents/_template.json`);
      template = this.normalizeAgentTemplate(rawTemplate);
    } catch {
      // No template
    }

    // Load agents - normalize birthdate and apply template defaults
    const agentFiles = await this.fetchJson<string[]>(`${worldPath}/agents/_index.json`);
    const agents = new Map<string, Agent>();
    for (const file of agentFiles ?? []) {
      if (!file.startsWith('_')) {
        const rawAgentData = await this.fetchJson<Record<string, unknown>>(`${worldPath}/agents/${file}`);
        const agentData = this.normalizeAgentData(rawAgentData, template);
        agents.set(agentData.id, new Agent(agentData));
      }
    }

    // Build item-location mapping from location data
    const itemLocationMap: Record<string, string> = {};
    for (const [locId, loc] of Object.entries(locations)) {
      if (loc.items) {
        for (const itemId of loc.items) {
          itemLocationMap[itemId] = locId;
        }
      }
    }

    // Load items - normalize from JSON format
    const items = new Map<string, Item>();
    try {
      const itemFiles = await this.fetchJson<string[]>(`${worldPath}/items/_index.json`);
      for (const file of itemFiles ?? []) {
        if (!file.startsWith('_')) {
          const rawItemArray = await this.fetchJson<Record<string, unknown>[]>(`${worldPath}/items/${file}`);
          for (const rawItem of rawItemArray) {
            const itemData = this.normalizeItemData(rawItem);
            const itemLocation = itemLocationMap[itemData.id] ?? null;
            items.set(itemData.id, new Item(itemData, itemLocation ?? undefined));
          }
        }
      }
    } catch {
      // No items
    }

    // Load relations - normalize from JSON format
    const relations = new Map<string, Map<string, Relation>>();
    try {
      const relationFiles = await this.fetchJson<string[]>(`${worldPath}/relations/_index.json`);
      for (const file of relationFiles ?? []) {
        const rawRelationArray = await this.fetchJson<Record<string, unknown>[]>(`${worldPath}/relations/${file}`);
        for (const rawRel of rawRelationArray) {
          const rData = this.normalizeRelationData(rawRel);
          if (!relations.has(rData.from)) {
            relations.set(rData.from, new Map());
          }
          relations.get(rData.from)?.set(rData.to, new Relation(rData));
        }
      }
    } catch {
      // No relations
    }

    // Load events - normalize from JSON format
    const events: Event[] = [];
    try {
      const eventFiles = await this.fetchJson<string[]>(`${worldPath}/events/_index.json`);
      for (const file of eventFiles ?? []) {
        const rawEventArray = await this.fetchJson<Record<string, unknown>[]>(`${worldPath}/events/${file}`);
        for (const rawEvent of rawEventArray) {
          const eData = this.normalizeEventData(rawEvent);
          events.push(new Event(eData));
        }
      }
    } catch {
      // No events
    }

    // Load dialogues - normalize from tree structure
    const dialogues = new Map<string, Dialogue>();
    try {
      const dialogueFiles = await this.fetchJson<string[]>(`${worldPath}/dialogues/_index.json`);
      for (const file of dialogueFiles ?? []) {
        const rawDialogue = await this.fetchJson<Record<string, unknown>>(`${worldPath}/dialogues/${file}`);
        const dialogueData = this.normalizeDialogueData(rawDialogue);
        dialogues.set(dialogueData.id, new Dialogue(dialogueData));
      }
    } catch {
      // No dialogues
    }

    // Load schedules - normalize entries
    const schedules: Record<string, ScheduleData> = {};
    try {
      const scheduleFiles = await this.fetchJson<string[]>(`${worldPath}/schedules/_index.json`);
      for (const file of scheduleFiles ?? []) {
        const rawSchedule = await this.fetchJson<Record<string, unknown>>(`${worldPath}/schedules/${file}`);
        const schedule = this.normalizeScheduleData(rawSchedule);
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
        const rawConfig = await this.fetchJson<Record<string, unknown>>(`${this.baseUrl}/${entry.id}/world.json`);
        worlds.push(this.normalizeWorldConfig(rawConfig));
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

  // ============================================================
  // Normalization methods
  // ============================================================

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

  private normalizeAgentData(raw: Record<string, unknown>, template: AgentTemplate | null): AgentData {
    // Merge template defaults with agent-specific values
    let attributes = (raw.attributes as Record<string, number>) ?? {};
    let personality = (raw.personality as Record<string, number>) ?? {};

    if (template && raw.extends) {
      attributes = { ...template.defaults.attributes, ...attributes };
      personality = { ...template.defaults.personality, ...personality };
    }

    // Normalize birthdate - default hour and minute to 0 if missing
    const rawBirthdate = raw.birthdate as Record<string, unknown> | undefined;
    let birthdate: TimeData;
    if (rawBirthdate) {
      birthdate = {
        year: rawBirthdate.year as number ?? 0,
        month: rawBirthdate.month as number ?? 1,
        day: rawBirthdate.day as number ?? 1,
        hour: rawBirthdate.hour as number ?? 0,
        minute: rawBirthdate.minute as number ?? 0,
      };
    } else {
      birthdate = { year: 0, month: 1, day: 1, hour: 0, minute: 0 };
    }

    return {
      id: raw.id as string,
      name: raw.name as string,
      gender: raw.gender as string ?? '未知',
      description: raw.description as string ?? '',
      birthdate,
      faction: raw.faction as string | undefined,
      extends: raw.extends as string | undefined,
      attributes,
      personality,
      scheduleRef: raw.scheduleRef as string | undefined,
      skills: raw.skills as Record<string, number> | undefined,
      defaultLocation: raw.defaultLocation as string,
    };
  }

  // Extract map nodes from JSON - supports both "nodes" and "locations" field names
  private extractMapNodes(mapRaw: Record<string, unknown>): Record<string, unknown>[] {
    // Try "nodes" first (matches WorldMapData type), then "locations" (JSON format)
    const nodes = mapRaw.nodes ?? mapRaw.locations;
    if (Array.isArray(nodes)) {
      return nodes as Record<string, unknown>[];
    }
    return [];
  }

  // Normalize LocationData from JSON
  private normalizeLocationData(raw: Record<string, unknown>): LocationData {
    // Handle owner: null -> undefined (type expects string | undefined)
    let owner: string | undefined;
    if (raw.owner !== undefined && raw.owner !== null) {
      owner = raw.owner as string;
    }

    return {
      id: raw.id as string,
      name: raw.name as string,
      description: raw.description as string ?? '',
      type: raw.type as 'region' | 'indoor' | 'outdoor' ?? 'outdoor',
      connections: (raw.connections as string[]) ?? [],
      travelTime: raw.travelTime as Record<string, number> | undefined,
      items: (raw.items as string[]) ?? undefined,
      ambience: raw.ambience as string | undefined,
      owner,
    };
  }

  // Normalize ItemData from JSON format
  // JSON items have: id, name, category, description, portable, effects, rarity, ownerRef
  // Engine ItemData expects: id, name, description, type, properties, interactable, value
  private normalizeItemData(raw: Record<string, unknown>): ItemData {
    // Determine interactable actions from item properties
    const portable = raw.portable as boolean ?? true;
    const effects = raw.effects as Record<string, unknown>[] ?? [];
    const category = raw.category as string ?? raw.type as string ?? 'misc';

    const interactable: string[] = ['examine'];
    if (portable) {
      interactable.push('pickup');
    }
    // Add 'use' if effects reference eating/drinking/using
    if (category === 'food' || effects.some(e => (e.condition as string)?.includes('食') || (e.condition as string)?.includes('饮') || (e.condition as string)?.includes('服'))) {
      interactable.push('use');
    }
    // Add 'gift' for portable food or common items
    if (portable && (category === 'food' || (raw.rarity as string) === 'common')) {
      interactable.push('gift');
    }

    // Build properties from extra fields
    const properties: Record<string, unknown> = {};
    if (raw.effects) properties.effects = raw.effects;
    if (raw.rarity) properties.rarity = raw.rarity;
    if (raw.portable !== undefined) properties.portable = raw.portable;
    if (raw.ownerRef) properties.ownerRef = raw.ownerRef;

    return {
      id: raw.id as string,
      name: raw.name as string,
      description: raw.description as string ?? '',
      type: category,
      properties,
      interactable,
      value: raw.value as number | undefined ?? (raw.rarity === 'rare' ? 50 : 10),
    };
  }

  // Normalize RelationData from JSON format
  // JSON relations have: id, from, to, type, subtype, description, affection, trust, loyalty, conflict
  // Engine RelationData expects: from, to, favorability, trust, intimacy, tags
  private normalizeRelationData(raw: Record<string, unknown>): RelationData {
    const tags: string[] = [];
    const rawType = raw.type as string | undefined;
    const rawSubtype = raw.subtype as string | undefined;
    if (rawType) tags.push(rawType);
    if (rawSubtype) tags.push(rawSubtype);

    return {
      from: raw.from as string,
      to: raw.to as string,
      favorability: (raw.affection as number) ?? (raw.favorability as number) ?? 50,
      trust: (raw.trust as number) ?? 50,
      intimacy: (raw.loyalty as number) ?? (raw.intimacy as number) ?? (raw.conflict !== undefined ? 100 - (raw.conflict as number) : 50),
      tags,
    };
  }

  // Normalize EventData from JSON format
  // JSON events have: id, name, type, priority, conditions[], actions[], cooldown, repeatable
  // Engine EventData expects: id, name, trigger (EventTrigger), priority, repeatable, cooldown, effects (EventEffect[]), scope
  private normalizeEventData(raw: Record<string, unknown>): EventData {
    // Convert conditions array to EventTrigger
    const rawConditions = (raw.conditions as Record<string, unknown>[]) ?? [];
    const triggerConditions: EventCondition[] = rawConditions.map(c => {
      const rawType = c.type as string;
      const params: Record<string, unknown> = {};
      // Map JSON condition types to engine condition types that Event.evaluateCondition handles
      let engineType: string;
      switch (rawType) {
        case 'location':
          engineType = 'agent_location';
          params.agentId = c.agent as string;
          params.locationId = c.location as string;
          break;
        case 'flag':
          // If value is false or undefined, use flag_not_set; otherwise flag_set
          if (c.value === false || c.value === undefined) {
            engineType = 'flag_not_set';
            params.flagName = c.name as string;
          } else {
            engineType = 'flag_set';
            params.flagName = c.name as string;
            params.value = c.value;
          }
          break;
        case 'time':
          engineType = 'time_reached';
          // hourRange [6, 8] means current hour >= 6
          const hourRange = c.hourRange as number[];
          params.hour = hourRange?.[0] ?? 0;
          break;
        case 'season':
          engineType = 'season';
          params.season = c.season as string;
          break;
        case 'month':
          engineType = 'month';
          params.month = c.month as number;
          break;
        case 'event-triggered':
          engineType = 'flag_set';
          params.flagName = `event_fired_${c.eventRef as string}`;
          params.value = true;
          break;
        default:
          engineType = rawType;
          Object.assign(params, c);
          delete params.type;
          break;
      }
      return { type: engineType, params };
    });

    const trigger: EventTrigger = {
      type: 'composite',
      conditions: triggerConditions,
      logic: 'AND',
    };

    // Convert actions array to EventEffect[]
    // Some actions (like move-agent) may need to expand into multiple effects
    const rawActions = (raw.actions as Record<string, unknown>[]) ?? [];
    const effects: EventEffect[] = [];
    for (const a of rawActions) {
      const type = a.type as string;
      const params: Record<string, unknown> = {};
      switch (type) {
        case 'set-flag':
          params.flagName = a.name as string;
          params.value = a.value;
          effects.push({ type: 'set_flag', params });
          break;
        case 'modify-relation':
          params.fromId = a.from as string;
          params.toId = a.to as string;
          // Determine which field to modify based on available properties
          if (a.affection !== undefined) {
            params.field = 'favorability';
            params.delta = a.affection as number;
          } else if (a.trust !== undefined) {
            params.field = 'trust';
            params.delta = a.trust as number;
          } else if (a.intimacy !== undefined) {
            params.field = 'intimacy';
            params.delta = a.intimacy as number;
          } else if (a.loyalty !== undefined) {
            params.field = 'intimacy'; // loyalty maps to intimacy
            params.delta = a.loyalty as number;
          } else {
            params.field = 'favorability';
            params.delta = 0;
          }
          effects.push({ type: 'modify_relation', params });
          break;
        case 'modify-attribute':
          params.agentId = a.agent as string;
          params.attribute = a.attribute as string;
          params.delta = a.value as number;
          effects.push({ type: 'modify_attribute', params });
          break;
        case 'trigger-dialogue':
          params.dialogueId = a.dialogueRef as string;
          effects.push({ type: 'dialogue', params });
          break;
        case 'move-agent':
          // Expand agents array into multiple move_agent effects
          const agentIds = a.agents as string[];
          const targetLocation = a.target as string;
          if (Array.isArray(agentIds) && agentIds.length > 1) {
            for (const agentId of agentIds) {
              effects.push({ type: 'move_agent', params: { agentId, locationId: targetLocation } });
            }
            break; // skip the default push below
          }
          params.agentId = agentIds?.[0] ?? a.agent as string;
          params.locationId = targetLocation;
          effects.push({ type: 'move_agent', params });
          break;
        case 'create-item':
          params.itemData = a.item;
          params.locationId = a.location as string;
          effects.push({ type: 'create_item', params });
          break;
        case 'notify':
          // Notify actions don't map to EventEffect directly;
          // they'll be handled as log entries by the event system
          effects.push({ type: 'set_flag', params: { flagName: `_notify_${raw.id}`, value: a.message as string } });
          break;
        case 'restore-agent':
          // Expand agents array into multiple modify_attribute effects
          const restoreAgents = a.agents as string[];
          const restoreAttr = a.attribute as string;
          const restoreValue = a.value as number;
          if (Array.isArray(restoreAgents) && restoreAgents.length > 1) {
            for (const agentId of restoreAgents) {
              effects.push({ type: 'modify_attribute', params: { agentId, attribute: restoreAttr, delta: restoreValue } });
            }
          } else {
            params.agentId = restoreAgents?.[0] ?? a.agent as string;
            params.attribute = restoreAttr;
            params.delta = restoreValue;
            effects.push({ type: 'modify_attribute', params });
          }
          break;
        default:
          // Unknown action types - store as a flag so the data isn't lost
          Object.assign(params, a);
          delete params.type;
          params.originalActionType = type;
          effects.push({ type: 'set_flag', params });
          break;
      }
    }

    return {
      id: raw.id as string,
      name: raw.name as string,
      trigger,
      priority: (raw.priority as number) ?? 5,
      repeatable: (raw.repeatable as boolean) ?? false,
      cooldown: (raw.cooldown as number) ?? 0,
      effects,
      scope: raw.scope as 'global' | 'location' | 'agents' ?? 'global',
    };
  }

  // Normalize DialogueData from tree structure
  // JSON dialogues have: id, participants, tree (root node), nodes (dict of nodes)
  // Each node: { id, speaker, text, emotion, choices: [{ id, speaker, text, emotion, next: nodeId }] }
  // Engine DialogueData expects: id, participants, lines: DialogueLine[], emotionTag
  // DialogueLine: { speaker, text, choices?: DialogueChoice[], emotionTag?, effects? }
  // DialogueChoice: { text, nextLineIndex?, effects?, emotionTag? }
  private normalizeDialogueData(raw: Record<string, unknown>): DialogueData {
    const id = raw.id as string;
    const participants = (raw.participants as string[]) ?? [];
    const emotionTag = raw.emotionTag as string | undefined;

    // If the dialogue already has a flat "lines" array, use it directly
    if (Array.isArray(raw.lines)) {
      return {
        id,
        participants,
        lines: raw.lines as DialogueLine[],
        emotionTag,
      };
    }

    // Otherwise, convert the tree structure to a flat lines array
    const treeRoot = raw.tree as Record<string, unknown> | undefined;
    const nodesDict = (raw.nodes as Record<string, Record<string, unknown>>) ?? {};

    if (!treeRoot) {
      // No dialogue content
      return {
        id,
        participants,
        lines: [],
        emotionTag,
      };
    }

    // Flatten: each "node" becomes a DialogueLine. The "next" field in choices
    // maps to a node ID, which we convert to a line index by pre-building an
    // ordered list of all nodes (root first, then dict nodes in insertion order).

    // Collect all nodes in order: root first, then dict nodes
    const allNodeIds: string[] = [];
    const nodeMap: Record<string, Record<string, unknown>> = {};

    // Add root node
    const rootId = (treeRoot.id as string) ?? 'root';
    allNodeIds.push(rootId);
    nodeMap[rootId] = treeRoot;

    // Add all dict nodes
    for (const [nodeId, nodeData] of Object.entries(nodesDict)) {
      if (!allNodeIds.includes(nodeId)) {
        allNodeIds.push(nodeId);
        nodeMap[nodeId] = nodeData;
      }
    }

    // Build an index mapping: nodeId -> line index
    const nodeIndexMap: Record<string, number> = {};
    for (let i = 0; i < allNodeIds.length; i++) {
      nodeIndexMap[allNodeIds[i]] = i;
    }

    // Convert each node to a DialogueLine
    const lines: DialogueLine[] = allNodeIds.map(nodeId => {
      const node = nodeMap[nodeId];
      const rawChoices = (node.choices as Record<string, unknown>[]) ?? [];

      const choices: DialogueChoice[] = rawChoices.map(c => {
        const nextNodeId = c.next as string | undefined;
        // If next points to "end" or an empty-choices node, don't set nextLineIndex
        // (the dialogue will naturally end)
        let nextLineIndex: number | undefined;
        if (nextNodeId && nodeIndexMap[nextNodeId] !== undefined) {
          const targetNode = nodeMap[nextNodeId];
          const targetChoices = (targetNode?.choices as Record<string, unknown>[]) ?? [];
          // Only set nextLineIndex if the target node has content
          // An "end" node with empty choices is the terminal state
          if (targetChoices.length > 0 || targetNode?.text) {
            nextLineIndex = nodeIndexMap[nextNodeId];
          }
        }

        return {
          text: c.text as string ?? '',
          nextLineIndex,
          emotionTag: (c.emotion as string) ?? undefined,
        };
      });

      // Filter out choices with empty text (they're just narrative transitions)
      const filteredChoices = choices.filter(c => c.text !== '');

      return {
        speaker: node.speaker as string ?? 'narrator',
        text: node.text as string ?? '',
        choices: filteredChoices.length > 0 ? filteredChoices : undefined,
        emotionTag: (node.emotion as string) ?? undefined,
      };
    });

    return {
      id,
      participants,
      lines,
      emotionTag,
    };
  }

  // Normalize ScheduleData from JSON format
  private normalizeScheduleData(raw: Record<string, unknown>): ScheduleData {
    const rawEntries = (raw.entries as Record<string, unknown>[]) ?? [];

    const entries = rawEntries.map(e => ({
      hour: e.hour as number ?? 0,
      minute: e.minute as number ?? 0,
      action: e.action as string ?? 'wait',
      target: e.target as string | undefined,
      location: e.location as string | undefined,
    }));

    return {
      id: raw.id as string,
      entries,
    };
  }
}