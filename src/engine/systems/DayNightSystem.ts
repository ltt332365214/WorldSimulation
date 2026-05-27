import { WorldStateManager } from '../core/WorldState';
import { SystemBase } from './SystemBase';
import { LogEntry, ActionType } from '../types';
import { Agent } from '../models/Agent';

const AMBIENCE_MAP: Record<string, string> = {
  '深夜': '夜色深沉，万物寂然',
  '清晨': '晨曦微露，薄雾轻笼',
  '早晨': '朝阳初升，万物清新',
  '上午': '日光明朗，天色清亮',
  '午时': '日正当中，光影分明',
  '下午': '日影西斜，暖意犹存',
  '傍晚': '暮色渐浓，晚霞漫天',
  '夜晚': '月华清冷，灯火阑珊',
};

const NIGHT_PERIODS = new Set(['深夜', '夜晚', '傍晚']);

export class DayNightSystem extends SystemBase {
  name = 'DayNightSystem';

  onInit(stateManager: WorldStateManager): void {
    // No initialization required; time state is already in the clock
  }

  onTick(stateManager: WorldStateManager): void {
    const clock = stateManager.getClock();
    const timeOfDay = clock.getTimeOfDay();
    const snapshot = stateManager.getSnapshot();
    const tick = snapshot.tickCount;

    this.updateAmbience(stateManager, timeOfDay);

    const isNight = NIGHT_PERIODS.has(timeOfDay);
    this.applyNightConstraints(stateManager, isNight, tick);
  }

  onEvent(event: string, data: unknown, stateManager: WorldStateManager): void {
    // Time-of-day changes are purely tick-driven
  }

  private updateAmbience(stateManager: WorldStateManager, timeOfDay: string): void {
    const ambience = AMBIENCE_MAP[timeOfDay] ?? '';
    stateManager.setGlobalFlag('ambience', ambience);
    stateManager.setGlobalFlag('timeOfDay', timeOfDay);
  }

  private applyNightConstraints(stateManager: WorldStateManager, isNight: boolean, tick: number): void {
    const agents = stateManager.getAllAgents();

    for (const agent of agents) {
      if (agent.controlled) continue;

      const state = agent.getState();

      if (isNight) {
        // Sleeping agents recover; awake agents lose sleep value faster at night
        if ((state.currentAction?.type as ActionType) === 'rest') {
          agent.modifyNeed('sleepValue', 2);
          agent.modifyNeed('energy', 1);
        } else {
          agent.modifyNeed('sleepValue', -1);

          // Non-player agents tend to seek rest at night if sleep is low
          if (state.sleepValue < 30 && (state.currentAction?.type as ActionType) !== 'rest') {
            if (!state.currentAction || state.currentAction.interruptible) {
              const logEntry: LogEntry = {
                tick,
                type: 'system',
                description: `${agent.name}困倦不已，开始歇息`,
                agentId: agent.id,
              };
              stateManager.addLogEntry(logEntry);
            }
          }
        }
      } else {
        // Daytime: natural energy recovery if resting
        if ((state.currentAction?.type as ActionType) === 'rest') {
          agent.modifyNeed('sleepValue', 1);
          agent.modifyNeed('energy', 0.5);
        }
      }
    }
  }
}