'use client';

import { useEffect, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useEngine } from '@/hooks/useEngine';
import { useGameSave } from '@/hooks/useGameSave';
import GameUI from '@/components/GameUI';

function PlayContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const worldId = params.worldId as string;
  const characterId = searchParams.get('character') ?? '';

  const engineState = useEngine();
  const saveState = useGameSave(engineState.engine);

  useEffect(() => {
    if (worldId && characterId && !engineState.initialized) {
      engineState.initEngine(worldId, characterId);
    }
  }, [worldId, characterId, engineState.initialized]);

  if (engineState.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <p className="text-amber-300/60 mb-2">正在进入世界...</p>
          <div className="w-16 h-1 bg-bronze/30 rounded mx-auto animate-pulse" />
        </div>
      </div>
    );
  }

  if (engineState.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center max-w-md p-6 rounded-lg border border-vermillion/30 bg-ink">
          <p className="text-red-400 mb-2">{engineState.error}</p>
          <p className="text-amber-200/40 text-sm">请检查世界数据或角色配置是否正确</p>
          <button
            onClick={() => engineState.initEngine(worldId, characterId)}
            className="mt-4 px-4 py-2 rounded border border-bronze/40 text-amber-200/70 hover:border-bronze-light hover:text-amber-100 transition-all"
          >
            重新尝试
          </button>
        </div>
      </div>
    );
  }

  if (!engineState.initialized || !engineState.scene || !engineState.snapshot) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <p className="text-amber-300/60">等待初始化...</p>
      </div>
    );
  }

  return (
    <GameUI
      scene={engineState.scene}
      actions={engineState.actions}
      log={engineState.log}
      snapshot={engineState.snapshot}
      activeDialogue={engineState.activeDialogue}
      currentDialogueLine={engineState.currentDialogueLine}
      dialogueChoices={engineState.dialogueChoices}
      onAction={engineState.performAction}
      onDialogueChoice={engineState.makeDialogueChoice}
      onDialogueAdvance={engineState.advanceDialogue}
      onExportSave={saveState.exportSave}
      onImportSave={saveState.importSave}
      onSaveLocal={saveState.saveToLocal}
      onTick={engineState.tick}
    />
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <p className="text-amber-300/60">加载中...</p>
      </div>
    }>
      <PlayContent />
    </Suspense>
  );
}