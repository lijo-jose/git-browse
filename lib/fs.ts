import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

export interface FsEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isGitRepo: boolean;
  isIgnored?: boolean;
  size?: number;
  modified?: string;
}

function getIgnoredNames(dirPath: string, names: string[]): Set<string> {
  try {
    const input = names.join('\0');
    const out = execSync('git check-ignore -z --stdin', {
      cwd: dirPath,
      input,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return new Set(out.split('\0').map(p => path.basename(p)).filter(Boolean));
  } catch {
    return new Set();
  }
}

export function resolvePath(p: string): string {
  if (!p || p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return path.resolve(p);
}

export function listDirectory(dirPath: string): FsEntry[] {
  const resolved = resolvePath(dirPath);
  const entries = fs.readdirSync(resolved, { withFileTypes: true });

  const visible = entries
    .filter((e) => !e.name.startsWith('.') || e.name === '.git')
    .filter((e) => e.name !== '.git');

  const ignoredNames = getIgnoredNames(resolved, visible.map(e => e.name));

  return visible
    .map((e) => {
      const fullPath = path.join(resolved, e.name);
      const isDir = e.isDirectory();
      let isGitRepo = false;
      if (isDir) {
        try {
          isGitRepo = fs.existsSync(path.join(fullPath, '.git'));
        } catch {
          // ignore
        }
      }
      let stat: fs.Stats | undefined;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        // ignore
      }
      return {
        name: e.name,
        path: fullPath,
        isDirectory: isDir,
        isGitRepo,
        isIgnored: ignoredNames.has(e.name),
        size: stat?.size,
        modified: stat?.mtime.toISOString(),
      };
    })
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}
