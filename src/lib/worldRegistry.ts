export interface WorldRegistryEntry {
  id: string;
  displayName: string;
  description: string;
}

/**
 * Discover available worlds.
 * In development mode: fetches from /api/worlds/ (dynamic API route).
 * In production mode: fetches from /worlds/_index.json (static file).
 */
export async function listAvailableWorlds(): Promise<WorldRegistryEntry[]> {
  const isDev = process.env.NODE_ENV === 'development';

  const url = isDev
    ? '/api/worlds/'
    : '/worlds/_index.json';

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch worlds list: ${response.status}`);
    }
    const data: WorldRegistryEntry[] = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to list available worlds:', error);
    return [];
  }
}