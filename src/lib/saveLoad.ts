import type { Engine } from '@/engine/Engine';
import type { SaveData } from '@/engine/types';

const SAVE_VERSION = '1.0.0';
const LOCALSTORAGE_KEY_PREFIX = 'worldsim_save_';

/**
 * Serialize the current engine state into a JSON string conforming to SaveData format.
 */
export function exportSaveToJson(engine: Engine): string {
  const saveData: SaveData = {
    version: SAVE_VERSION,
    worldId: engine.getWorldId(),
    worldState: engine.getWorldState(),
    savedAt: new Date().toISOString(),
  };
  return JSON.stringify(saveData, null, 2);
}

/**
 * Trigger a browser file download for the given JSON string.
 */
export function downloadSaveAsFile(json: string, filename: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Read the contents of an uploaded File as a text string.
 */
export async function readUploadedFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Restore engine state from a JSON string representing a SaveData object.
 * Validates version compatibility before applying.
 */
export function importSaveFromJson(engine: Engine, json: string): void {
  const saveData: SaveData = JSON.parse(json);

  if (!saveData.version || !saveData.worldState || !saveData.worldId) {
    throw new Error('Invalid save data: missing required fields');
  }

  if (saveData.worldId !== engine.getWorldId()) {
    throw new Error(
      `Save data is for world "${saveData.worldId}" but current world is "${engine.getWorldId()}"`
    );
  }

  engine.loadWorldState(saveData.worldState);
}

/**
 * Save the JSON string to localStorage keyed by worldId.
 */
export function autoSaveToLocalStorage(worldId: string, json: string): void {
  try {
    localStorage.setItem(LOCALSTORAGE_KEY_PREFIX + worldId, json);
  } catch (error) {
    // localStorage may be full or unavailable; fail silently
    console.warn('Auto-save to localStorage failed:', error);
  }
}

/**
 * Load a previously saved JSON string from localStorage for the given worldId.
 * Returns null if no save exists.
 */
export function loadFromLocalStorage(worldId: string): string | null {
  try {
    return localStorage.getItem(LOCALSTORAGE_KEY_PREFIX + worldId);
  } catch {
    return null;
  }
}