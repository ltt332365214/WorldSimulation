import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import type { WorldConfig } from '@/engine/types';

const WORLDS_DIR = path.resolve(process.cwd(), 'worlds');

interface WorldEntry {
  id: string;
  displayName: string;
  description: string;
}

export async function GET() {
  try {
    if (!fs.existsSync(WORLDS_DIR)) {
      return NextResponse.json([], { status: 200 });
    }

    const dirs = fs.readdirSync(WORLDS_DIR, { withFileTypes: true });
    const worlds: WorldEntry[] = [];

    for (const dir of dirs) {
      if (!dir.isDirectory()) continue;

      const worldJsonPath = path.join(WORLDS_DIR, dir.name, 'world.json');
      if (!fs.existsSync(worldJsonPath)) continue;

      try {
        const raw = fs.readFileSync(worldJsonPath, 'utf-8');
        const config: WorldConfig = JSON.parse(raw);
        worlds.push({
          id: config.id,
          displayName: config.displayName,
          description: config.description,
        });
      } catch {
        // Skip worlds with invalid or unreadable world.json
      }
    }

    return NextResponse.json(worlds, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}