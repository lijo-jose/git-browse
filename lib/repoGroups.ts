export interface RepoGroup {
  id: string;
  name: string;
  repoPaths: string[];
  createdAt: number;
}

const GROUPS_KEY = 'git-browser-repo-groups';

export function loadGroups(): RepoGroup[] {
  try {
    const s = localStorage.getItem(GROUPS_KEY);
    return s ? JSON.parse(s) : [];
  } catch { return []; }
}

export function saveGroups(groups: RepoGroup[]) {
  try { localStorage.setItem(GROUPS_KEY, JSON.stringify(groups)); } catch {}
}

export function createGroup(name: string, repoPaths: string[]): RepoGroup {
  return { id: crypto.randomUUID(), name, repoPaths, createdAt: Date.now() };
}
