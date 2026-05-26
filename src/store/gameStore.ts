// ============================================================
// WorldSim Engine - Game State Management (Zustand)
// ============================================================

import { create } from 'zustand';
import {
  WorldState,
  GameClock,
  AgentState,
  MapConfig,
  ItemState,
  FactionConfig,
  Relation,
  GameLog,
  Position,
  Action,
  SaveData,
  GameSettings,
  CompleteWorld,
} from '@/engine/types';
import { tick, formatClock } from '@/engine/clock';

// ---- Game Phases ----
export type GamePhase = 'menu' | 'world-select' | 'character-select' | 'playing' | 'paused';

// ---- Store State ----
interface GameStore {
  // Phase
  phase: GamePhase;
  setPhase: (phase: GamePhase) => void;

  // Loaded World
  loadedWorld: CompleteWorld | null;
  setLoadedWorld: (world: CompleteWorld) => void;

  // World State (the runtime state)
  worldState: WorldState | null;
  setWorldState: (state: WorldState) => void;

  // Settings
  settings: GameSettings;
  updateSettings: (settings: Partial<GameSettings>) => void;

  // Selected World
  selectedWorldId: string | null;
  setSelectedWorldId: (id: string) => void;

  // Player Agent
  playerAgentId: string | null;
  setPlayerAgentId: (id: string) => void;

  // Tick
  tick: () => void;

  // Agent Actions
  queueAction: (agentId: string, action: Action) => void;
  cancelAction: (agentId: string, actionId: string) => void;

  // Player Movement
  movePlayer: (position: Position) => void;

  // Relations
  updateRelation: (fromId: string, toId: string, updates: Partial<Relation>) => void;

  // Logs
  addLog: (log: Omit<GameLog, 'tick' | 'timestamp'>) => void;

  // Flags
  setGlobalFlag: (key: string, value: unknown) => void;

  // Save / Load
  exportSave: () => SaveData | null;
  importSave: (data: SaveData) => void;
  autoSave: () => void;
  loadAutoSave: () => SaveData | null;

  // Pause / Resume
  togglePause: () => void;
}

const DEFAULT_SETTINGS: GameSettings = {
  timeMode: 'turn-based',
  tickSpeed: 1000,
  autoSave: true,
  autoSaveInterval: 50,
  soundEnabled: false,
  musicEnabled: false,
};

export const useGameStore = create<GameStore>((set, get) => ({
  // Phase
  phase: 'menu',
  setPhase: (phase) => set({ phase }),

  // Loaded World
  loadedWorld: null,
  setLoadedWorld: (loadedWorld) => set({ loadedWorld }),

  // World State
  worldState: null,
  setWorldState: (worldState) => set({ worldState }),

  // Settings
  settings: DEFAULT_SETTINGS,
  updateSettings: (settings) =>
    set((state) => ({ settings: { ...state.settings, ...settings } })),

  // Selected World
  selectedWorldId: null,
  setSelectedWorldId: (selectedWorldId) => set({ selectedWorldId }),

  // Player Agent
  playerAgentId: null,
  setPlayerAgentId: (playerAgentId) => set({ playerAgentId }),

  // Tick - Advance world time by one tick
  tick: () => {
    const { worldState, loadedWorld, settings } = get();
    if (!worldState || !loadedWorld || worldState.paused) return;

    const newClock = tick(worldState.clock, loadedWorld.config.tickSize);
    const newLogs = [...worldState.logs];

    // Auto-save check
    if (settings.autoSave && newClock.tick % settings.autoSaveInterval === 0) {
      get().autoSave();
    }

    set({
      worldState: {
        ...worldState,
        clock: newClock,
        logs: newLogs,
      },
    });
  },

  // Queue action for agent
  queueAction: (agentId, action) => {
    const { worldState } = get();
    if (!worldState || !worldState.agents[agentId]) return;

    const agent = worldState.agents[agentId];
    const updatedAgent = {
      ...agent,
      actionQueue: [...agent.actionQueue, action],
    };

    set({
      worldState: {
        ...worldState,
        agents: {
          ...worldState.agents,
          [agentId]: updatedAgent,
        },
      },
    });
  },

  // Cancel action
  cancelAction: (agentId, actionId) => {
    const { worldState } = get();
    if (!worldState || !worldState.agents[agentId]) return;

    const agent = worldState.agents[agentId];
    const updatedAgent = {
      ...agent,
      actionQueue: agent.actionQueue.filter((a) => a.id !== actionId),
    };

    set({
      worldState: {
        ...worldState,
        agents: {
          ...worldState.agents,
          [agentId]: updatedAgent,
        },
      },
    });
  },

  // Move player
  movePlayer: (position) => {
    const { worldState, playerAgentId } = get();
    if (!worldState || !playerAgentId || !worldState.agents[playerAgentId]) return;

    const agent = worldState.agents[playerAgentId];
    const updatedAgent = {
      ...agent,
      state: {
        ...agent.state,
        position,
      },
    };

    // Add movement log
    const newLog: GameLog = {
      tick: worldState.clock.tick,
      timestamp: formatClock(worldState.clock),
      type: 'action',
      agentId: playerAgentId,
      message: `${agent.name} 移动到了 ${position.roomId || position.nodeId}`,
    };

    set({
      worldState: {
        ...worldState,
        agents: {
          ...worldState.agents,
          [playerAgentId]: updatedAgent,
        },
        logs: [...worldState.logs, newLog],
      },
    });
  },

  // Update relation
  updateRelation: (fromId, toId, updates) => {
    const { worldState } = get();
    if (!worldState) return;

    const fromRelations = worldState.relations[fromId] || {};
    const currentRelation = fromRelations[toId] || {
      agentId: toId,
      affection: 0,
      trust: 0,
      intimacy: 0,
      tags: [],
      history: [],
    };

    const updatedRelation = {
      ...currentRelation,
      ...updates,
      history: [
        ...currentRelation.history,
        ...(updates.history || []),
      ],
    };

    set({
      worldState: {
        ...worldState,
        relations: {
          ...worldState.relations,
          [fromId]: {
            ...fromRelations,
            [toId]: updatedRelation,
          },
        },
      },
    });
  },

  // Add log
  addLog: (log) => {
    const { worldState } = get();
    if (!worldState) return;

    const newLog: GameLog = {
      ...log,
      tick: worldState.clock.tick,
      timestamp: formatClock(worldState.clock),
    };

    // Keep last 500 logs
    const logs = [...worldState.logs, newLog].slice(-500);

    set({
      worldState: {
        ...worldState,
        logs,
      },
    });
  },

  // Set global flag
  setGlobalFlag: (key, value) => {
    const { worldState } = get();
    if (!worldState) return;

    set({
      worldState: {
        ...worldState,
        globalFlags: {
          ...worldState.globalFlags,
          [key]: value,
        },
      },
    });
  },

  // Export save
  exportSave: () => {
    const { worldState, loadedWorld, settings } = get();
    if (!worldState || !loadedWorld) return null;

    const saveData: SaveData = {
      version: '1.0',
      worldId: loadedWorld.config.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      worldState,
    };

    return saveData;
  },

  // Import save
  importSave: (data) => {
    set({
      worldState: data.worldState,
      playerAgentId: data.worldState.playerAgentId,
      phase: 'playing',
    });
  },

  // Auto save to localStorage
  autoSave: () => {
    const { worldState, loadedWorld } = get();
    if (!worldState || !loadedWorld) return;

    const saveData: SaveData = {
      version: '1.0',
      worldId: loadedWorld.config.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      worldState,
    };

    try {
      localStorage.setItem(`worldsim_autosave_${loadedWorld.config.id}`, JSON.stringify(saveData));
    } catch {
      // Storage full or unavailable
    }
  },

  // Load auto save
  loadAutoSave: () => {
    const { loadedWorld } = get();
    if (!loadedWorld) return null;

    try {
      const raw = localStorage.getItem(`worldsim_autosave_${loadedWorld.config.id}`);
      if (raw) {
        return JSON.parse(raw) as SaveData;
      }
    } catch {
      // Parse error
    }
    return null;
  },

  // Toggle pause
  togglePause: () => {
    const { worldState } = get();
    if (!worldState) return;

    set({
      worldState: {
        ...worldState,
        paused: !worldState.paused,
      },
      phase: worldState.paused ? 'playing' : 'paused',
    });
  },
}));
