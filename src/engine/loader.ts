// ============================================================
// WorldSim Engine - World Configuration Loader
// Dynamically loads world data from /worlds/<worldId>/ directory
// ============================================================

import {
  WorldConfig,
  WorldIndex,
  AgentConfig,
  MapConfig,
  ItemConfig,
  EventConfig,
  FactionConfig,
} from './types';

const WORLDS_BASE = '/worlds';

/**
 * Load the world index file listing all available worlds
 */
export async function loadWorldIndex(): Promise<WorldIndex> {
  const response = await fetch(`${WORLDS_BASE}/index.json`);
  if (!response.ok) {
    throw new Error(`Failed to load world index: ${response.status}`);
  }
  return response.json();
}

/**
 * Load a specific world's configuration
 */
export async function loadWorldConfig(worldId: string): Promise<WorldConfig> {
  const response = await fetch(`${WORLDS_BASE}/${worldId}/world.json`);
  if (!response.ok) {
    throw new Error(`Failed to load world config for ${worldId}: ${response.status}`);
  }
  return response.json();
}

/**
 * Load all agent configurations for a world
 */
export async function loadAgents(worldId: string): Promise<AgentConfig[]> {
  // Try to load agents index first
  try {
    const indexResponse = await fetch(`${WORLDS_BASE}/${worldId}/agents/index.json`);
    if (indexResponse.ok) {
      const index = await indexResponse.json();
      const agents: AgentConfig[] = [];
      for (const file of index.files) {
        const res = await fetch(`${WORLDS_BASE}/${worldId}/agents/${file}`);
        if (res.ok) agents.push(await res.json());
      }
      return agents;
    }
  } catch {
    // Fallback: try known agent files
  }

  // Fallback: load common agent files
  const agentFiles = [
    'jia-baoyu.json',
    'lin-daiyu.json',
    'xue-baochai.json',
    'wang-xifeng.json',
    'shi-xiangyun.json',
  ];

  const agents: AgentConfig[] = [];
  for (const file of agentFiles) {
    try {
      const res = await fetch(`${WORLDS_BASE}/${worldId}/agents/${file}`);
      if (res.ok) agents.push(await res.json());
    } catch {
      // Skip missing files
    }
  }
  return agents;
}

/**
 * Load all map configurations for a world
 */
export async function loadMaps(worldId: string): Promise<MapConfig[]> {
  const mapFiles = ['worldmap.json', 'rongguofu.json', 'daguan-yuan.json'];
  const maps: MapConfig[] = [];
  for (const file of mapFiles) {
    try {
      const res = await fetch(`${WORLDS_BASE}/${worldId}/maps/${file}`);
      if (res.ok) maps.push(await res.json());
    } catch {
      // Skip missing files
    }
  }
  return maps;
}

/**
 * Load all item configurations for a world
 */
export async function loadItems(worldId: string): Promise<ItemConfig[]> {
  try {
    const res = await fetch(`${WORLDS_BASE}/${worldId}/items/items.json`);
    if (res.ok) {
      const data = await res.json();
      return data.items || [];
    }
  } catch {
    // Fallback
  }
  return [];
}

/**
 * Load all event configurations for a world
 */
export async function loadEvents(worldId: string): Promise<EventConfig[]> {
  try {
    const res = await fetch(`${WORLDS_BASE}/${worldId}/events/events.json`);
    if (res.ok) {
      const data = await res.json();
      return data.events || [];
    }
  } catch {
    // Fallback
  }
  return [];
}

/**
 * Load all faction configurations for a world
 */
export async function loadFactions(worldId: string): Promise<FactionConfig[]> {
  try {
    const res = await fetch(`${WORLDS_BASE}/${worldId}/factions/factions.json`);
    if (res.ok) {
      const data = await res.json();
      return data.factions || [];
    }
  } catch {
    // Fallback
  }
  return [];
}

/**
 * Load a complete world - all configurations
 */
export interface CompleteWorld {
  config: WorldConfig;
  agents: AgentConfig[];
  maps: MapConfig[];
  items: ItemConfig[];
  events: EventConfig[];
  factions: FactionConfig[];
}

export async function loadCompleteWorld(worldId: string): Promise<CompleteWorld> {
  const [config, agents, maps, items, events, factions] = await Promise.all([
    loadWorldConfig(worldId),
    loadAgents(worldId),
    loadMaps(worldId),
    loadItems(worldId),
    loadEvents(worldId),
    loadFactions(worldId),
  ]);

  return {
    config,
    agents,
    maps,
    items,
    events,
    factions,
  };
}
