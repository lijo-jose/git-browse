export interface GitErrorInfo {
  code: string;
  suggestion: string;
  /** True when the error created merge/rebase conflict markers in the working tree */
  isConflict: boolean;
}

const PATTERNS: Array<{ regex: RegExp } & GitErrorInfo> = [
  {
    regex: /permission denied \(publickey\)|authentication failed|could not read username|invalid_credentials|403|401|could not read from remote repository|unauthorized/i,
    code: 'auth',
    suggestion: 'Authentication failed. Check your SSH key or personal access token and confirm you have access to this repository.',
    isConflict: false,
  },
  {
    regex: /rejected.*non-fast-forward|updates were rejected.*behind|fetch first|cannot push non-fastforwardable|hint:.*pull/i,
    code: 'non-fast-forward',
    suggestion: 'The remote has commits your local branch does not. Pull (or rebase) first, then push again.',
    isConflict: false,
  },
  {
    regex: /automatic merge failed|CONFLICT \(|merge conflict in /i,
    code: 'conflict',
    suggestion: 'Merge conflicts detected. Open the Changes panel to see the conflicted files and resolve them.',
    isConflict: true,
  },
  {
    regex: /local changes.*would be overwritten|please commit or stash|cannot pull with rebase.*unstaged/i,
    code: 'dirty-tree',
    suggestion: 'You have uncommitted local changes that would be overwritten. Stash or commit them first.',
    isConflict: false,
  },
  {
    regex: /could not resolve host|connection refused|timed out|network unreachable|no route to host|ssl|certificate/i,
    code: 'network',
    suggestion: 'Network error. Check your internet connection or VPN and try again.',
    isConflict: false,
  },
  {
    regex: /has no upstream branch|set.*upstream|no upstream/i,
    code: 'no-upstream',
    suggestion: 'No upstream branch is set. Use "Push (set upstream)" to publish this branch to the remote.',
    isConflict: false,
  },
  {
    regex: /nothing to commit|nothing added to commit/i,
    code: 'nothing',
    suggestion: 'There are no staged changes to commit. Stage some files first.',
    isConflict: false,
  },
  {
    regex: /rebase is in progress|cannot rebase.*rebase/i,
    code: 'rebase-in-progress',
    suggestion: 'A rebase is already in progress. Resolve conflicts, then continue, skip, or abort the current rebase.',
    isConflict: false,
  },
  {
    regex: /detached head|not on any branch/i,
    code: 'detached-head',
    suggestion: 'You are in detached HEAD state. Checkout a branch before pushing.',
    isConflict: false,
  },
  {
    regex: /repository not found|does not exist|no such remote/i,
    code: 'not-found',
    suggestion: 'Repository or remote not found. Check the remote URL in Repository Settings.',
    isConflict: false,
  },
  {
    regex: /destination path.*already exists|already exists and is not an empty/i,
    code: 'dir-exists',
    suggestion: 'The destination directory already exists. Choose a different name or location.',
    isConflict: false,
  },
];

export function classifyGitError(err: string): GitErrorInfo | null {
  for (const { regex, code, suggestion, isConflict } of PATTERNS) {
    if (regex.test(err)) return { code, suggestion, isConflict };
  }
  return null;
}
