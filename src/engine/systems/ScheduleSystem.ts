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
    this.schedules.set(schedule.id, schedule);
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
    const sorted = [...schedule.entries].sort((a, b) => {
      const aTime = a.hour * 60 + a.minute;
      const bTime = b.hour * 60 + b.minute;
      return aTime - bTime;
    });

    let best: ScheduleEntry | null = null;
    for (const entry of sorted) {
      if (entry.hour * 60 + entry.minute <= hour * 60 + minute) {
        best = entry;
      }
    }
    return best;
  }

  private executeEntry(agent: Agent, entry: ScheduleEntry, stateManager: WorldStateManager, tick: number): void {
    const currentAction = agent.getState().currentAction;
    const currentType = currentAction?.type;

    if (currentType === entry.action && currentAction?.target === (entry.target ?? undefined)) {
      // Agent is already performing this schedule action; just advance it
      if (currentAction) {
        const advanced = { ...currentAction, elapsed: currentAction.elapsed + 1 };
        agent.setAction(advanced);
      }
      return;
    }

    const action = this.buildActionFromEntry(entry);

    // Schedule-driven actions interrupt previous actions only if the new entry differs
    if (currentAction && !currentAction.interruptible) return;

    agent.setAction(action);

    if (entry.action === 'move' && entry.target) {
      agent.moveTo(entry.target);
    }

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
    const typeMap: Record<string, Action['type']> = {
      move: 'move',
      greet: 'greet',
      rest: 'rest',
      eat: 'eat',
      read: 'read',
      talk: 'talk',
      wait: 'wait',
    };

    const actionType = typeMap[entry.action] ?? 'custom';
    return createAction(actionType, entry.target, 1, true);
  }
}