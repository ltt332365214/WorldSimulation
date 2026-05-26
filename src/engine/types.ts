// ============================================================
// WorldSim Engine - Core Type Definitions
// ============================================================

// ---- World ----
export interface WorldConfig {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  era: string;
  author: string;
  version: string;
  entryMap: string;
  cover?: string;
  calendar?: CalendarConfig;
  tickSize: number;
  attributesTemplate: AttributesTemplate;
  systems: string[];
}

export interface WorldIndex {
  worlds: WorldConfig[];
}

export interface CalendarConfig {
  yearStart: number;
  monthStart: number;
  dayStart: number;
  hourStart: number;
  seasons: Season[];
  festivals: Festival[];
}

export interface Season {
  name: string;
  startMonth: number;
  startDay: number;
}

export interface Festival {
  name: string;
  month: number;
  day: number;
}

// ---- Attributes Template ----
export interface AttributesTemplate {
  identity: IdentityTemplate;
  attributes: Record<string, AttributeDef>;
  state: Record<string, StateDef>;
}

export interface IdentityTemplate {
  fields: Record<string, { type: string; required: boolean }>;
}

export interface AttributeDef {
  type: 'number' | 'string' | 'enum' | 'boolean';
  min?: number;
  max?: number;
  default: unknown;
  description: string;
}

export interface StateDef {
  type: 'number' | 'string' | 'enum' | 'boolean';
  default: unknown;
  description: string;
}

// ---- Clock ----
export interface GameClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  tick: number;
  season: string;
  period: 'dawn' | 'morning' | 'noon' | 'afternoon' | 'evening' | 'night';
}

// ---- Map ----
export interface MapConfig {
  id: string;
  name: string;
  type: 'world' | 'indoor' | 'outdoor';
  description: string;
  nodes?: MapNode[];
  rooms?: Room[];
  connections?: Connection[];
  parentMap?: string;
}

export interface MapNode {
  id: string;
  name: string;
  type: string;
  description: string;
  x: number;
  y: number;
  connections: string[];
  subMap?: string;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  owner?: string;
  connections: string[];
  items?: string[];
  ambience?: string;
}

export interface Connection {
  from: string;
  to: string;
  distance: number;
  description?: string;
}

export interface Position {
  mapId: string;
  nodeId?: string;
  roomId?: string;
}

// ---- Agent ----
export interface AgentConfig {
  id: string;
  name: string;
  identity: AgentIdentity;
  attributes: Record<string, number | string | boolean>;
  initialState: Record<string, unknown>;
  aiProfile: AIProfile;
  inventory?: string[];
  skills?: Record<string, number>;
  schedule?: ScheduleEntry[];
}

export interface AgentIdentity {
  gender: string;
  birthdate: string;
  faction?: string;
  family?: string;
  title?: string;
  description: string;
}

export interface AIProfile {
  decisionRules: DecisionRule[];
  personality: Record<string, number>;
  schedule?: ScheduleEntry[];
}

export interface DecisionRule {
  id: string;
  condition: Condition;
  action: string;
  actionParams?: Record<string, unknown>;
  priority: number;
}

export interface Condition {
  type: 'and' | 'or' | 'not' | 'compare' | 'nearby' | 'time' | 'flag' | 'always';
  conditions?: Condition[];
  field?: string;
  operator?: string;
  value?: unknown;
  agentId?: string;
}

export interface ScheduleEntry {
  hourStart: number;
  hourEnd: number;
  activity: string;
  location?: string;
}

// ---- Agent Runtime State ----
export interface AgentState {
  id: string;
  name: string;
  identity: AgentIdentity;
  attributes: Record<string, number | string | boolean>;
  state: AgentRuntimeState;
  memory: AgentMemory;
  relations: Record<string, Relation>;
  inventory: string[];
  skills: Record<string, number>;
  actionQueue: Action[];
  aiProfile: AIProfile;
  controlled: boolean;
}

export interface AgentRuntimeState {
  position: Position;
  health: number;
  energy: number;
  mood: string;
  hunger: number;
  sleepiness: number;
  currentAction?: string;
  intent?: string;
  [key: string]: unknown;
}

export interface AgentMemory {
  shortTerm: MemoryEntry[];
  keyMemories: MemoryEntry[];
  impressions: Record<string, Impression>;
}

export interface MemoryEntry {
  tick: number;
  description: string;
  importance: number;
  participants: string[];
}

export interface Impression {
  agentId: string;
  summary: string;
  lastUpdated: number;
}

// ---- Relation ----
export interface Relation {
  agentId: string;
  affection: number;
  trust: number;
  intimacy: number;
  tags: string[];
  history: RelationEvent[];
}

export interface RelationEvent {
  tick: number;
  description: string;
  affectionDelta: number;
  trustDelta: number;
}

// ---- Action ----
export interface Action {
  id: string;
  type: string;
  target?: string;
  targetType?: 'agent' | 'item' | 'location' | 'none';
  duration: number;
  elapsed: number;
  progress: number;
  interruptible: boolean;
  onComplete?: string;
  onInterrupt?: string;
  requirements?: ActionRequirement[];
  params?: Record<string, unknown>;
}

export interface ActionRequirement {
  type: string;
  field?: string;
  value?: unknown;
  operator?: string;
}

// ---- Event ----
export interface EventConfig {
  id: string;
  name: string;
  trigger: EventTrigger;
  priority: number;
  repeatable: boolean;
  cooldown: number;
  effects: EventEffect[];
  scope: 'global' | 'map' | 'agent' | 'relation';
  dialogues?: DialogueTree;
}

export interface EventTrigger {
  type: string;
  conditions: Condition[];
}

export interface EventEffect {
  type: string;
  target?: string;
  field?: string;
  value?: unknown;
  operator?: string;
  eventId?: string;
  flag?: string;
  dialogueId?: string;
}

// ---- Dialogue ----
export interface DialogueTree {
  id: string;
  entries: DialogueEntry[];
}

export interface DialogueEntry {
  id: string;
  speaker: string;
  text: string;
  emotion?: string;
  choices?: DialogueChoice[];
  effects?: EventEffect[];
  next?: string;
}

export interface DialogueChoice {
  id: string;
  text: string;
  requiredRelation?: Record<string, number>;
  effects?: EventEffect[];
  next: string;
  emotionTag?: string;
}

// ---- Item ----
export interface ItemConfig {
  id: string;
  name: string;
  description: string;
  type: string;
  properties: Record<string, unknown>;
  interactable: string[];
}

export interface ItemState {
  id: string;
  configId: string;
  name: string;
  location: Position | string;
  owner?: string;
}

// ---- Faction ----
export interface FactionConfig {
  id: string;
  name: string;
  description: string;
  members: string[];
  relations: Record<string, number>;
}

// ---- World State ----
export interface WorldState {
  worldId: string;
  clock: GameClock;
  maps: Record<string, MapConfig>;
  agents: Record<string, AgentState>;
  items: Record<string, ItemState>;
  relations: Record<string, Record<string, Relation>>;
  factions: Record<string, FactionConfig>;
  globalFlags: Record<string, unknown>;
  activeEvents: string[];
  eventCooldowns: Record<string, number>;
  logs: GameLog[];
  playerAgentId?: string;
  paused: boolean;
}

export interface GameLog {
  tick: number;
  timestamp: string;
  type: 'action' | 'event' | 'dialogue' | 'system' | 'relation' | 'time';
  agentId?: string;
  message: string;
  details?: Record<string, unknown>;
}

// ---- Save/Load ----
export interface SaveData {
  version: string;
  worldId: string;
  createdAt: string;
  updatedAt: string;
  worldState: WorldState;
}

// ---- UI ----
export interface AvailableAction {
  id: string;
  label: string;
  type: string;
  target?: string;
  targetName?: string;
  description: string;
  requirements?: ActionRequirement[];
  params?: Record<string, unknown>;
}

export interface GameSettings {
  timeMode: 'turn-based' | 'realtime-pause';
  tickSpeed: number;
  autoSave: boolean;
  autoSaveInterval: number;
  soundEnabled: boolean;
  musicEnabled: boolean;
}
