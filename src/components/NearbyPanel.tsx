'use client';

import { NearbyAgent, NearbyItem, LocationData } from '@/engine/types';

export default function NearbyPanel({
  agents, items, exits, locations,
}: {
  agents: NearbyAgent[];
  items: NearbyItem[];
  exits: string[];
  locations: Record<string, LocationData>;
}) {
  return (
    <div className="rounded-lg border border-bronze/30 bg-ink p-4">
      <h3 className="text-sm font-bold text-amber-100 mb-3">在此处</h3>

      {agents.length > 0 && (
        <div className="mb-3">
          <span className="text-xs text-amber-200/40 mb-1 block">人物</span>
          <div className="flex flex-wrap gap-2">
            {agents.map(a => (
              <span key={a.id} className="text-sm px-2 py-1 rounded bg-vermillion/20 text-amber-100 border border-vermillion/30">
                {a.name} · {a.currentEmotion}
              </span>
            ))}
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="mb-3">
          <span className="text-xs text-amber-200/40 mb-1 block">物品</span>
          <div className="flex flex-wrap gap-2">
            {items.map(i => (
              <span key={i.id} className="text-sm px-2 py-1 rounded bg-jade/20 text-amber-100 border border-jade/30">
                {i.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {exits.length > 0 && (
        <div>
          <span className="text-xs text-amber-200/40 mb-1 block">可达之地</span>
          <div className="flex flex-wrap gap-2">
            {exits.map(eid => (
              <span key={eid} className="text-sm px-2 py-1 rounded bg-bronze/20 text-amber-200/70 border border-bronze/30">
                {locations[eid]?.name ?? eid}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}