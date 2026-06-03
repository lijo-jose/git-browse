import simpleGit, { SimpleGit, LogResult } from 'simple-git';
import { execSync } from 'child_process';

export function getGit(repoPath: string): SimpleGit {
  return simpleGit(repoPath);
}

export interface GitFileStatus {
  path: string;
  status: 'M' | 'A' | 'D' | '?' | 'R' | 'C' | 'U';
  staged: boolean;
  index?: string;
  working?: string;
}

export async function getStatus(repoPath: string): Promise<GitFileStatus[]> {
  const git = getGit(repoPath);
  const status = await git.status();
  const files: GitFileStatus[] = [];

  for (const f of status.files) {
    const index = f.index.trim();
    const working = f.working_dir.trim();
    if (index && index !== ' ' && index !== '?') {
      files.push({ path: f.path, status: mapStatus(index), staged: true, index, working });
    }
    if (working && working !== ' ') {
      files.push({ path: f.path, status: mapStatus(working), staged: false, index, working });
    }
  }
  return files;
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
      remote: name.startsWith('remotes/') || name.includes('/'),
      lastCommitDate: date,
      lastCommit: subjectParts.join('\x00'), // re-join in the impossible case subject had NUL
    };
  });
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
): Promise<string> {
  const git = getGit(repoPath);
  if (setUpstream) {
    await git.push(['--set-upstream', 'origin', branch]);
    return `Pushed and set upstream: origin/${branch}`;
  }
  await git.push();
  return 'Pushed successfully';
}
