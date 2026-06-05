import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

const HOME = os.homedir();
const MAX_DEPTH = 7;
const MAX_MATCHES = 10; // stop early once we have enough candidates

interface SearchResult {
  path: string;
  mtime: number;
  size: number;
}

function walk(dir: string, name: string, isDir: boolean, depth: number, results: SearchResult[]) {
  if (depth > MAX_DEPTH || results.length >= MAX_MATCHES) return;
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue; // skip hidden
    const full = path.join(dir, e.name);
    if (e.name === name && e.isDirectory() === isDir) {
      try {
        const st = fs.statSync(full);
        results.push({ path: full, mtime: st.mtimeMs, size: st.size });
      } catch { /* skip */ }
    }
    // recurse into directories only
    if (e.isDirectory()) walk(full, name, isDir, depth + 1, results);
    if (results.length >= MAX_MATCHES) return;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, mtime, size, isDirectory } = await req.json() as {
      name: string; mtime: number; size: number; isDirectory: boolean;
    };
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

    const candidates: SearchResult[] = [];
    walk(HOME, name, isDirectory, 0, candidates);

    if (candidates.length === 0) {
      return NextResponse.json({ error: `"${name}" not found under home directory` });
    }

    // Best match: closest mtime, then closest size
    candidates.sort((a, b) => {
      const dtA = Math.abs(a.mtime - mtime);
      const dtB = Math.abs(b.mtime - mtime);
      if (dtA !== dtB) return dtA - dtB;
      return Math.abs(a.size - size) - Math.abs(b.size - size);
    });

    return NextResponse.json({ path: candidates[0].path, candidates });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
