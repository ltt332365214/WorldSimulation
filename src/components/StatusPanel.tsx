'use client';

import { AgentState } from '@/engine/types';

export default function StatusPanel({ player }: { player: AgentState | undefined }) {
  if (!player) return null;

  const needs = [
    { label: '体力', value: player.energy, color: 'bg-jade' },
    { label: '饥饿', value: 100 - player.hunger, color: 'bg-bronze' },
    { label: '精神', value: player.sleepValue, color: 'bg-vermillion' },
    { label: '健康', value: player.health, color: 'bg-jade-light' },
  ];

  return (
    <div>
      <h3 className="text-sm font-bold text-amber-100 mb-2">{player.name}</h3>
      <div className="text-xs text-amber-200/50 mb-2">
        情绪: {player.currentEmotion} · {player.currentAction?.type ?? '空闲'}
      </div>

      <div className="space-y-2">
        {needs.map(n => (
          <div key={n.label}>
            <div className="flex items-center justify-between text-xs text-amber-200/60 mb-0.5">
              <span>{n.label}</span>
              <span>{Math.round(n.value)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-ink-light overflow-hidden">
              <div
                role="progressbar"
                aria-valuenow={Math.round(n.value)}
                aria-valuemin={0}
                aria-valuemax={100}
                className={`need-bar h-full rounded-full ${n.color}`}
                style={{ width: `${Math.max(0, Math.min(100, n.value))}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 text-xs text-amber-200/40">
        <div className="flex flex-wrap gap-1">
          {Object.entries(player.attributes).slice(0, 5).map(([k, v]) => (
            <span key={k} className="px-1.5 py-0.5 rounded bg-bronze/15 text-amber-200/50">
              {k}: {v}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}