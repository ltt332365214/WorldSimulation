'use client';

import { Action, WorldState } from '@/engine/types';

const ACTION_LABELS: Record<string, string> = {
  move: '前往',
  talk: '交谈',
  greet: '问候',
  examine: '查看',
  use_item: '使用',
  gift: '赠礼',
  wait: '等待',
  rest: '休息',
  eat: '进食',
  read: '读书',
  custom: '行动',
};

export default function ActionMenu({
  actions, onAction, snapshot,
}: {
  actions: Action[];
  onAction: (action: Action) => void;
  snapshot: WorldState;
}) {
  const resolveTargetName = (action: Action): string => {
    if (!action.target) return '';
    const target = action.target;

    // Location names
    if (action.type === 'move') {
      return snapshot.locations[target]?.name ?? target;
    }

    // Agent names
    if (['talk', 'greet', 'gift'].includes(action.type)) {
      return snapshot.agents[target]?.name ?? target;
    }

    // Item names
    if (['examine', 'use_item'].includes(action.type)) {
      return snapshot.items[target]?.name ?? target;
    }

    return target;
  };

  // Group actions by type for better display
  const moveActions = actions.filter(a => a.type === 'move');
  const socialActions = actions.filter(a => ['talk', 'greet'].includes(a.type));
  const itemActions = actions.filter(a => ['examine', 'use_item', 'gift'].includes(a.type));
  const miscActions = actions.filter(a => ['wait', 'rest'].includes(a.type));
  const otherActions = actions.filter(a => !['move', 'talk', 'greet', 'examine', 'use_item', 'gift', 'wait', 'rest'].includes(a.type));

  return (
    <div className="rounded-lg border border-bronze/30 bg-ink p-4">
      <h3 className="text-sm font-bold text-amber-100 mb-3">可执行操作</h3>

      {moveActions.length > 0 && (
        <div className="mb-2">
          <span className="text-xs text-amber-200/40 mb-1 block">移动</span>
          <div className="flex flex-wrap gap-2">
            {moveActions.map(action => (
              <button
                key={action.id}
                onClick={() => onAction(action)}
                className="action-btn px-3 py-1.5 rounded text-sm text-jade-light hover:text-amber-100"
              >
                {ACTION_LABELS[action.type]} {resolveTargetName(action)}
              </button>
            ))}
          </div>
        </div>
      )}

      {socialActions.length > 0 && (
        <div className="mb-2">
          <span className="text-xs text-amber-200/40 mb-1 block">人际</span>
          <div className="flex flex-wrap gap-2">
            {socialActions.map(action => (
              <button
                key={action.id}
                onClick={() => onAction(action)}
                className="action-btn px-3 py-1.5 rounded text-sm text-vermillion-light hover:text-amber-100"
              >
                {ACTION_LABELS[action.type]} {resolveTargetName(action)}
              </button>
            ))}
          </div>
        </div>
      )}

      {itemActions.length > 0 && (
        <div className="mb-2">
          <span className="text-xs text-amber-200/40 mb-1 block">物品与查看</span>
          <div className="flex flex-wrap gap-2">
            {itemActions.map(action => (
              <button
                key={action.id}
                onClick={() => onAction(action)}
                className="action-btn px-3 py-1.5 rounded text-sm text-bronze-light hover:text-amber-100"
              >
                {ACTION_LABELS[action.type]} {resolveTargetName(action)}
              </button>
            ))}
          </div>
        </div>
      )}

      {(miscActions.length > 0 || otherActions.length > 0) && (
        <div>
          <span className="text-xs text-amber-200/40 mb-1 block">其他</span>
          <div className="flex flex-wrap gap-2">
            {[...miscActions, ...otherActions].map(action => (
              <button
                key={action.id}
                onClick={() => onAction(action)}
                className="action-btn px-3 py-1.5 rounded text-sm text-amber-200/80 hover:text-amber-100"
              >
                {ACTION_LABELS[action.type] ?? action.type}
                {action.target ? ` ${resolveTargetName(action)}` : ''}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}