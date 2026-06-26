import simpleGit, { SimpleGit, LogResult } from 'simple-git';
import { execSync } from 'child_process';
import { mkdtempSync, writeFileSync, existsSync, rmSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join, isAbsolute } from 'path';

export function getGit(repoPath: string): SimpleGit {
  return simpleGit(repoPath);
}

export interface GitFileStatus {
  path: string;
  status: 'M' | 'A' | 'D' | '?' | 'R' | 'C' | 'U';
  staged: boolean;
  index?: string;
  working?: string;
  fileSize?: number;
}

export async function getStatus(repoPath: string): Promise<GitFileStatus[]> {
  const git = getGit(repoPath);
  const status = await git.status();
  const files: GitFileStatus[] = [];

  for (const f of status.files) {
    const index = f.index.trim();
    const working = f.working_dir.trim();
    if (index && index !== ' ' && index !== '?') {
      const fileSize = (index === 'A') ? getFileSize(join(repoPath, f.path)) : undefined;
      files.push({ path: f.path, status: mapStatus(index), staged: true, index, working, fileSize });
    }
    if (working && working !== ' ') {
      const fileSize = (working === '?') ? getFileSize(join(repoPath, f.path)) : undefined;
      files.push({ path: f.path, status: mapStatus(working), staged: false, index, working, fileSize });
    }
  }
  return files;
}

function getFileSize(filePath: string): number | undefined {
  try { return statSync(filePath).size; } catch { return undefined; }
}

function mapStatus(s: string): GitFileStatus['status'] {
  const map: Record<string, GitFileStatus['status']> = {
    M: 'M', A: 'A', D: 'D', '?': '?', R: 'R', C: 'C', U: 'U',
  };
  return map[s] || 'M';
}

// ── Graph log ────────────────────────────────────────────────────────────────

export interface GraphLine {
  /** 'commit' has hash/message/etc; 'graph' is a connector-only row */
  type: 'commit' | 'graph';
  graph: string;      // the raw graph prefix characters for this row
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  refs: string;       // raw --decorate string, e.g. "HEAD -> main, origin/main, tag: v1"
}

// Use a rare Unicode delimiter that won't appear in git output
const SEP = '␞';  // ␞  (SYMBOL FOR RECORD SEPARATOR)
const MARKER = 'GITROW␞';

export function getLog(repoPath: string, page = 0, limit = 50, all = false): GraphLine[] {
  const skip = page * limit;
  const allFlag = all ? '--all ' : '';
  const raw = execSync(
    `git log --graph ${allFlag}--pretty=format:"${MARKER}%H${SEP}%h${SEP}%s${SEP}%an${SEP}%ar${SEP}%D" --skip=${skip} -n ${limit}`,
    { cwd: repoPath, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
  );

  const lines = raw.split('\n');
  const result: GraphLine[] = [];

  for (const line of lines) {
    const markerIdx = line.indexOf(MARKER);
    if (markerIdx !== -1) {
      const graphPrefix = line.slice(0, markerIdx);
      const rest = line.slice(markerIdx + MARKER.length);
      const parts = rest.split(SEP);
      result.push({
        type: 'commit',
        graph: graphPrefix,
        hash:      parts[0] ?? '',
        shortHash: parts[1] ?? '',
        message:   parts[2] ?? '',
        author:    parts[3] ?? '',
        date:      parts[4] ?? '',
        refs:      parts[5] ?? '',
      });
    } else if (line.trim()) {
      // Connector-only row (pure graph lines between commits)
      result.push({
        type: 'graph',
        graph: line,
        hash: '', shortHash: '', message: '', author: '', date: '', refs: '',
      });
    }
  }
  return result;
}

// ── Commit files ─────────────────────────────────────────────────────────────

export interface CommitFile { path: string; status: string; }

export function getCommitFiles(repoPath: string, commit: string): CommitFile[] {
  const raw = execSync(
    `git diff-tree --no-commit-id -r --name-status ${commit}`,
    { cwd: repoPath, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
  );
  return raw.split('\n').filter(Boolean).map(line => {
    const tab = line.indexOf('\t');
    return { status: line.slice(0, tab).trim(), path: line.slice(tab + 1).trim() };
  });
}

// ── Diff ─────────────────────────────────────────────────────────────────────

export async function getSyncStatus(repoPath: string): Promise<{ ahead: number; behind: number; tracking: string | null }> {
  const git = getGit(repoPath);
  const s = await git.status();
  return { ahead: s.ahead, behind: s.behind, tracking: s.tracking };
}

export async function getDiff(
  repoPath: string,
  file?: string,
  commit?: string
): Promise<string> {
  const git = getGit(repoPath);
  if (commit) {
    return file
      ? git.show([`${commit}`, '--', file])
      : git.show([commit, '--stat', '-p']);
  }
  if (file) {
    try {
      const staged = await git.diff(['--cached', '--', file]);
      if (staged) return staged;
    } catch { /* fall through */ }
    return git.diff(['--', file]);
  }
  return git.diff();
}

export async function getPatch(repoPath: string, files?: string[]): Promise<string> {
  const git = getGit(repoPath);
  const hasCommits = (() => {
    try { execSync('git rev-parse HEAD', { cwd: repoPath, stdio: 'ignore' }); return true; }
    catch { return false; }
  })();
  const base = hasCommits ? ['HEAD'] : ['--cached'];
  const args = files && files.length > 0 ? [...base, '--', ...files] : base;
  return git.diff(args);
}

export async function applyPatch(repoPath: string, patchContent: string): Promise<string> {
  const tmpFile = join(tmpdir(), `git-tree-patch-${Date.now()}.patch`);
  writeFileSync(tmpFile, patchContent, 'utf8');
  try {
    execSync(`git apply ${JSON.stringify(tmpFile)}`, { cwd: repoPath, encoding: 'utf8' });
    return 'Patch applied successfully';
  } finally {
    try { rmSync(tmpFile); } catch { /* ignore */ }
  }
}

// ── Branch/commit compare ─────────────────────────────────────────────────────

export interface CompareFile { path: string; status: string; insertions: number; deletions: number; }

export async function getCompareRefs(repoPath: string): Promise<{ branches: string[]; tags: string[]; recent: { hash: string; short: string; subject: string }[] }> {
  const git = getGit(repoPath);
  const [rawBranches, tagResult, rawLog] = await Promise.all([
    git.raw(['branch', '-a', '--sort=-committerdate', '--format=%(refname:short)']),
    git.tags(['--sort=-creatordate']),
    git.raw(['log', '--pretty=format:%H%x00%h%x00%s', '-20']),
  ]);
  const branches = rawBranches.trim().split('\n').filter(Boolean);
  const tags = tagResult.all.filter(Boolean);
  const recent = rawLog.trim().split('\n').filter(Boolean).map(line => {
    const [hash, short, ...rest] = line.split('\x00');
    return { hash, short, subject: rest.join('\x00') };
  });
  return { branches, tags, recent };
}

export async function getCompareFiles(repoPath: string, base: string, target = 'HEAD'): Promise<CompareFile[]> {
  const git = getGit(repoPath);
  const raw = await git.raw(['diff', '--numstat', `${base}...${target}`]);
  return raw.trim().split('\n').filter(Boolean).map(line => {
    const [ins, del, ...pathParts] = line.split('\t');
    const fullPath = pathParts.join('\t');
    // handle renames: "{old => new}" or "old/path => new/path"
    const path = fullPath.replace(/\{([^}]*) => ([^}]*)\}/, '$2').replace(/ => /, '/');
    return { path, status: 'M', insertions: parseInt(ins) || 0, deletions: parseInt(del) || 0 };
  });
}

export async function getCompareDiff(repoPath: string, base: string, file?: string, target = 'HEAD'): Promise<string> {
  const git = getGit(repoPath);
  if (file) return git.raw(['diff', `${base}...${target}`, '--', file]);
  return git.raw(['diff', `${base}...${target}`]);
}

// ── Branches ─────────────────────────────────────────────────────────────────

export interface BranchInfo {
  name: string;
  current: boolean;
  remote: boolean;
  lastCommit?: string;
  lastCommitDate?: string;
}

export async function getBranches(repoPath: string): Promise<BranchInfo[]> {
  // Use NUL as field separator and newline as record separator to avoid any
  // clash with pipe characters that appear in commit subjects.
  const raw = execSync(
    "git branch -a --sort=-committerdate --format='%(refname:short)%00%(HEAD)%00%(committerdate:relative)%00%(subject)'",
    { cwd: repoPath, encoding: 'utf8' }
  );
  return raw.split('\n').filter(Boolean).map((line) => {
    const [name, head, date, ...subjectParts] = line.split('\x00');
    return {
      name,
      current: head === '*',
      remote: name.startsWith('remotes/'),
      lastCommitDate: date,
      lastCommit: subjectParts.join('\x00'), // re-join in the impossible case subject had NUL
    };
  });
}

// For each local branch, how far it has diverged from the current HEAD:
// ahead = commits the branch has that HEAD lacks, behind = commits HEAD has that the branch lacks.
export async function getBranchDivergence(repoPath: string): Promise<Record<string, { ahead: number; behind: number }>> {
  const branches = await getBranches(repoPath);
  const out: Record<string, { ahead: number; behind: number }> = {};
  for (const b of branches.filter(br => !br.remote && !br.current)) {
    try {
      const raw = execSync(`git rev-list --left-right --count HEAD..."${b.name}"`, { cwd: repoPath, encoding: 'utf8' });
      const [behind, ahead] = raw.trim().split(/\s+/).map(Number);
      if (ahead > 0 || behind > 0) out[b.name] = { ahead, behind };
    } catch { /* skip branches that can't be compared (e.g. unborn) */ }
  }
  return out;
}

export async function checkoutBranch(repoPath: string, branch: string): Promise<void> {
  await getGit(repoPath).checkout(branch);
}

// ── Stash ────────────────────────────────────────────────────────────────────

export interface StashEntry { index: number; message: string; date?: string; }

export async function getStash(repoPath: string): Promise<StashEntry[]> {
  const git = getGit(repoPath);
  const result = await git.stashList();
  return (result.all || []).map((s: LogResult['all'][0], i: number) => ({
    index: i, message: s.message, date: s.date,
  }));
}

export async function applyStash(repoPath: string, index: number): Promise<void> {
  await getGit(repoPath).stash(['apply', `stash@{${index}}`]);
}

export async function dropStash(repoPath: string, index: number): Promise<void> {
  await getGit(repoPath).stash(['drop', `stash@{${index}}`]);
}

export async function popStash(repoPath: string, index: number): Promise<void> {
  await getGit(repoPath).stash(['pop', `stash@{${index}}`]);
}

// ── Remote ops ───────────────────────────────────────────────────────────────

export async function fetchRepo(repoPath: string): Promise<string> {
  const result = await getGit(repoPath).fetch();
  return JSON.stringify(result);
}

export async function pullRepo(repoPath: string): Promise<string> {
  const result = await getGit(repoPath).pull();
  return `${result.summary.changes} changes, ${result.summary.insertions} insertions, ${result.summary.deletions} deletions`;
}

// ── Staging ───────────────────────────────────────────────────────────────────

export async function stageFiles(repoPath: string, files: string[]): Promise<void> {
  await getGit(repoPath).add(files);
}

// ── Commit ────────────────────────────────────────────────────────────────────

export async function commitChanges(repoPath: string, message: string, all: boolean): Promise<string> {
  const args: string[] = ['-m', message];
  if (all) args.unshift('-a');
  const result = await getGit(repoPath).commit(message, all ? ['-a'] : []);
  return result.summary.changes !== undefined
    ? `Committed: ${result.commit}`
    : `Committed: ${result.commit}`;
}

// ── Tag ───────────────────────────────────────────────────────────────────────

export interface TagInfo { name: string; date: string; subject: string; }

export async function getTags(repoPath: string): Promise<TagInfo[]> {
  const raw = execSync(
    "git tag --sort=-creatordate --format='%(refname:short)%00%(creatordate:relative)%00%(subject)'",
    { cwd: repoPath, encoding: 'utf8' }
  );
  return raw.split('\n').filter(Boolean).map((line) => {
    const [name, date, ...subjectParts] = line.split('\x00');
    return { name, date, subject: subjectParts.join('\x00') };
  });
}

export async function createAndPushTag(repoPath: string, tag: string): Promise<string> {
  const git = getGit(repoPath);
  await git.tag([tag]);
  await git.push(['origin', tag]);
  return `Tagged and pushed: ${tag}`;
}

// ── Checkout file(s) ─────────────────────────────────────────────────────────

export async function checkoutFiles(repoPath: string, files: string[]): Promise<void> {
  await getGit(repoPath).checkout(['--', ...files]);
}

export async function checkoutAllFiles(repoPath: string): Promise<void> {
  await getGit(repoPath).checkout(['.']);
}

// ── Create branch ─────────────────────────────────────────────────────────────

export async function createBranch(repoPath: string, name: string): Promise<void> {
  await getGit(repoPath).checkoutLocalBranch(name);
}

// ── Delete branch ─────────────────────────────────────────────────────────────

export async function deleteBranch(repoPath: string, name: string, force = false): Promise<void> {
  await getGit(repoPath).deleteLocalBranch(name, force);
}

// ── Merge ─────────────────────────────────────────────────────────────────────

export async function mergeBranch(repoPath: string, branch: string): Promise<string> {
  const result = await getGit(repoPath).merge([branch]);
  return `Merged ${branch}: ${result.result}`;
}

// ── Rebase ────────────────────────────────────────────────────────────────────

export async function rebaseBranch(repoPath: string, branch: string): Promise<string> {
  await getGit(repoPath).rebase([branch]);
  return `Rebased onto ${branch}`;
}

// ── Interactive rebase ────────────────────────────────────────────────────────

export interface RebaseCommit {
  hash: string;
  shortHash: string;
  subject: string;
  author: string;
  date: string;
}

/** Commits that an interactive rebase onto `base` would replay (oldest first). */
export function getRebaseCommits(repoPath: string, base: string): RebaseCommit[] {
  const raw = execSync(
    `git log --reverse --pretty=format:"%H%x00%h%x00%s%x00%an%x00%ar" ${JSON.stringify(base)}..HEAD`,
    { cwd: repoPath, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
  );
  return raw.split('\n').filter(Boolean).map(line => {
    const [hash, shortHash, subject, author, date] = line.split('\x00');
    return { hash, shortHash, subject, author, date };
  });
}

export type RebaseAction = 'pick' | 'reword' | 'squash' | 'fixup' | 'drop';

export interface RebaseTodoEntry {
  hash: string;
  action: RebaseAction;
  /** New commit message — used by reword, and optionally by squash to override the combined message. */
  message?: string;
}

export interface RebaseState {
  inProgress: boolean;
  conflicts: string[];
  /** Short hash of the commit being replayed when stopped, if known. */
  stoppedAt?: string;
}

export function getRebaseState(repoPath: string): RebaseState {
  const gitDir = execSync('git rev-parse --git-dir', { cwd: repoPath, encoding: 'utf8' }).trim();
  const abs = isAbsolute(gitDir) ? gitDir : join(repoPath, gitDir);
  const inProgress = existsSync(join(abs, 'rebase-merge')) || existsSync(join(abs, 'rebase-apply'));
  if (!inProgress) return { inProgress: false, conflicts: [] };
  const conflicts = execSync('git diff --name-only --diff-filter=U', { cwd: repoPath, encoding: 'utf8' })
    .split('\n').filter(Boolean);
  let stoppedAt: string | undefined;
  const stoppedFile = join(abs, 'rebase-merge', 'stopped-sha');
  if (existsSync(stoppedFile)) {
    stoppedAt = execSync('git rev-parse --short REBASE_HEAD', { cwd: repoPath, encoding: 'utf8' }).trim();
  }
  return { inProgress: true, conflicts, stoppedAt };
}

/**
 * Run a non-terminal `git rebase -i` by injecting a generated todo list via
 * GIT_SEQUENCE_EDITOR. Reword/squash messages are applied with
 * `exec git commit --amend -F <file>` lines so no interactive editor is needed.
 */
export function interactiveRebase(repoPath: string, base: string, todo: RebaseTodoEntry[]): string {
  if (!todo.length) throw new Error('No commits to rebase');
  const first = todo.find(t => t.action !== 'drop');
  if (first && (first.action === 'squash' || first.action === 'fixup')) {
    throw new Error('The first kept commit cannot be squash/fixup — it has no previous commit to fold into');
  }

  const dir = mkdtempSync(join(tmpdir(), 'git-tree-rebase-'));
  try {
    const lines: string[] = [];
    todo.forEach((t, i) => {
      const hash = t.hash.trim();
      if (!/^[0-9a-f]{4,40}$/i.test(hash)) throw new Error(`Invalid commit hash: ${hash}`);
      switch (t.action) {
        case 'drop':
          lines.push(`drop ${hash}`);
          break;
        case 'fixup':
          lines.push(`fixup ${hash}`);
          break;
        case 'squash':
          // GIT_EDITOR=true keeps git's auto-combined message; an explicit
          // message is applied afterwards via exec amend.
          lines.push(`squash ${hash}`);
          if (t.message?.trim()) lines.push(`exec git commit --amend -F ${msgFile(dir, i, t.message)}`);
          break;
        case 'reword':
          if (!t.message?.trim()) throw new Error(`Reword for ${hash} requires a message`);
          lines.push(`pick ${hash}`);
          lines.push(`exec git commit --amend -F ${msgFile(dir, i, t.message)}`);
          break;
        default:
          lines.push(`pick ${hash}`);
      }
    });

    const todoFile = join(dir, 'todo.txt');
    writeFileSync(todoFile, lines.join('\n') + '\n');
    // Tiny editor that replaces git's generated todo with ours (portable, no shell quoting issues).
    const seqEditor = join(dir, 'seq-editor.js');
    writeFileSync(seqEditor, `require('fs').copyFileSync(process.env.GT_TODO_FILE, process.argv[2]);`);

    execSync(`git rebase -i ${JSON.stringify(base)}`, {
      cwd: repoPath,
      encoding: 'utf8',
      env: {
        ...process.env,
        GT_TODO_FILE: todoFile,
        GIT_SEQUENCE_EDITOR: `"${process.execPath.replace(/\\/g, '/')}" "${seqEditor.replace(/\\/g, '/')}"`,
        GIT_EDITOR: 'true',
      },
    });
    return `Interactively rebased onto ${base}`;
  } finally {
    // The rebase may still reference message files if it stopped on a conflict
    // before reaching an exec line; only clean up when no rebase is in progress.
    try { if (!getRebaseState(repoPath).inProgress) rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

function msgFile(dir: string, i: number, message: string): string {
  const file = join(dir, `msg-${i}.txt`);
  writeFileSync(file, message.trim() + '\n');
  // exec lines run through git's sh even on Windows — forward slashes + quotes are safe.
  return `"${file.replace(/\\/g, '/')}"`;
}

export function continueRebase(repoPath: string): RebaseState {
  execSync('git rebase --continue', {
    cwd: repoPath, encoding: 'utf8',
    env: { ...process.env, GIT_EDITOR: 'true' },
  });
  return getRebaseState(repoPath);
}

export function abortRebase(repoPath: string): void {
  execSync('git rebase --abort', { cwd: repoPath, encoding: 'utf8' });
}

export function skipRebase(repoPath: string): RebaseState {
  execSync('git rebase --skip', {
    cwd: repoPath, encoding: 'utf8',
    env: { ...process.env, GIT_EDITOR: 'true' },
  });
  return getRebaseState(repoPath);
}

// ── Remotes / repo info ───────────────────────────────────────────────────────

export interface RemoteInfo { name: string; fetchUrl: string; pushUrl: string; }

export async function getRemotes(repoPath: string): Promise<RemoteInfo[]> {
  const raw = execSync('git remote -v', { cwd: repoPath, encoding: 'utf8' });
  const map = new Map<string, RemoteInfo>();
  for (const line of raw.split('\n').filter(Boolean)) {
    const m = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);
    if (!m) continue;
    const [, name, url, type] = m;
    if (!map.has(name)) map.set(name, { name, fetchUrl: '', pushUrl: '' });
    const entry = map.get(name)!;
    if (type === 'fetch') entry.fetchUrl = url;
    else entry.pushUrl = url;
  }
  return [...map.values()];
}

export interface RepoInfo {
  headBranch: string;
  headCommit: string;
  remotes: RemoteInfo[];
  totalCommits: number;
  repoPath: string;
}

export async function getRepoInfo(repoPath: string): Promise<RepoInfo> {
  const git = getGit(repoPath);
  const [branch, rev, remotes] = await Promise.all([
    git.revparse(['--abbrev-ref', 'HEAD']).catch(() => 'unknown'),
    git.revparse(['--short', 'HEAD']).catch(() => ''),
    getRemotes(repoPath),
  ]);
  const countRaw = execSync('git rev-list --count HEAD', { cwd: repoPath, encoding: 'utf8' }).trim();
  return {
    headBranch: branch.trim(),
    headCommit: rev.trim(),
    remotes,
    totalCommits: parseInt(countRaw, 10) || 0,
    repoPath,
  };
}

// ── Stash push ────────────────────────────────────────────────────────────────

export async function pushStash(repoPath: string, message?: string): Promise<string> {
  const args = message ? ['push', '-m', message] : ['push'];
  await getGit(repoPath).stash(args);
  return message ? `Stashed: ${message}` : 'Stashed changes';
}

// ── Push ──────────────────────────────────────────────────────────────────────

export async function pushBranch(
  repoPath: string,
  setUpstream: boolean,
  branch: string,
  remote?: string,
): Promise<string> {
  const git = getGit(repoPath);
  if (setUpstream) {
    const target = remote || 'origin';
    await git.push(['--set-upstream', target, branch]);
    return `Pushed and set upstream: ${target}/${branch}`;
  }
  if (remote) {
    await git.push([remote]);
    return `Pushed to ${remote}`;
  }
  await git.push();
  return 'Pushed successfully';
}

// ── Clone ─────────────────────────────────────────────────────────────────────

export async function cloneRepo(remote: string, directory: string, name?: string): Promise<string> {
  const git = simpleGit();
  const dest = name?.trim() || remote.split('/').pop()?.replace(/\.git$/, '') || 'repo';
  const cloneDir = `${directory.replace(/\/$/, '')}/${dest}`;
  await git.clone(remote, cloneDir);
  return cloneDir;
}

// ── Git config ────────────────────────────────────────────────────────────────

export interface GitIdentity {
  name: string;
  email: string;
  nameScope: 'local' | 'global' | 'unset';
  emailScope: 'local' | 'global' | 'unset';
}

function readConfigValue(repoPath: string, key: string): { value: string; scope: 'local' | 'global' | 'unset' } {
  try {
    const local = execSync(`git config --local ${key}`, { cwd: repoPath, encoding: 'utf8' }).trim();
    if (local) return { value: local, scope: 'local' };
  } catch { /* not set locally */ }
  try {
    const global = execSync(`git config --global ${key}`, { encoding: 'utf8' }).trim();
    if (global) return { value: global, scope: 'global' };
  } catch { /* not set globally */ }
  return { value: '', scope: 'unset' };
}

export function getGitIdentity(repoPath: string): GitIdentity {
  const name = readConfigValue(repoPath, 'user.name');
  const email = readConfigValue(repoPath, 'user.email');
  return {
    name: name.value,
    email: email.value,
    nameScope: name.scope,
    emailScope: email.scope,
  };
}

export function setGitIdentity(repoPath: string, key: 'user.name' | 'user.email', value: string, scope: 'local' | 'global'): void {
  const scopeFlag = scope === 'global' ? '--global' : '--local';
  if (value.trim() === '') {
    try {
      execSync(`git config ${scopeFlag} --unset ${key}`, { cwd: repoPath, encoding: 'utf8' });
    } catch { /* already unset is fine */ }
  } else {
    execSync(`git config ${scopeFlag} ${key} ${JSON.stringify(value)}`, { cwd: repoPath, encoding: 'utf8' });
  }
}

// ── Remote management ─────────────────────────────────────────────────────────

export function addRemote(repoPath: string, name: string, url: string): void {
  execSync(`git remote add ${JSON.stringify(name)} ${JSON.stringify(url)}`, { cwd: repoPath, encoding: 'utf8' });
}

export function removeRemote(repoPath: string, name: string): void {
  execSync(`git remote remove ${JSON.stringify(name)}`, { cwd: repoPath, encoding: 'utf8' });
}

export function setRemoteUrl(repoPath: string, name: string, url: string, pushUrl = false): void {
  const flag = pushUrl ? '--push' : '';
  execSync(`git remote set-url ${flag} ${JSON.stringify(name)} ${JSON.stringify(url)}`.trim(), { cwd: repoPath, encoding: 'utf8' });
}
