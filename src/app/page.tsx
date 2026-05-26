'use client';

import { useState, useEffect } from 'react';
import WorldCard from '@/components/WorldCard';

interface WorldEntry {
  id: string;
  displayName: string;
  description: string;
}

export default function HomePage() {
  const [worlds, setWorlds] = useState<WorldEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/worlds/_index.json')
      .then(r => r.json())
      .then(data => setWorlds(data))
      .catch(() => setWorlds([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-900">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-amber-100 mb-3">世界模拟引擎</h1>
        <p className="text-amber-200/70 max-w-lg mx-auto leading-relaxed">
          用代码，模拟一个有呼吸的世界。<br />
          选择一个世界，扮演其中的人物，体验另一种人生。
        </p>
        <div className="w-24 h-0.5 bg-bronze/40 mx-auto mt-4" />
      </div>

      {loading ? (
        <div className="text-center">
          <p className="text-amber-300/60 mb-2">正在加载世界列表...</p>
          <div className="w-16 h-1 bg-bronze/30 rounded mx-auto animate-pulse" />
        </div>
      ) : worlds.length === 0 ? (
        <div className="text-center p-8 rounded-lg border border-bronze/20 bg-ink-light">
          <p className="text-amber-300/60">暂无可用世界</p>
          <p className="text-amber-200/40 text-sm mt-2">请确保 public/worlds/ 目录中有世界数据</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl">
          {worlds.map(world => (
            <WorldCard key={world.id} world={world} />
          ))}
        </div>
      )}
    </main>
  );
}