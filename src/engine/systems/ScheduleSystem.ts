import { WorldStateManager } from '../core/WorldState';
import { SystemBase } from './SystemBase';
import { ScheduleData, ScheduleEntry, Action, LogEntry } from '../types';
import { Agent } from '../models/Agent';
import { createAction, describeAction } from '../models/Action';

export class ScheduleSystem extends SystemBase {
  name = 'ScheduleSystem';

  private schedules: Map<string, ScheduleData>;

  constructor() {
    super();
    this.schedules = new Map();
  }

  onInit(stateManager: WorldStateManager): void {
    // Schedules are loaded from external JSON; nothing to initialize here
    // beyond what the constructor already set.
  }

  loadSchedule(schedule: ScheduleData): void {
    // Sort entries once at load time so findMatchingEntry doesn't re-sort every tick
    const sortedEntries = [...schedule.entries].sort((a, b) => {
      const aTime = a.hour * 60 + a.minute;
      const bTime = b.hour * 60 + b.minute;
      return aTime - bTime;
    });
    this.schedules.set(schedule.id, { ...schedule, entries: sortedEntries });
  }

  onTick(stateManager: WorldStateManager): void {
    const clock = stateManager.getClock();
    const currentTime = clock.getTime();
    const tick = stateManager.getSnapshot().tickCount;

    const agents = stateManager.getAllAgents();
    for (const agent of agents) {
      if (agent.controlled) continue;

      const scheduleRef = agent.getScheduleRef();
      if (!scheduleRef) continue;

      const schedule = this.schedules.get(scheduleRef);
      if (!schedule) continue;

      const entry = this.findMatchingEntry(schedule, currentTime.hour, currentTime.minute);
      if (!entry) continue;

      this.executeEntry(agent, entry, stateManager, tick);
    }
  }

  onEvent(event: string, data: unknown, stateManager: WorldStateManager): void {
    // No event-driven behavior; schedule system is purely tick-driven
  }

  private findMatchingEntry(schedule: ScheduleData, hour: number, minute: number): ScheduleEntry | null {
    // Entries are pre-sorted at load time; no need to re-sort here
    let best: ScheduleEntry | null = null;
    for (const entry of schedule.entries) {
      if (entry.hour * 60 + entry.minute <= hour * 60 + minute) {
        best = entry;
      }
    }
    return best;
  }

  private executeEntry(agent: Agent, entry: ScheduleEntry, stateManager: WorldStateManager, tick: number): void {
    const currentAction = agent.getState().currentAction;

    // Always move the agent to the scheduled location (regardless of action type)
    // The "location" field in schedule entries specifies where the agent should be
    if (entry.location && agent.location !== entry.location) {
      agent.moveTo(entry.location);
    }

    // Also move if action is explicitly 'move' and target is specified
    if (entry.action === 'move' && entry.target) {
      agent.moveTo(entry.target);
    }

    // Set the agent's current action from the schedule
    const action = this.buildActionFromEntry(entry);

    // Schedule-driven actions interrupt previous actions only if the new entry differs
    if (currentAction && !currentAction.interruptible) return;

    agent.setAction(action);

    const description = describeAction(action, agent.name);
    const logEntry: LogEntry = {
      tick,
      type: 'action',
      description,
      agentId: agent.id,
    };
    stateManager.addLogEntry(logEntry);
  }

  private buildActionFromEntry(entry: ScheduleEntry): Action {
    // Map both English action types and common Chinese descriptions
    const typeMap: Record<string, Action['type']> = {
      move: 'move',
      greet: 'greet',
      rest: 'rest',
      eat: 'eat',
      read: 'read',
      talk: 'talk',
      wait: 'wait',
      // Chinese schedule action descriptions -> engine types
      '安寝': 'rest',
      '起身梳洗': 'wait',
      '晨省问安': 'greet',
      '晨省待客': 'greet',
      '早膳': 'eat',
      '午膳': 'eat',
      '晚膳': 'eat',
      '午歇': 'rest',
      '闲游访友': 'move',
      '闲游赏景': 'move',
      '闲游听戏': 'wait',
      '园中游玩': 'move',
      '散步赏景': 'move',
      '品茶闲话': 'talk',
      '闲坐品茶': 'wait',
      '听戏说笑': 'talk',
      '读书': 'read',
      '读书（敷衍）': 'read',
      '理事': 'wait',
      '理事账目': 'wait',
      '昏定': 'greet',
      '夜话': 'talk',
      '姐妹聚谈': 'talk',
      '回院准备安寝': 'move',
      '准备安寝': 'rest',
      '宴饮': 'eat',
      '闲游': 'move',
      '访友': 'talk',
      '梳洗': 'wait',
    };

    const actionType = typeMap[entry.action] ?? 'custom';
    // For move/greet/talk actions, use the location as target if no explicit target
    const target = entry.target ?? (actionType === 'move' ? entry.location : undefined);
    return createAction(actionType, target, 1, true);
  }
}