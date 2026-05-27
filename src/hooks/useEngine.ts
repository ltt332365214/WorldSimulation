'use client';

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Engine } from '@/engine/Engine';
import {
  WorldState,
  SceneDescription,
  Action,
  LogEntry,
  DialogueData,
  DialogueLine,
  DialogueChoice,
} from '@/engine/types';

export function useEngine() {
  const engineRef = useRef<Engine | null>(null);
  const [snapshot, setSnapshot] = useState<WorldState | null>(null);
  const [scene, setScene] = useState<SceneDescription | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [activeDialogue, setActiveDialogue] = useState<DialogueData | null>(null);
  const [currentDialogueLine, setCurrentDialogueLine] = useState<DialogueLine | null>(null);
  const [dialogueChoices, setDialogueChoices] = useState<DialogueChoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const syncState = useCallback((engine: Engine) => {
    setSnapshot(engine.getSnapshot());
    setScene(engine.getSceneDescription());
    setActions(engine.getAvailableActions());
    setLog(engine.getLog());

    // Sync dialogue state from engine
    if (engine.isDialogueActive()) {
      const info = engine.getActiveDialogueData();
      if (info) {
        setActiveDialogue(info.data);
        setCurrentDialogueLine(info.currentLine);
        setDialogueChoices(info.choices);
      }
    } else {
      setActiveDialogue(null);
      setCurrentDialogueLine(null);
      setDialogueChoices([]);
    }
  }, []);

  const initEngine = useCallback(async (worldId: string, playerId: string) => {
    setLoading(true);
    setError(null);
    try {
      const engine = new Engine();
      await engine.init(worldId, playerId);
      engineRef.current = engine;

      syncState(engine);
      setInitialized(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '初始化失败');
    } finally {
      setLoading(false);
    }
  }, [syncState]);

  const performAction = useCallback((action: Action) => {
    const engine = engineRef.current;
    if (!engine) return;

    try {
      engine.performAction(action);
      syncState(engine);
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    }
  }, [syncState]);

  const tick = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    try {
      engine.tick();
      syncState(engine);
    } catch (err) {
      setError(err instanceof Error ? err.message : '时间推进失败');
    }
  }, [syncState]);

  const startDialogue = useCallback((dialogueId: string) => {
    const engine = engineRef.current;
    if (!engine) return;

    engine.startDialogue(dialogueId);
    syncState(engine);
  }, [syncState]);

  const makeDialogueChoice = useCallback((choiceIndex: number) => {
    const engine = engineRef.current;
    if (!engine) return;

    engine.makeDialogueChoice(choiceIndex);
    syncState(engine);
  }, [syncState]);

  const advanceDialogue = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    engine.advanceDialogue();
    syncState(engine);
  }, [syncState]);

  const exportSave = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return '';
    return engine.exportSave();
  }, []);

  const importSave = useCallback((json: string) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.importSave(json);
    syncState(engine);
  }, [syncState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      engineRef.current = null;
    };
  }, []);

  return useMemo(() => ({
    engine: engineRef.current,
    snapshot,
    scene,
    actions,
    log,
    activeDialogue,
    currentDialogueLine,
    dialogueChoices,
    loading,
    error,
    initialized,
    initEngine,
    performAction,
    tick,
    startDialogue,
    makeDialogueChoice,
    advanceDialogue,
    exportSave,
    importSave,
    syncState,
  }), [
    snapshot,
    scene,
    actions,
    log,
    activeDialogue,
    currentDialogueLine,
    dialogueChoices,
    loading,
    error,
    initialized,
    initEngine,
    performAction,
    tick,
    startDialogue,
    makeDialogueChoice,
    advanceDialogue,
    exportSave,
    importSave,
    syncState,
  ]);
}