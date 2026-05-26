// ============================================================
// WorldSim Engine - World State Initializer
// Converts loaded configurations into runtime world state
// ============================================================

import {
  CompleteWorld,
  WorldState,
  AgentState,
  AgentConfig,
  MapConfig,
  ItemState,
  ItemConfig,
  FactionConfig,
  Relation,
  GameLog,
  Position,
  AgentRuntimeState,
  AgentMemory,
} from './types';
import { createClock } from './clock';

/**
 * Initialize a runtime AgentState from AgentConfig
 */
function initAgent(config: AgentConfig, isPlayer: boolean = false): AgentState {
  const runtimeState: AgentRuntimeState = {
    position: (config.initialState?.position as Position) || { mapId: '', nodeId: '' },
    health: (config.initialState?.health as number) || 100,
    energy: (config.initialState?.energy as number) || 100,
    mood: (config.initialState?.mood as string) || '平静',
    hunger: (config.initialState?.hunger as number) || 0,
    sleepiness: (config.initialState?.sleepiness as number) || 0,
    currentAction: undefined,
    intent: undefined,
  };

  // Add any extra state fields from config
  for (const [key, value] of Object.entries(config.initialState || {})) {
    if (!(key in runtimeState)) {
      (runtimeState as Record<string, unknown>)[key] = value;
    }
  }

  const memory: AgentMemory = {
    shortTerm: [],
    keyMemories: [],
    impressions: {},
  };

  return {
    id: config.id,
    name: config.name,
    identity: config.identity,
    attributes: config.attributes,
    state: runtimeState,
    memory,
    relations: {},
    inventory: config.inventory || [],
    skills: config.skills || {},
    actionQueue: [],
    aiProfile: config.aiProfile,
    controlled: isPlayer,
  };
}

/**
 * Initialize item states from item configs
 */
function initItems(items: ItemConfig[]): Record<string, ItemState> {
  const result: Record<string, ItemState> = {};
  for (const config of items) {
    // Create instances for each item
    // For simplicity, one instance per config
    const instanceId = `${config.id}_instance`;
    result[instanceId] = {
      id: instanceId,
      configId: config.id,
      name: config.name,
      location: { mapId: 'worldmap', nodeId: 'rongguofu' },
      owner: undefined,
    };
  }
  return result;
}

/**
 * Initialize relations between agents based on factions
 */
function initRelations(
  agents: AgentConfig[],
  factions: FactionConfig[]
): Record<string, Record<string, Relation>> {
  const relations: Record<string, Record<string, Relation>> = {};

  // Create empty relation maps for each agent
  for (const agent of agents) {
    relations[agent.id] = {};
  }

  // Set up initial relations based on faction membership
  const factionMap = new Map<string, string[]>();
  for (const faction of factions) {
    factionMap.set(faction.id, faction.members);
  }

  for (const agent of agents) {
    for (const other of agents) {
      if (agent.id === other.id) continue;

      let baseAffection = 0;
      let baseTrust = 20;
      let tags: string[] = [];

      // Check if same faction
      const agentFaction = factions.find((f) => f.members.includes(agent.id));
      const otherFaction = factions.find((f) => f.members.includes(other.id));

      if (agentFaction && otherFaction) {
        if (agentFaction.id === otherFaction.id) {
          baseAffection = 30;
          baseTrust = 50;
          tags.push('同族');
        } else {
          // Cross-faction relation
          const crossRelation = agentFaction.relations[otherFaction.id];
          if (crossRelation) {
            baseAffection = crossRelation / 3;
            baseTrust = crossRelation / 2;
          }
        }
      }

      // Special relations for known characters
      const specialRelations: Record<string, Record<string, { affection: number; trust: number; tags: string[] }>> = {
        'jia-baoyu': {
          'lin-daiyu': { affection: 60, trust: 70, tags: ['青梅竹马', '知己'] },
          'xue-baochai': { affection: 40, trust: 50, tags: ['亲戚', '好友'] },
          'wang-xifeng': { affection: 30, trust: 40, tags: ['嫂子', '亲戚'] },
          'shi-xiangyun': { affection: 50, trust: 60, tags: ['青梅竹马'] },
        },
        'lin-daiyu': {
          'jia-baoyu': { affection: 65, trust: 75, tags: ['青梅竹马', '知己'] },
          'xue-baochai': { affection: 10, trust: 30, tags: [' rival', '亲戚'] },
          'shi-xiangyun': { affection: 40, trust: 50, tags: ['好友'] },
        },
        'xue-baochai': {
          'jia-baoyu': { affection: 45, trust: 55, tags: ['亲戚', '倾慕'] },
          'lin-daiyu': { affection: 15, trust: 35, tags: [' rival'] },
          'wang-xifeng': { affection: 50, trust: 60, tags: ['表姐', '盟友'] },
        },
        'wang-xifeng': {
          'jia-baoyu': { affection: 35, trust: 45, tags: ['小叔子', '亲戚'] },
          'xue-baochai': { affection: 55, trust: 65, tags: ['表妹', '盟友'] },
        },
        'shi-xiangyun': {
          'jia-baoyu': { affection: 55, trust: 65, tags: ['青梅竹马'] },
          'lin-daiyu': { affection: 45, trust: 55, tags: ['好友'] },
        },
      };

      const agentSpecial = specialRelations[agent.id]?.[other.id];
      if (agentSpecial) {
        baseAffection = agentSpecial.affection;
        baseTrust = agentSpecial.trust;
        tags = agentSpecial.tags;
      }

      relations[agent.id][other.id] = {
        agentId: other.id,
        affection: baseAffection,
        trust: baseTrust,
        intimacy: Math.floor((baseAffection + baseTrust) / 2),
        tags,
        history: [],
      };
    }
  }

  return relations;
}

/**
 * Initialize a complete world state from loaded configurations
 */
export function initializeWorldState(
  world: CompleteWorld,
  playerAgentId: string
): WorldState {
  const calendar = world.config.calendar;
  const clock = createClock(
    calendar?.yearStart || 1750,
    calendar?.monthStart || 1,
    calendar?.dayStart || 1,
    calendar?.hourStart || 6,
    0
  );

  // Initialize agents
  const agents: Record<string, AgentState> = {};
  for (const agentConfig of world.agents) {
    const isPlayer = agentConfig.id === playerAgentId;
    agents[agentConfig.id] = initAgent(agentConfig, isPlayer);
  }

  // Initialize maps
  const maps: Record<string, MapConfig> = {};
  for (const mapConfig of world.maps) {
    maps[mapConfig.id] = mapConfig;
  }

  // Initialize items
  const items = initItems(world.items);

  // Initialize factions
  const factions: Record<string, FactionConfig> = {};
  for (const faction of world.factions) {
    factions[faction.id] = faction;
  }

  // Initialize relations
  const relations = initRelations(world.agents, world.factions);

  // Initial log
  const initialLog: GameLog = {
    tick: 0,
    timestamp: `${clock.year}年${clock.month}月${clock.day}日 ${String(clock.hour).padStart(2, '0')}:${String(clock.minute).padStart(2, '0')}`,
    type: 'system',
    message: `进入 ${world.config.name} 世界。你扮演的是 ${agents[playerAgentId]?.name || '未知角色'}。`,
  };

  return {
    worldId: world.config.id,
    clock,
    maps,
    agents,
    items,
    relations,
    factions,
    globalFlags: {},
    activeEvents: [],
    eventCooldowns: {},
    logs: [initialLog],
    playerAgentId,
    paused: false,
  };
}
