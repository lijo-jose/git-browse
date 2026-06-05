const KEY = 'compare-history';
const MAX = 30;

export interface HistoryEntry {
  id: string;
  mode: 'folders' | 'files';
  left: string;
  right: string;
  ts: number;
}

function load(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

function save(entries: HistoryEntry[]) {
  try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch {}
}

export function pushHistory(entry: Omit<HistoryEntry, 'id' | 'ts'>) {
  const all = load();
  // deduplicate: remove existing same left+right+mode
  const deduped = all.filter(e => !(e.mode === entry.mode && e.left === entry.left && e.right === entry.right));
  const next: HistoryEntry[] = [
    { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, ts: Date.now() },
    ...deduped,
  ].slice(0, MAX);
  save(next);
  return next;
}

export function getHistory(mode?: 'folders' | 'files'): HistoryEntry[] {
  const all = load();
  return mode ? all.filter(e => e.mode === mode) : all;
}

export function removeHistory(id: string) {
  save(load().filter(e => e.id !== id));
}

export function clearHistory(mode?: 'folders' | 'files') {
  if (!mode) { save([]); return; }
  save(load().filter(e => e.mode !== mode));
}
