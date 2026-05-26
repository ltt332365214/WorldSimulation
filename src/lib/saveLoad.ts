/**
 * Utility functions for save/load operations.
 * The Engine class itself handles serialization via exportSave()/importSave().
 * These helpers handle file I/O and localStorage persistence.
 */

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
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsText(file);
  });
}

const LOCALSTORAGE_KEY_PREFIX = 'worldsim_save_';

/**
 * Save the JSON string to localStorage keyed by worldId and playerAgentId.
 */
export function autoSaveToLocalStorage(key: string, json: string): void {
  try {
    localStorage.setItem(LOCALSTORAGE_KEY_PREFIX + key, json);
    localStorage.setItem(LOCALSTORAGE_KEY_PREFIX + key + '_timestamp', new Date().toISOString());
  } catch (error) {
    console.warn('本地保存失败:', error);
  }
}

/**
 * Load a previously saved JSON string from localStorage.
 * Returns null if no save exists.
 */
export function loadFromLocalStorage(key: string): string | null {
  try {
    return localStorage.getItem(LOCALSTORAGE_KEY_PREFIX + key);
  } catch {
    return null;
  }
}

/**
 * Check if a local save exists.
 */
export function hasLocalSave(key: string): boolean {
  try {
    return localStorage.getItem(LOCALSTORAGE_KEY_PREFIX + key) !== null;
  } catch {
    return false;
  }
}

/**
 * Get the timestamp of a local save.
 */
export function getLocalSaveTimestamp(key: string): string | null {
  try {
    return localStorage.getItem(LOCALSTORAGE_KEY_PREFIX + key + '_timestamp');
  } catch {
    return null;
  }
}