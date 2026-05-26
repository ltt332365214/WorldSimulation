'use client';

import Link from 'next/link';

interface WorldEntry {
  id: string;
  displayName: string;
  description: string;
}

export default function WorldCard({ world }: { world: WorldEntry }) {
  return (
    <Link
      href={`/world/${world.id}`}
      className="block p-6 rounded-lg border border-bronze/50 bg-ink-light hover:border-bronze-light hover:bg-ink-light/80 transition-all group"
    >
      <h2 className="text-xl font-bold text-amber-100 group-hover:text-bronze-light mb-3">
        {world.displayName}
      </h2>
      <p className="text-amber-200/60 text-sm leading-relaxed">
        {world.description}
      </p>
    </Link>
  );
}