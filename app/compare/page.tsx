'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import FileDiffViewer from '@/components/compare/FileDiffViewer';
import ClipboardDiffViewer from '@/components/compare/ClipboardDiffViewer';
import HistoryPanel from '@/components/compare/HistoryPanel';
import FileTree from '@/components/compare/FileTree';
import IgnorePatterns, { DEFAULT_PATTERNS } from '@/components/compare/IgnorePatterns';
import { pushHistory, type HistoryEntry } from '@/lib/compareHistory';
import { useDrop } from '@/lib/useDrop';

type Mode = 'folders' | 'files' | 'clipboard';

interface FsEntry { name: string; path: string; isDirectory: boolean; isGitRepo: boolean; }
interface CompareEntry {
  relativePath: string;
  status: 'left-only' | 'right-only' | 'identical' | 'modified';
  leftPath?: string;
  rightPath?: string;
}

export default function ComparePage() {
  const [mode, setMode] = useState<Mode>('folders');

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      {/* ── Top bar ── */}
      <header className="flex items-center gap-3 px-5 h-12 shrink-0" style={{
        background: 'var(--bg-panel)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <span className="text-sm font-semibold">Compare</span>

        {/* Mode switcher — modern pill */}
        <div className="flex items-center gap-0.5 ml-3 px-1 py-1 rounded-xl" style={{ background: 'var(--bg-raised)' }}>
          {([
            ['folders',   'Folders',   <FolderIcon key="f" />],
            ['files',     'Files',     <FileIcon key="fi" />],
            ['clipboard', 'Clipboard', <ClipboardIcon key="c" />],
          ] as [Mode, string, React.ReactNode][]).map(([id, label, icon]) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                mode === id
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-[var(--text-dim)] hover:text-[var(--foreground)]'
              }`}
            >
              {icon}{label}
            </button>
          ))}
        </div>

      </header>

      {mode === 'folders'   && <FoldersMode />}
      {mode === 'files'     && <FilesMode />}
      {mode === 'clipboard' && <div className="flex flex-1 min-h-0 overflow-hidden"><ClipboardDiffViewer /></div>}

    </div>
  );
}

/* ── Folders mode ── */
function FoldersMode() {
  const didInit = useRef(false);
  const [leftDir, setLeftDir] = useState('');
  const [rightDir, setRightDir] = useState('');

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    const params = new URLSearchParams(window.location.search);
    const l = params.get('left'); const r = params.get('right');
    if (l) setLeftDir(l);
    if (r) setRightDir(r);
  }, []);
  const [entries, setEntries] = useState<CompareEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<CompareEntry | null>(null);
  const [filter, setFilter] = useState<'all' | 'modified' | 'left-only' | 'right-only'>('modified');
  const [historyKey, setHistoryKey] = useState(0);
  const [ignorePatterns, setIgnorePatterns] = useState<string[]>(DEFAULT_PATTERNS);

  const compare = useCallback(async (l: string, r: string, patterns: string[]) => {
    setLoading(true); setError(''); setSelected(null);
    try {
      const params = new URLSearchParams({ left: l, right: r });
      if (patterns.length) params.set('ignore', patterns.join(','));
      const d = await fetch(`/api/compare/tree?${params}`).then(r => r.json());
      if (d.error) { setError(d.error); return; }
      setEntries(d.entries || []);
      pushHistory({ mode: 'folders', left: l, right: r });
      setHistoryKey(k => k + 1);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (leftDir && rightDir) compare(leftDir, rightDir, ignorePatterns); }, [leftDir, rightDir, compare]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Re-run comparison when ignore patterns change (debounced)
  useEffect(() => {
    if (!leftDir || !rightDir) return;
    const t = setTimeout(() => compare(leftDir, rightDir, ignorePatterns), 400);
    return () => clearTimeout(t);
  }, [ignorePatterns]); // eslint-disable-line react-hooks/exhaustive-deps

  const restoreHistory = (entry: HistoryEntry) => {
    setLeftDir(entry.left);
    setRightDir(entry.right);
  };

  const counts = {
    modified:     entries.filter(e => e.status === 'modified').length,
    'left-only':  entries.filter(e => e.status === 'left-only').length,
    'right-only': entries.filter(e => e.status === 'right-only').length,
    identical:    entries.filter(e => e.status === 'identical').length,
  };

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      <Sidebar>
        <SidebarSection label="Source folders">
          <PathPicker label="Left"  accent="#f87171" value={leftDir}  onChange={setLeftDir}  foldersOnly />
          <PathPicker label="Right" accent="#34d399" value={rightDir} onChange={setRightDir} foldersOnly />
        </SidebarSection>

        <IgnorePatterns patterns={ignorePatterns} onChange={setIgnorePatterns} />

        {entries.length > 0 && (
          <div className="px-3 py-2 flex flex-wrap gap-1 shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            {([
              ['all',        `All (${entries.length})`, null],
              ['modified',   `${counts.modified} mod`,   '#f59e0b'],
              ['left-only',  `${counts['left-only']} left`,  '#f87171'],
              ['right-only', `${counts['right-only']} right`, '#34d399'],
            ] as [typeof filter, string, string | null][])
              .filter(([k]) => k === 'all' || counts[k as keyof typeof counts] > 0)
              .map(([key, label, color]) => (
                <button key={key} onClick={() => setFilter(key)}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all"
                  style={filter === key
                    ? { background: color ?? 'var(--primary)', color: 'white' }
                    : { background: 'var(--bg-raised)', color: 'var(--text-dim)' }
                  }>{label}</button>
              ))}
          </div>
        )}

        {loading ? <LoadingSkeleton /> : error ? <ErrorCard msg={error} /> :
         !leftDir || !rightDir ? <EmptyHint icon="folder">Select both folders to compare</EmptyHint> :
         entries.length === 0  ? <EmptyHint icon="check">No differences found</EmptyHint> : (
          <FileTree
            entries={entries}
            statusFilter={filter}
            selected={selected}
            onSelect={setSelected}
          />
        )}

        {entries.length > 0 && (
          <div className="shrink-0 px-3 py-2 flex flex-wrap gap-1.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            {counts.modified   > 0 && <StatBadge label={`${counts.modified} modified`}   color="#f59e0b" />}
            {counts['left-only']  > 0 && <StatBadge label={`${counts['left-only']} left only`}  color="#f87171" />}
            {counts['right-only'] > 0 && <StatBadge label={`${counts['right-only']} right only`} color="#34d399" />}
            {counts.identical  > 0 && <StatBadge label={`${counts.identical} same`}      color="var(--text-dim)" />}
          </div>
        )}
        <HistoryPanel mode="folders" onSelect={restoreHistory} refreshKey={historyKey} />
      </Sidebar>

      <main className="flex-1 flex flex-col min-h-0 min-w-0" style={{ background: 'var(--background)' }}>
        {selected
          ? <FileDiffViewer key={selected.relativePath} leftPath={selected.leftPath || ''} rightPath={selected.rightPath || ''} relativePath={selected.relativePath} status={selected.status} />
          : <EmptyHint icon="diff">Select a file from the tree</EmptyHint>
        }
      </main>
    </div>
  );
}

/* ── Files mode ── */
function FilesMode() {
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');
  const [historyKey, setHistoryKey] = useState(0);

  useEffect(() => {
    if (left && right) {
      pushHistory({ mode: 'files', left, right });
      setHistoryKey(k => k + 1);
    }
  }, [left, right]);

  const restoreHistory = (entry: HistoryEntry) => {
    setLeft(entry.left);
    setRight(entry.right);
  };

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      <Sidebar>
        <SidebarSection label="Files to compare">
          <PathPicker label="Left"  accent="#f87171" value={left}  onChange={setLeft}  foldersOnly={false} />
          <PathPicker label="Right" accent="#34d399" value={right} onChange={setRight} foldersOnly={false} />
        </SidebarSection>

        {left && right && (
          <div className="mx-3 mt-1 p-3 rounded-xl space-y-1.5" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}>
            <PathBadge color="#f87171" label="L" path={left} />
            <PathBadge color="#34d399" label="R" path={right} />
          </div>
        )}

        {(!left || !right) && <EmptyHint icon="file">Pick two files to compare</EmptyHint>}
        <HistoryPanel mode="files" onSelect={restoreHistory} refreshKey={historyKey} />
      </Sidebar>

      <main className="flex-1 flex flex-col min-h-0 min-w-0" style={{ background: 'var(--background)' }}>
        {left && right
          ? <FileDiffViewer key={`${left}::${right}`} leftPath={left} rightPath={right}
              relativePath={`${left.split('/').pop()} ↔ ${right.split('/').pop()}`} status="modified" />
          : <EmptyHint icon="diff">Select both files to view the diff</EmptyHint>
        }
      </main>
    </div>
  );
}

/* ── Sidebar shell ── */
function Sidebar({ children }: { children: React.ReactNode }) {
  return (
    <aside className="w-72 shrink-0 flex flex-col overflow-hidden" style={{
      background: 'var(--bg-panel)',
      borderRight: '1px solid var(--border-subtle)',
    }}>{children}</aside>
  );
}

function SidebarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="shrink-0 px-3 pt-3 pb-3 space-y-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>{label}</p>
      {children}
    </div>
  );
}

/* ── Path picker ── */
function PathPicker({ label, accent, value, onChange, foldersOnly }: {
  label: string; accent: string; value: string; onChange: (p: string) => void; foldersOnly: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState('~');
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [resolved, setResolved] = useState('');
  const [fetching, setFetching] = useState(false);

  const load = useCallback(async (p: string) => {
    setFetching(true);
    try {
      const d = await fetch(`/api/fs?path=${encodeURIComponent(p)}`).then(r => r.json());
      setEntries(d.entries || []);
      setResolved(d.path || p);
    } finally { setFetching(false); }
  }, []);

  useEffect(() => { if (open) load(cur); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEntry = (e: FsEntry) => {
    if (e.isDirectory) { setCur(e.path); load(e.path); }
    else if (!foldersOnly) { onChange(e.path); setOpen(false); }
  };

  const { dragging, error: dropError, handlers: dropHandlers } = useDrop({
    accept: foldersOnly ? 'directory' : 'file',
    onPath: (path, isDirectory) => {
      onChange(path);
      // Navigate the browser to the dropped path so the user can keep browsing
      if (isDirectory) {
        // For folders: open the dropped folder itself
        setCur(path);
        load(path);
      } else {
        // For files: open the parent directory
        const parent = path.split('/').slice(0, -1).join('/') || '/';
        setCur(parent);
        load(parent);
      }
      setOpen(true);
    },
  });

  const crumbs = resolved.split('/').filter(Boolean);
  const shown = foldersOnly ? entries.filter(e => e.isDirectory) : entries;
  const shortName = value ? value.split('/').pop() || value : null;

  return (
    <div className="space-y-1">
      {/* Trigger row — also the drop target */}
      <div
        {...dropHandlers}
        className="relative rounded-xl transition-all duration-150"
        style={{
          outline: dragging ? `2px dashed ${accent}` : undefined,
          background: dragging ? `${accent}12` : undefined,
        }}
      >
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center gap-2 h-9 px-3 rounded-xl text-xs font-medium transition-all duration-150"
          style={{
            background: dragging ? 'transparent' : open ? `${accent}18` : 'var(--bg-raised)',
            border: `1.5px solid ${dragging ? 'transparent' : open ? accent : 'var(--border-subtle)'}`,
            color: value ? 'var(--foreground)' : 'var(--text-dim)',
          }}
        >
          <span className="w-4 h-4 rounded-md flex items-center justify-center text-[9px] font-bold shrink-0 text-white" style={{ background: accent }}>{label[0]}</span>
          {dragging
            ? <span className="font-semibold text-[11px] flex-1 text-left" style={{ color: accent }}>Drop {foldersOnly ? 'folder' : 'file'} here</span>
            : <span className="font-mono truncate flex-1 text-left text-[11px]">{shortName ?? (foldersOnly ? 'Choose folder…' : 'Choose file…')}</span>
          }
          {!dragging && (value
            ? <span className="shrink-0 opacity-40 hover:opacity-100 transition-opacity" onClick={e => { e.stopPropagation(); onChange(''); }}><svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 3L3 9M3 3l6 6"/></svg></span>
            : <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 opacity-40"><path d="M6 2v8M2 6h8"/></svg>
          )}
        </button>
        {/* Drop indicator overlay */}
        {dragging && (
          <div className="absolute inset-0 rounded-xl flex items-center justify-center pointer-events-none">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: accent }}>
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
        )}
      </div>
      {/* Drop error */}
      {dropError && <p className="text-[10px] px-1" style={{ color: '#f87171' }}>{dropError}</p>}

      {/* Dropdown */}
      {open && (
        <div className="rounded-xl overflow-hidden" style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}>
          {/* Breadcrumbs */}
          <div className="flex items-center gap-0.5 px-2 py-1.5 overflow-x-auto" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-raised)' }}>
            <button onClick={() => { setCur('~'); load('~'); }}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded-md transition-colors shrink-0"
              style={{ color: 'var(--text-dim)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-raised)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >~</button>
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-0.5">
                <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ color: 'var(--border-subtle)' }}><path d="M4 2l4 4-4 4"/></svg>
                <button onClick={() => { const p = '/' + crumbs.slice(0, i + 1).join('/'); setCur(p); load(p); }}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded-md transition-colors shrink-0 max-w-[72px] truncate"
                  style={{ color: 'var(--text-soft)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--foreground)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-soft)'}
                >{c}</button>
              </span>
            ))}
          </div>

          {/* Entries */}
          <div className="max-h-48 overflow-y-auto">
            {fetching ? (
              <div className="p-2 space-y-1">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-7 rounded-lg animate-pulse" style={{ background: 'var(--bg-raised)', opacity: 1 - i * 0.15 }} />)}</div>
            ) : shown.length === 0 ? (
              <p className="p-4 text-center text-[11px]" style={{ color: 'var(--text-dim)' }}>Empty</p>
            ) : shown.map(e => (
              <button key={e.path}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-left transition-colors"
                style={{ color: 'var(--foreground)' }}
                onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = 'var(--bg-raised)'}
                onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = ''}
                onClick={() => handleEntry(e)}
              >
                {e.isDirectory
                  ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: accent, opacity: 0.7 }}><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>
                  : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-dim)' }}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                }
                <span className="font-mono truncate flex-1">{e.name}</span>
                {!e.isDirectory && <span className="text-[9px] shrink-0 px-1 py-0.5 rounded" style={{ background: 'var(--bg-raised)', color: 'var(--text-dim)' }}>{e.name.split('.').pop()}</span>}
              </button>
            ))}
          </div>

          {foldersOnly && (
            <div className="flex items-center justify-between px-3 py-2 gap-2" style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-raised)' }}>
              <span className="font-mono text-[10px] truncate flex-1" style={{ color: 'var(--text-dim)' }}>{resolved}</span>
              <button onClick={() => { onChange(resolved); setOpen(false); }}
                className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-opacity hover:opacity-90"
                style={{ background: accent }}>
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M2 6l3 3 5-5"/></svg>
                Select
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── File row in tree ── */
function FileRow({ entry, active, onClick }: { entry: CompareEntry; active: boolean; onClick: () => void }) {
  const cfg = {
    modified:    { dot: '#f59e0b', sym: '~' },
    'left-only':   { dot: '#f87171', sym: '−' },
    'right-only':  { dot: '#34d399', sym: '+' },
    identical:   { dot: 'var(--text-dim)', sym: '=' },
  }[entry.status];

  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-all"
      style={active
        ? { background: 'color-mix(in oklch, var(--primary) 10%, transparent)', borderLeft: '2px solid var(--primary)', paddingLeft: 10 }
        : { borderLeft: '2px solid transparent' }
      }
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--bg-raised)'; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = ''; }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.dot }} />
      <span className="font-mono text-[11px] truncate flex-1" style={{ color: active ? 'var(--primary)' : 'var(--foreground)' }}>{entry.relativePath}</span>
      <span className="text-[10px] font-bold shrink-0" style={{ color: cfg.dot }}>{cfg.sym}</span>
    </button>
  );
}

/* ── Small helpers ── */
function StatBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: `${color}20`, color }}>{label}</span>
  );
}

function PathBadge({ color, label, path }: { color: string; label: string; path: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-4 h-4 rounded-md text-[9px] font-bold flex items-center justify-center text-white shrink-0" style={{ background: color }}>{label}</span>
      <span className="font-mono text-[10px] truncate" style={{ color: 'var(--text-dim)' }} title={path}>{path}</span>
    </div>
  );
}

function EmptyHint({ icon, children }: { icon: 'folder' | 'file' | 'diff' | 'check'; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 h-full gap-3 p-6" style={{ color: 'var(--text-dim)' }}>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'var(--bg-raised)' }}>
        {icon === 'folder' && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>}
        {icon === 'file'   && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
        {icon === 'diff'   && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-3"/><path d="M9 7V5a2 2 0 012-2h2M9 7h6"/><path d="M20 12h-8m0 0l3-3m-3 3l3 3"/></svg>}
        {icon === 'check'  && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 6L9 17l-5-5"/></svg>}
      </div>
      <p className="text-xs text-center leading-relaxed max-w-[160px]">{children}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-3 space-y-1.5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="h-7 rounded-lg animate-pulse" style={{ background: 'var(--bg-raised)', opacity: 1 - i * 0.08 }} />
      ))}
    </div>
  );
}

function ErrorCard({ msg }: { msg: string }) {
  return (
    <div className="m-3 p-3 rounded-xl text-xs" style={{ background: 'oklch(0.17 0.07 15 / 0.3)', border: '1px solid oklch(0.64 0.20 15 / 0.3)', color: 'oklch(0.88 0.06 15)' }}>{msg}</div>
  );
}

/* ── Icons ── */
function FolderIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>; }
function FileIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>; }
function ClipboardIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2h-3"/></svg>; }
