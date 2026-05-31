import fs from 'fs';
import path from 'path';
import os from 'os';

export interface FsEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isGitRepo: boolean;
  size?: number;
  modified?: string;
}

export function resolvePath(p: string): string {
  if (!p || p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return path.resolve(p);
}

export function listDirectory(dirPath: string): FsEntry[] {
  const resolved = resolvePath(dirPath);
  const entries = fs.readdirSync(resolved, { withFileTypes: true });

  return entries
    .filter((e) => !e.name.startsWith('.') || e.name === '.git')
    .filter((e) => e.name !== '.git') // don't show .git as a navigable entry
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
        size: stat?.size,
        modified: stat?.mtime.toISOString(),
      };
    })
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}
