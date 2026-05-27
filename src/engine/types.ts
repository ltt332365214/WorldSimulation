// ============================================================
// WorldSim Engine - Core Type Definitions
// All attribute fields are dynamic, defined by JSON templates.
// The engine never hardcodes specific attribute names.
// ============================================================

// --- Configuration types (loaded from JSON, immutable) ---

export interface WorldConfig {
  id: string;
  displayName: string;
  description: string;
  tickSize: number; // minutes per tick
  calendar: CalendarConfig;
  timeMode: 'turn-based' | 'realtime-pause';
  initialTime: TimeData;
  systems: string[]; // enabled system IDs
}

export interface CalendarConfig {
  months: { name: string; days: number }[];
  seasons: { name: string; startMonth: number; endMonth: number }[];
  festivals: { name: string; month: number; day: number }[];
  timeUnits: string[]; // e.g. ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"]
}

export interface TimeData {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export interface AgentData {
  id: string;
  name: string;
  gender: string;
  birthdate: TimeData;
  faction?: string;
  description: string;
  extends?: string;
  attributes: Record<string, number>; // dynamic: 体质, 智识, 诗才, etc.
  personality: Record<string, number>; // dynamic: 外向度, 情绪稳定性, etc.
  scheduleRef?: string; // reference to a schedule file
  skills?: Record<string, number>;
  defaultLocation: string; // initial location ID
}

export interface AgentTemplate {
  fields: {
    attributes: string[];
    personality: string[];
    skills?: string[];
  };
  defaults: {
    attributes: Record<string, number>;
    personality: Record<string, number>;
  };
}

export interface LocationData {
  id: string;
  name: string;
  description: string;
  type: 'region' | 'indoor' | 'outdoor';
  connections: string[]; // IDs of connected locations
  travelTime?: Record<string, number>; // locationId → ticks to travel
  items?: string[]; // item IDs present here
  ambience?: string;
  owner?: string; // agent ID
}

export interface WorldMapData {
  nodes: LocationData[];
}

export interface ItemData {
  id: string;
  name: string;
  description: string;
  type: string;
  properties: Record<string, unknown>;
  interactable: string[]; // 'use', 'gift', 'examine', etc.
  value?: number;
}

export interface EventData {
  id: string;
  name: string;
  trigger: EventTrigger;
  priority: number;
  repeatable: boolean;
  cooldown: number; // ticks
  effects: EventEffect[];
  scope: 'global' | 'location' | 'agents';
}

export interface EventTrigger {
  type: 'time' | 'location' | 'meeting' | 'relation' | 'flag' | 'item' | 'composite';
  conditions: EventCondition[];
  logic?: 'AND' | 'OR';
}

export interface EventCondition {
  type: string; // 'agent_location', 'flag_set', 'time_reached', 'relation_threshold', etc.
  params: Record<string, unknown>;
}

export interface EventEffect {
  type: 'modify_attribute' | 'modify_relation' | 'set_flag' | 'dialogue' | 'move_agent' | 'create_item' | 'trigger_event';
  params: Record<string, unknown>;
}

export interface DialogueData {
  id: string;
  participants: string[]; // agent IDs
  lines: DialogueLine[];
  emotionTag?: string;
}

export interface DialogueLine {
  speaker: string; // agent ID
  text: string;
  choices?: DialogueChoice[];
  emotionTag?: string;
  effects?: EventEffect[];
}

export interface DialogueChoice {
  text: string;
  nextLineIndex?: number;
  effects?: EventEffect[];
  emotionTag?: string;
}

export interface RelationData {
  from: string; // agent ID
  to: string;   // agent ID
  favorability: number;  // -100 ~ 100
  trust: number;         // 0 ~ 100
  intimacy: number;      // 0 ~ 100
  tags: string[];        // 'friend', 'lover', 'spouse', 'master-servant', etc.
  history?: RelationEventRecord[];
}

export interface RelationEventRecord {
  tick: number;
  description: string;
  favorabilityDelta: number;
  trustDelta: number;
  intimacyDelta: number;
}

export interface ScheduleData {
  id: string;
  entries: ScheduleEntry[];
}

export interface ScheduleEntry {
  hour: number;
  minute: number;
  action: string; // 'move', 'greet', 'rest', 'eat', 'read', etc.
  target?: string; // location ID or agent ID
  location?: string; // where this action happens
}

// --- Runtime types (engine-created, mutable) ---

export interface AgentState {
  id: string;
  name: string;
  gender: string;
  description: string;
  birthdate: TimeData;
  location: string; // current location ID
  attributes: Record<string, number>;
  personality: Record<string, number>;
  currentEmotion: string;
  currentAction: Action | null;
  currentIntent: string;
  hunger: number;       // 0~100
  sleepValue: number;   // 0~100
  energy: number;       // 0~100
  health: number;       // 0~100
  inventory: string[];  // item IDs
  memory: AgentMemory;
  controlled: boolean;
}

export interface AgentMemory {
  shortTerm: MemoryEntry[];
  keyMemories: MemoryEntry[];
  impressions: Record<string, ImpressionRecord>; // agentId → impression
}

export interface MemoryEntry {
  tick: number;
  description: string;
  importance: number; // 0~100
}

export interface ImpressionRecord {
  agentId: string;
  summary: string;
  lastUpdatedTick: number;
}

export interface Action {
  id: string;
  type: ActionType;
  target?: string; // agent, location, or item ID
  duration: number; // ticks
  elapsed: number;  // ticks already spent
  interruptible: boolean;
  requirements?: ActionRequirement[];
  effects?: ActionEffect[];
}

export type ActionType = 'move' | 'talk' | 'examine' | 'use_item' | 'gift' | 'wait' | 'rest' | 'eat' | 'read' | 'greet' | 'custom';

export interface ActionRequirement {
  type: string; // 'at_location', 'has_item', 'agent_present', etc.
  params: Record<string, unknown>;
}

export interface ActionEffect {
  type: string;
  params: Record<string, unknown>;
}

export interface WorldState {
  worldId: string;
  clock: TimeData;
  tickCount: number;
  agents: Record<string, AgentState>;
  locations: Record<string, LocationData>;
  items: Record<string, ItemData>;
  relations: Record<string, Record<string, RelationData>>; // fromId → toId → relation
  globalFlags: Record<string, unknown>;
  playerAgentId: string;
  eventCooldowns: Record<string, number>; // eventId → remaining cooldown ticks
}

// --- Engine output types (for UI) ---

export interface TickResult {
  tickNumber: number;
  clock: TimeData;
  sceneDescription: string;
  availableActions: Action[];
  logEntries: LogEntry[];
  dialogueTriggered?: DialogueData;
}

export interface SceneDescription {
  locationId: string;
  locationName: string;
  description: string;
  ambience: string;
  timeOfDay: string;
  nearbyAgents: NearbyAgent[];
  nearbyItems: NearbyItem[];
  availableExits: string[];
}

export interface NearbyAgent {
  id: string;
  name: string;
  currentAction: string;
  currentEmotion: string;
}

export interface NearbyItem {
  id: string;
  name: string;
  interactable: string[];
}

export interface LogEntry {
  id?: number;
  tick: number;
  type: 'action' | 'event' | 'move' | 'dialogue' | 'system' | 'relation';
  description: string;
  agentId?: string;
}

export interface SaveData {
  version: string;
  worldId: string;
  worldState: WorldState;
  savedAt: string; // ISO timestamp
}

export interface SystemConfig {
  id: string;
  name: string;
  enabled: boolean;
  settings: Record<string, unknown>;
}