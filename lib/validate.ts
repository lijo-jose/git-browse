import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Confirms the supplied path is:
 *   1. An absolute path (no traversal tricks)
 *   2. Inside the user's home directory (prevents access to /etc, /usr, etc.)
 *   3. An actual git repository (has a .git entry)
 *
 * Returns the resolved path on success, throws on failure.
 */
export function assertGitRepo(raw: string): string {
  if (!raw || typeof raw !== 'string') throw new Error('Invalid path');

  const resolved = path.resolve(raw);
  const home = os.homedir();

  // Must be inside home dir
  if (!resolved.startsWith(home + path.sep) && resolved !== home) {
    throw new Error('Path is outside the home directory');
  }

  // Must have a .git directory or file (worktrees use a .git file)
  const gitEntry = path.join(resolved, '.git');
  if (!fs.existsSync(gitEntry)) {
    throw new Error('Not a git repository');
  }

  return resolved;
}

/**
 * Validates a filesystem browse path — must be inside home dir but
 * does NOT require a .git repo (used by the file explorer).
 */
export function assertSafePath(raw: string): string {
  if (!raw || typeof raw !== 'string') throw new Error('Invalid path');

  // Resolve ~ shorthand
  let resolved: string;
  if (raw === '~') resolved = os.homedir();
  else if (raw.startsWith('~/')) resolved = path.join(os.homedir(), raw.slice(2));
  else resolved = path.resolve(raw);

  const home = os.homedir();
  if (!resolved.startsWith(home + path.sep) && resolved !== home) {
    throw new Error('Path is outside the home directory');
  }

  return resolved;
}
