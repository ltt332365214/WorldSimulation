'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { WorldConfig, AgentData } from '@/engine/types';
import CharacterCard from '@/components/CharacterCard';

function CharacterSelectContent() {
  const params = useParams();
  const worldId = params.worldId as string;

  const [config, setConfig] = useState<WorldConfig | null>(null);
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const configRes = await fetch(`/worlds/${worldId}/world.json`);
        if (!configRes.ok) throw new Error('加载世界配置失败');
        const configData = await configRes.json();
        setConfig(configData);

        const indexRes = await fetch(`/worlds/${worldId}/agents/_index.json`);
        const agentFiles: string[] = await indexRes.json();

        const agentList: AgentData[] = [];
        for (const file of agentFiles) {
          if (!file.startsWith('_')) {
            const res = await fetch(`/worlds/${worldId}/agents/${file}`);
            const data: AgentData = await res.json();
            agentList.push(data);
          }
        }
        setAgents(agentList);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [worldId]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <p className="text-amber-300/60">加载中...</p>
    </div>
  );
  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <p className="text-red-400">{error}</p>
    </div>
  );

  return (
    <main className="min-h-screen p-8 bg-gray-900">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-amber-200/60 hover:text-amber-100 mb-6 block text-sm">
          &larr; 返回世界列表
        </Link>

        <h1 className="text-3xl font-bold text-amber-100 mb-2">{config?.displayName ?? worldId}</h1>
        <p className="text-amber-200/60 mb-8 max-w-lg">{config?.description ?? ''}</p>

        <div className="w-24 h-0.5 bg-bronze/40 mb-6" />

        <h2 className="text-lg text-amber-100 mb-4">选择你要扮演的角色：</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map(agent => (
            <CharacterCard key={agent.id} agent={agent} worldId={worldId} />
          ))}
        </div>
      </div>
    </main>
  );
}

export default function CharacterSelectPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <p className="text-amber-300/60">加载中...</p>
      </div>
    }>
      <CharacterSelectContent />
    </Suspense>
  );
}