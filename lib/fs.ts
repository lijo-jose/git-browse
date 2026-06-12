import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

export interface FsEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isGitRepo: boolean;
  branch?: string;
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

function readBranch(repoPath: string): string | undefined {
  try {
    let gitDir = path.join(repoPath, '.git');
    const stat = fs.statSync(gitDir);
    if (stat.isFile()) {
      // Worktree/submodule: .git is a file pointing to the real git dir
      const m = fs.readFileSync(gitDir, 'utf8').match(/^gitdir:\s*(.+)$/m);
      if (!m) return undefined;
      gitDir = path.resolve(repoPath, m[1].trim());
    }
    const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
    const ref = head.match(/^ref:\s*refs\/heads\/(.+)$/);
    if (ref) return ref[1];
    return head.slice(0, 7); // detached HEAD
  } catch {
    return undefined;
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
        branch: isGitRepo ? readBranch(fullPath) : undefined,
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
