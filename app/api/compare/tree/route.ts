import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { minimatch } from 'minimatch';
import { assertSafePath } from '@/lib/validate';

export interface CompareEntry {
  relativePath: string;
  status: 'left-only' | 'right-only' | 'identical' | 'modified';
  leftPath?: string;
  rightPath?: string;
}

function hashFile(filePath: string): string {
  try {
    const buf = fs.readFileSync(filePath);
    return crypto.createHash('sha1').update(buf).digest('hex');
  } catch {
    return '';
  }
}

/** Returns true if the name or any segment of the rel path matches a pattern */
function isIgnored(name: string, relPath: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (!pattern) continue;
    // Match against bare name
    if (minimatch(name, pattern, { dot: true })) return true;
    // Match against full relative path (e.g. "src/__pycache__/foo.pyc")
    if (minimatch(relPath, pattern, { dot: true, matchBase: true })) return true;
  }
  return false;
}

function walk(dir: string, base: string, result: Set<string>, patterns: string[]) {
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (isIgnored(e.name, rel, patterns)) continue;
    if (e.isDirectory()) walk(path.join(dir, e.name), rel, result, patterns);
    else result.add(rel);
  }
}

export async function GET(req: NextRequest) {
  const left     = req.nextUrl.searchParams.get('left');
  const right    = req.nextUrl.searchParams.get('right');
  const ignoreRaw = req.nextUrl.searchParams.get('ignore') ?? '';

  if (!left || !right) return NextResponse.json({ error: 'left and right required' }, { status: 400 });

  // Comma-separated patterns from query param
  const patterns = ignoreRaw.split(',').map(p => p.trim()).filter(Boolean);

  try {
    const leftDir  = assertSafePath(left);
    const rightDir = assertSafePath(right);

    const leftFiles  = new Set<string>();
    const rightFiles = new Set<string>();
    walk(leftDir,  '', leftFiles,  patterns);
    walk(rightDir, '', rightFiles, patterns);

    const all = new Set([...leftFiles, ...rightFiles]);
    const entries: CompareEntry[] = [];

    for (const rel of [...all].sort()) {
      const hasLeft  = leftFiles.has(rel);
      const hasRight = rightFiles.has(rel);
      const leftPath  = path.join(leftDir, rel);
      const rightPath = path.join(rightDir, rel);

      let status: CompareEntry['status'];
      if (!hasLeft)  status = 'right-only';
      else if (!hasRight) status = 'left-only';
      else status = hashFile(leftPath) === hashFile(rightPath) ? 'identical' : 'modified';

      entries.push({
        relativePath: rel,
        status,
        leftPath:  hasLeft  ? leftPath  : undefined,
        rightPath: hasRight ? rightPath : undefined,
      });
    }

    return NextResponse.json({ entries });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
