const KEY = 'search-history';
const MAX = 30;

export interface SearchHistoryEntry {
  id: string;
  mode: 'grep' | 'find';
  dir: string;
  pattern: string;
  ignoreCase: boolean;
  regex: boolean;
  ts: number;
}

function load(): SearchHistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

function save(entries: SearchHistoryEntry[]) {
  try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch {}
}

export function pushSearchHistory(entry: Omit<SearchHistoryEntry, 'id' | 'ts'>) {
  const all = load();
  const deduped = all.filter(e => !(e.mode === entry.mode && e.dir === entry.dir && e.pattern === entry.pattern));
  const next: SearchHistoryEntry[] = [
    { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, ts: Date.now() },
    ...deduped,
  ].slice(0, MAX);
  save(next);
  return next;
}

export function getSearchHistory(mode?: 'grep' | 'find'): SearchHistoryEntry[] {
  const all = load();
  return mode ? all.filter(e => e.mode === mode) : all;
}

export function removeSearchHistory(id: string) {
  save(load().filter(e => e.id !== id));
}

export function clearSearchHistory(mode?: 'grep' | 'find') {
  if (!mode) { save([]); return; }
  save(load().filter(e => e.mode !== mode));
}
