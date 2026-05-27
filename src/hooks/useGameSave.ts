'use client';

import { useCallback } from 'react';
import { Engine } from '@/engine/Engine';
import { downloadSaveAsFile, readUploadedFile } from '@/lib/saveLoad';

const SAVE_KEY_PREFIX = 'worldsim_save_';

export function useGameSave(engine: Engine | null, syncState?: (engine: Engine) => void) {
  const exportSave = useCallback(() => {
    if (!engine) return;
    try {
      const json = engine.exportSave();
      const snapshot = engine.getSnapshot();
      const filename = `worldsim_${snapshot.worldId}_${new Date().toISOString().slice(0, 10)}.json`;
      downloadSaveAsFile(json, filename);
    } catch (err) {
      console.error('导出存档失败:', err);
    }
  }, [engine]);

  const importSave = useCallback(async (file: File) => {
    if (!engine) return;
    try {
      const json = await readUploadedFile(file);
      engine.importSave(json);
      if (syncState) syncState(engine);
    } catch (err) {
      console.error('导入存档失败:', err);
      throw err;
    }
  }, [engine, syncState]);

  const saveToLocal = useCallback(() => {
    if (!engine) return;
    try {
      const json = engine.exportSave();
      const snapshot = engine.getSnapshot();
      const key = `${SAVE_KEY_PREFIX}${snapshot.worldId}_${snapshot.playerAgentId}`;
      localStorage.setItem(key, json);
      localStorage.setItem(`${key}_timestamp`, new Date().toISOString());
    } catch (err) {
      console.error('本地保存失败:', err);
    }
  }, [engine]);

  const loadLocalSave = useCallback((worldId: string, playerAgentId: string): boolean => {
    if (!engine) return false;
    const key = `${SAVE_KEY_PREFIX}${worldId}_${playerAgentId}`;
    const json = localStorage.getItem(key);
    if (!json) return false;
    try {
      engine.importSave(json);
      return true;
    } catch (err) {
      console.error('本地加载失败:', err);
      return false;
    }
  }, [engine]);

  const hasLocalSave = useCallback((worldId: string, playerAgentId: string): boolean => {
    const key = `${SAVE_KEY_PREFIX}${worldId}_${playerAgentId}`;
    return localStorage.getItem(key) !== null;
  }, []);

  const getLocalSaveTimestamp = useCallback((worldId: string, playerAgentId: string): string | null => {
    const key = `${SAVE_KEY_PREFIX}${worldId}_${playerAgentId}`;
    return localStorage.getItem(`${key}_timestamp`);
  }, []);

  return {
    exportSave,
    importSave,
    saveToLocal,
    loadLocalSave,
    hasLocalSave,
    getLocalSaveTimestamp,
  };
}