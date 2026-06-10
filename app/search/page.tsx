'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Mode = 'grep' | 'find';

interface FsEntry { name: string; path: string; isDirectory: boolean; isGitRepo: boolean; }
interface GrepMatch { file: string; line: number; text: string; }

export default function SearchPage() {
  const [mode, setMode] = useState<Mode>('grep');
  const [dir, setDir] = useState('');
  const [pattern, setPattern] = useState('');
  const [ignoreCase, setIgnoreCase] = useState(true);
  const [regex, setRegex] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [matches, setMatches] = useState<GrepMatch[]>([]);
  const [paths, setPaths] = useState<string[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [searched, setSearched] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    fetch('/api/system')
      .then(r => r.json())
      .then(d => setUnsupported(d.platform === 'win32'))
      .catch(() => {});
  }, []);

  const run = useCallback(async () => {
    if (!dir || !pattern) return;
    setLoading(true); setError(''); setSearched(true);
    try {
      const params = new URLSearchParams({ dir, pattern });
      if (mode === 'grep') {
        if (ignoreCase) params.set('ignoreCase', '1');
        if (regex) params.set('regex', '1');
      }
      const d = await fetch(`/api/search/${mode}?${params}`).then(r => r.json());
      if (d.error) { setError(d.error); setMatches([]); setPaths([]); return; }
      setMatches(d.matches || []);
      setPaths(d.paths || []);
      setTruncated(!!d.truncated);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, [dir, pattern, mode, ignoreCase, regex]);

  const grouped = useMemo(() => {
    const map = new Map<string, GrepMatch[]>();
    for (const m of matches) {
      const arr = map.get(m.file) || [];
      arr.push(m);
      map.set(m.file, arr);
    }
    return Array.from(map.entries());
  }, [matches]);

  const relTo = (p: string) => (dir && p.startsWith(dir) ? p.slice(dir.length).replace(/^\//, '') || p : p);
  const count = mode === 'grep' ? matches.length : paths.length;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      {/* ── Top bar ── */}
      <header className="flex items-center gap-3 px-5 h-12 shrink-0" style={{
        background: 'var(--bg-panel)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <span className="text-sm font-semibold">Search</span>

        <div className="flex items-center gap-0.5 ml-3 px-1 py-1 rounded-xl" style={{ background: 'var(--bg-raised)' }}>
          {([
            ['grep', 'Grep (content)'],
            ['find', 'Find (file names)'],
          ] as [Mode, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => { setMode(id); setSearched(false); setError(''); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
              style={mode === id ? {
                background: 'var(--primary)',
                color: 'white',
                boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
              } : {
                color: 'var(--text-dim)',
              }}
              onMouseEnter={e => { if (mode !== id) (e.currentTarget as HTMLElement).style.color = 'var(--foreground)'; }}
              onMouseLeave={e => { if (mode !== id) (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'; }}
            >{label}</button>
          ))}
        </div>

      </header>

      {unsupported ? (
        <EmptyHint>Search is not available on Windows yet</EmptyHint>
      ) : (
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* ── Sidebar ── */}
        <aside className="w-72 shrink-0 flex flex-col overflow-y-auto" style={{
          background: 'var(--bg-panel)',
          borderRight: '1px solid var(--border-subtle)',
        }}>
          <div className="px-3 pt-3 pb-3 space-y-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>Search in</p>
            <FolderPicker value={dir} onChange={setDir} />
          </div>

          <div className="px-3 pt-3 pb-3 space-y-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
              {mode === 'grep' ? 'Text to find' : 'File name'}
            </p>
            <input
              value={pattern}
              onChange={e => setPattern(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') run(); }}
              placeholder={mode === 'grep' ? 'e.g. TODO' : 'e.g. *.ts or config'}
              className="w-full h-9 px-3 rounded-xl text-xs font-mono outline-none"
              style={{ background: 'var(--bg-raised)', border: '1.5px solid var(--border-subtle)', color: 'var(--foreground)' }}
            />

            {mode === 'grep' && (
              <div className="flex gap-3 pt-1">
                <Toggle label="Ignore case" checked={ignoreCase} onChange={setIgnoreCase} />
                <Toggle label="Regex" checked={regex} onChange={setRegex} />
              </div>
            )}

            <button
              onClick={run}
              disabled={!dir || !pattern || loading}
              className="w-full h-9 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: 'var(--primary)' }}
            >
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>

          {searched && !loading && !error && (
            <p className="px-4 py-3 text-[11px]" style={{ color: 'var(--text-dim)' }}>
              {count} {mode === 'grep' ? `match${count === 1 ? '' : 'es'} in ${grouped.length} file${grouped.length === 1 ? '' : 's'}` : `file${count === 1 ? '' : 's'}`}
              {truncated && ' (truncated to first 500)'}
            </p>
          )}
        </aside>

        {/* ── Results ── */}
        <main className="flex-1 min-w-0 overflow-y-auto" style={{ background: 'var(--background)' }}>
          {error ? (
            <div className="m-4 p-3 rounded-xl text-xs" style={{ background: 'oklch(0.17 0.07 15 / 0.3)', border: '1px solid oklch(0.64 0.20 15 / 0.3)', color: 'oklch(0.88 0.06 15)' }}>{error}</div>
          ) : loading ? (
            <div className="p-4 space-y-1.5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-7 rounded-lg animate-pulse" style={{ background: 'var(--bg-raised)', opacity: 1 - i * 0.08 }} />
              ))}
            </div>
          ) : !searched ? (
            <EmptyHint>Pick a folder and enter a {mode === 'grep' ? 'search term' : 'file name'}</EmptyHint>
          ) : count === 0 ? (
            <EmptyHint>No results found</EmptyHint>
          ) : mode === 'find' ? (
            <div className="p-3">
              {paths.map(p => (
                <div key={p} className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-[11px]"
                  style={{ color: 'var(--foreground)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0" style={{ color: 'var(--text-dim)' }}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <span className="truncate">{relTo(p)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 space-y-3">
              {grouped.map(([file, ms]) => (
                <div key={file} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                  <div className="flex items-center gap-2 px-3 py-2" style={{ background: 'var(--bg-panel)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span className="font-mono text-[11px] font-semibold truncate" style={{ color: 'var(--primary)' }}>{relTo(file)}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: 'var(--bg-raised)', color: 'var(--text-dim)' }}>{ms.length}</span>
                  </div>
                  {ms.map(m => (
                    <div key={`${m.line}-${m.text}`} className="flex gap-3 px-3 py-1 font-mono text-[11px]">
                      <span className="shrink-0 w-10 text-right" style={{ color: 'var(--text-dim)' }}>{m.line}</span>
                      <span className="truncate" style={{ color: 'var(--foreground)' }}>{m.text.trimStart()}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
      )}
    </div>
  );
}

/* ── Compact folder picker (text input + browse) ── */
function FolderPicker({ value, onChange }: { value: string; onChange: (p: string) => void }) {
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState('~');
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [resolved, setResolved] = useState('');

  const load = useCallback(async (p: string) => {
    const d = await fetch(`/api/fs?path=${encodeURIComponent(p)}`).then(r => r.json());
    setEntries((d.entries || []).filter((e: FsEntry) => e.isDirectory));
    setResolved(d.path || p);
  }, []);

  return (
    <div className="space-y-1">
      <div className="flex gap-1.5">
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="~/path/to/folder"
          className="flex-1 min-w-0 h-9 px-3 rounded-xl text-[11px] font-mono outline-none"
          style={{ background: 'var(--bg-raised)', border: '1.5px solid var(--border-subtle)', color: 'var(--foreground)' }}
        />
        <button
          onClick={() => { setOpen(o => !o); if (!open) load(value || cur); }}
          className="shrink-0 h-9 px-3 rounded-xl text-xs font-semibold transition-colors"
          style={{ background: open ? 'var(--primary)' : 'var(--bg-raised)', color: open ? 'white' : 'var(--text-dim)', border: '1.5px solid var(--border-subtle)' }}
        >…</button>
      </div>

      {open && (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
          <div className="flex items-center gap-1 px-2 py-1.5" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-raised)' }}>
            <button onClick={() => { setCur('~'); load('~'); }} className="text-[10px] font-mono px-1.5 py-0.5 rounded-md" style={{ color: 'var(--text-dim)' }}>~</button>
            <button onClick={() => { const parent = resolved.split('/').slice(0, -1).join('/') || '/'; setCur(parent); load(parent); }}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded-md" style={{ color: 'var(--text-dim)' }}>↑ up</button>
            <span className="font-mono text-[10px] truncate flex-1 text-right" style={{ color: 'var(--text-dim)' }}>{resolved}</span>
          </div>
          <div className="max-h-44 overflow-y-auto">
            {entries.length === 0
              ? <p className="p-3 text-center text-[11px]" style={{ color: 'var(--text-dim)' }}>No subfolders</p>
              : entries.map(e => (
                <button key={e.path}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-left transition-colors"
                  style={{ color: 'var(--foreground)' }}
                  onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = 'var(--bg-raised)'}
                  onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = ''}
                  onClick={() => { setCur(e.path); load(e.path); }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--primary)', opacity: 0.7 }}><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>
                  <span className="font-mono truncate flex-1">{e.name}</span>
                </button>
              ))}
          </div>
          <div className="flex items-center justify-end px-3 py-2" style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-raised)' }}>
            <button onClick={() => { onChange(resolved); setOpen(false); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--primary)' }}>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M2 6l3 3 5-5"/></svg>
              Select
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-[11px] cursor-pointer select-none" style={{ color: 'var(--text-soft)' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="accent-[var(--primary)]" />
      {label}
    </label>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 p-6" style={{ color: 'var(--text-dim)' }}>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'var(--bg-raised)' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
      </div>
      <p className="text-xs text-center leading-relaxed max-w-[180px]">{children}</p>
    </div>
  );
}
