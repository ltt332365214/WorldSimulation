import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

const WORLDS_DIR = path.resolve(process.cwd(), 'worlds');

// Allowed extensions to prevent serving non-data files
const ALLOWED_EXTENSIONS = ['.json'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ worldId: string; path: string[] }> }
) {
  try {
    const { worldId, path: pathSegments } = await params;

    // Reconstruct the sub-path within the world directory
    const filePath = path.join(WORLDS_DIR, worldId, ...pathSegments);

    // Security: ensure the resolved path is within WORLDS_DIR (prevent traversal)
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(WORLDS_DIR))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only allow JSON files
    const ext = path.extname(resolved);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: 'Only JSON files can be served' }, { status: 400 });
    }

    if (!fs.existsSync(resolved)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const raw = fs.readFileSync(resolved, 'utf-8');
    const data = JSON.parse(raw);
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 500 });
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}