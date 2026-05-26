import { Action, ActionType, ActionRequirement, ActionEffect } from '../types';

let actionIdCounter = 0;

export function createAction(
  type: ActionType,
  target?: string,
  duration: number = 1,
  interruptible: boolean = true,
  requirements?: ActionRequirement[],
  effects?: ActionEffect[],
): Action {
  return {
    id: `action_${++actionIdCounter}`,
    type,
    target,
    duration,
    elapsed: 0,
    interruptible,
    requirements,
    effects,
  };
}

export function advanceAction(action: Action): Action {
  return {
    ...action,
    elapsed: action.elapsed + 1,
  };
}

export function isActionComplete(action: Action): boolean {
  return action.elapsed >= action.duration;
}

export function getActionProgress(action: Action): number {
  return action.duration > 0 ? action.elapsed / action.duration : 1;
}

export function describeAction(action: Action, agentName: string): string {
  switch (action.type) {
    case 'move':
      return `${agentName}前往${action.target ?? '某处'}`;
    case 'talk':
      return `${agentName}与${action.target ?? '某人'}交谈`;
    case 'examine':
      return `${agentName}查看${action.target ?? '某物'}`;
    case 'use_item':
      return `${agentName}使用${action.target ?? '某物品'}`;
    case 'gift':
      return `${agentName}赠予${action.target ?? '某人'}某物`;
    case 'wait':
      return `${agentName}静静等待`;
    case 'rest':
      return `${agentName}休息`;
    case 'eat':
      return `${agentName}进食`;
    case 'read':
      return `${agentName}读书`;
    case 'greet':
      return `${agentName}向${action.target ?? '某人'}问候`;
    default:
      return `${agentName}执行${action.type}`;
  }
}