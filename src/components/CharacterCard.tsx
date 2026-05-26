'use client';

import Link from 'next/link';
import { AgentData } from '@/engine/types';

export default function CharacterCard({
  agent,
  worldId,
}: {
  agent: AgentData;
  worldId: string;
}) {
  return (
    <Link
      href={`/world/${worldId}/play?character=${agent.id}`}
      className="block p-4 rounded-lg border border-bronze/40 bg-ink-light hover:border-bronze-light transition-all group"
    >
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-lg font-bold text-amber-100 group-hover:text-bronze-light">
          {agent.name}
        </span>
        <span className="text-xs text-amber-200/40">{agent.gender}</span>
      </div>
      <p className="text-amber-200/60 text-sm mb-3 line-clamp-3">{agent.description}</p>
      <div className="flex gap-2 flex-wrap">
        {Object.entries(agent.attributes).slice(0, 4).map(([key, val]) => (
          <span key={key} className="text-xs px-2 py-0.5 rounded bg-bronze/20 text-amber-200/70">
            {key}: {val}
          </span>
        ))}
      </div>
      {agent.faction && (
        <div className="mt-2 text-xs text-vermillion/60">
          所属: {agent.faction}
        </div>
      )}
    </Link>
  );
}