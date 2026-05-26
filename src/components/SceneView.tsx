'use client';

import { SceneDescription } from '@/engine/types';

export default function SceneView({ scene }: { scene: SceneDescription }) {
  return (
    <div className="rounded-lg border border-bronze/30 bg-ink p-5">
      <div className="flex items-baseline gap-2 mb-3">
        <h2 className="text-xl font-bold text-amber-100">{scene.locationName}</h2>
        <span className="text-sm text-amber-200/50">{scene.timeOfDay}</span>
      </div>
      <div className="scene-text text-amber-200/80 text-base leading-relaxed mb-2">
        {scene.description}
      </div>
      {scene.ambience && (
        <div className="scene-text text-amber-200/50 text-sm italic">
          {scene.ambience}
        </div>
      )}
    </div>
  );
}