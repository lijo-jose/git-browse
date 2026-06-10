import { spawnSync } from 'child_process';

export interface GrepMatch {
  file: string;
  line: number;
  text: string;
}

export interface GrepResult {
  matches: GrepMatch[];
  truncated: boolean;
}

export interface FindResult {
  paths: string[];
  truncated: boolean;
}

// Relies on Unix grep/find; Windows lacks grep and its find.exe is a
// different tool entirely, so search is disabled there for now.
export const searchSupported = process.platform !== 'win32';

const MAX_RESULTS = 500;
const MAX_BUFFER = 16 * 1024 * 1024;
const EXCLUDED_DIRS = ['.git', 'node_modules', '.next', 'dist', 'build'];

/**
 * Runs the system `grep` recursively in `dir`. The pattern is passed as a
 * plain argv element (no shell), so user input cannot inject commands.
 */
export function grepSearch(dir: string, pattern: string, opts: { ignoreCase?: boolean; regex?: boolean } = {}): GrepResult {
  const args = ['-rnI', ...EXCLUDED_DIRS.map(d => `--exclude-dir=${d}`)];
  if (opts.ignoreCase) args.push('-i');
  if (!opts.regex) args.push('-F');
  args.push('-e', pattern, '--', dir);

  const res = spawnSync('grep', args, { encoding: 'utf8', maxBuffer: MAX_BUFFER });
  // grep exits 1 when nothing matched, >1 on real errors
  if (res.status !== null && res.status > 1) {
    throw new Error(res.stderr?.trim() || 'grep failed');
  }

  const lines = (res.stdout || '').split('\n').filter(Boolean);
  const truncated = lines.length > MAX_RESULTS;
  const matches: GrepMatch[] = [];
  for (const line of lines.slice(0, MAX_RESULTS)) {
    // file:line:text — file paths can't contain ":" followed by digits + ":" ambiguity in practice for our use
    const m = line.match(/^(.*?):(\d+):(.*)$/);
    if (m) matches.push({ file: m[1], line: Number(m[2]), text: m[3] });
  }
  return { matches, truncated };
}

/**
 * Runs the system `find` in `dir`, matching file/folder names
 * case-insensitively. A bare term is wrapped as *term*.
 */
export function findFiles(dir: string, pattern: string): FindResult {
  const glob = /[*?[]/.test(pattern) ? pattern : `*${pattern}*`;
  const args = [
    dir,
    '(', ...EXCLUDED_DIRS.flatMap((d, i) => (i ? ['-o', '-name', d] : ['-name', d])), ')', '-prune',
    '-o', '-iname', glob, '-print',
  ];

  const res = spawnSync('find', args, { encoding: 'utf8', maxBuffer: MAX_BUFFER });
  if (res.status !== 0 && !res.stdout) {
    throw new Error(res.stderr?.trim() || 'find failed');
  }

  const lines = (res.stdout || '').split('\n').filter(Boolean);
  return { paths: lines.slice(0, MAX_RESULTS), truncated: lines.length > MAX_RESULTS };
}
