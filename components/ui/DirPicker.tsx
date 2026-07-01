'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface FsEntry { name: string; path: string; isDirectory: boolean; isGitRepo?: boolean; }

interface Props {
  value: string;
  onChange: (path: string) => void;
  onClose: () => void;
  showFiles?: boolean;
}

const RECENT_KEY = 'dir-picker-recent';
const MAX_RECENT = 8;

const QUICK: { label: string; path: string; icon: React.ReactNode }[] = [
  { label: 'Home', path: '~', icon: <HomeIcon /> },
  { label: 'Desktop', path: '~/Desktop', icon: <FolderIcon tint="blue" /> },
  { label: 'Documents', path: '~/Documents', icon: <FolderIcon tint="yellow" /> },
  { label: 'Downloads', path: '~/Downloads', icon: <FolderIcon tint="green" /> },
];

function saveRecent(path: string) {
  try {
    const list: string[] = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    const next = [path, ...list.filter(p => p !== path)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}

function loadRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}

export default function DirPicker({ value, onChange, onClose, showFiles = false }: Props) {
  const [cur, setCur] = useState(value || '~');
  const [resolved, setResolved] = useState('');
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; isPermission: boolean } | null>(null);
  const [filter, setFilter] = useState('');
  const [activeIdx, setActiveIdx] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async (p: string) => {
    setLoading(true);
    setError(null);
    setFilter('');
    setActiveIdx(-1);
    try {
      const res = await fetch(`/api/fs?path=${encodeURIComponent(p)}`);
      const d = await res.json();
      if (!res.ok || d.error) {
        setError({ message: d.error || 'Failed to read directory', isPermission: d.code === 'EPERM' });
        setEntries([]);
        return;
      }
      setEntries(showFiles ? (d.entries || []) : (d.entries || []).filter((e: FsEntry) => e.isDirectory));
      setResolved(d.path || p);
    } catch {
      setError({ message: 'Failed to reach server', isPermission: false });
      setEntries([]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load(cur);
    setRecent(loadRecent());
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on backdrop click or Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = filter.trim()
    ? entries.filter(e => e.name.toLowerCase().includes(filter.toLowerCase()))
    : entries;

  // Keyboard navigation in the entry list
  const handleInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && filtered[activeIdx]) {
        const entry = filtered[activeIdx];
        if (!entry.isDirectory) { choose(entry.path); return; }
        setCur(entry.path);
        load(entry.path);
      } else if (filter.startsWith('/') || filter.startsWith('~')) {
        // User typed a raw path — navigate to it
        const p = filter.trim();
        setCur(p);
        load(p);
      }
    } else if (e.key === 'Backspace' && filter === '') {
      // Navigate up
      e.preventDefault();
      goUp();
    }
  };

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const goUp = () => {
    if (!resolved) return;
    const parts = resolved.split('/').filter(Boolean);
    if (parts.length === 0) return;
    const parent = '/' + parts.slice(0, -1).join('/');
    const p = parent || '/';
    setCur(p);
    load(p);
  };

  const choose = (path?: string) => {
    const p = path ?? resolved;
    saveRecent(p);
    onChange(p);
    onClose();
  };

  const isWindows = /^[A-Za-z]:[/\\]/.test(resolved);
  const sep = isWindows ? '\\' : '/';
  const crumbs = resolved.split(/[/\\]/).filter(Boolean);

  const nav = (i: number) => {
    const parts = crumbs.slice(0, i + 1);
    const p = isWindows ? parts.join('\\') + '\\' : '/' + parts.join('/');
    setCur(p);
    load(p);
  };

  const content = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'color-mix(in oklch, black 55%, transparent)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex flex-col rounded-2xl overflow-hidden shadow-2xl"
        style={{
          width: 600,
          maxWidth: 'calc(100vw - 32px)',
          height: 480,
          maxHeight: 'calc(100vh - 64px)',
          background: 'var(--bg-panel)',
          border: '1px solid color-mix(in oklch, var(--border-subtle) 80%, transparent)',
          boxShadow: '0 24px 64px color-mix(in oklch, black 40%, transparent)',
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Header: filter input */}
        <div className="flex items-center gap-2.5 px-3.5 pt-3.5 pb-2.5 flex-shrink-0" style={{ borderBottom: '1px solid color-mix(in oklch, var(--border-subtle) 50%, transparent)' }}>
          <SearchIcon />
          <input
            ref={inputRef}
            value={filter}
            onChange={e => { setFilter(e.target.value); setActiveIdx(-1); }}
            onKeyDown={handleInputKey}
            placeholder="Filter folders or paste a path…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-[var(--text-dim)] outline-none"
          />
          {filter && (
            <button onClick={() => { setFilter(''); setActiveIdx(-1); inputRef.current?.focus(); }}
              className="text-[var(--text-dim)] hover:text-foreground transition-colors text-xs">
              ✕
            </button>
          )}
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="flex flex-col w-36 flex-shrink-0 py-2 overflow-y-auto" style={{ borderRight: '1px solid color-mix(in oklch, var(--border-subtle) 50%, transparent)' }}>
            <p className="px-3 mb-1 text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>Quick Access</p>
            {QUICK.map(q => (
              <button
                key={q.path}
                onClick={() => { setCur(q.path); load(q.path); }}
                className="flex items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors"
                style={{ color: 'var(--text-soft)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'color-mix(in oklch, var(--bg-raised) 60%, transparent)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
              >
                {q.icon}
                <span className="truncate">{q.label}</span>
              </button>
            ))}

            {recent.length > 0 && (
              <>
                <div className="my-2 mx-3" style={{ borderTop: '1px solid color-mix(in oklch, var(--border-subtle) 50%, transparent)' }} />
                <p className="px-3 mb-1 text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>Recent</p>
                {recent.map(r => (
                  <button
                    key={r}
                    onClick={() => { setCur(r); load(r); }}
                    className="flex items-center gap-2 px-3 py-1.5 text-left text-[11px] transition-colors"
                    style={{ color: 'var(--text-soft)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'color-mix(in oklch, var(--bg-raised) 60%, transparent)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                    title={r}
                  >
                    <RecentIcon />
                    <span className="truncate">{r.split('/').filter(Boolean).pop() || r}</span>
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Main file list area */}
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Breadcrumb */}
            <div className="flex items-center gap-0.5 px-3 py-2 flex-shrink-0 overflow-x-auto" style={{ borderBottom: '1px solid color-mix(in oklch, var(--border-subtle) 40%, transparent)' }}>
              {!isWindows && (
                <button onClick={() => { setCur('~'); load('~'); }}
                  className="text-[11px] font-medium text-blue-500 hover:text-blue-400 transition-colors flex-shrink-0">~</button>
              )}
              {crumbs.map((c, i) => (
                <span key={i} className="flex items-center flex-shrink-0">
                  <span className="mx-0.5 text-[11px]" style={{ color: 'var(--text-dim)' }}>{sep}</span>
                  <button onClick={() => nav(i)} className="text-[11px] font-medium text-blue-500 hover:text-blue-400 transition-colors max-w-[120px] truncate">{c}</button>
                </span>
              ))}
              {crumbs.length > 0 && (
                <button
                  onClick={goUp}
                  className="ml-2 flex items-center justify-center w-5 h-5 rounded flex-shrink-0 text-[var(--text-dim)] hover:text-foreground hover:bg-[var(--bg-raised)] transition-colors"
                  title="Go up (Backspace)"
                >
                  <UpIcon />
                </button>
              )}
            </div>

            {/* Entries */}
            <div ref={listRef} className="flex-1 overflow-y-auto py-1 px-1">
              {loading ? (
                <div className="space-y-0.5 p-1">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-8 rounded-lg animate-pulse" style={{ background: 'color-mix(in oklch, var(--bg-raised) 40%, transparent)' }} />
                  ))}
                </div>
              ) : error ? (
                <div className="px-4 py-4 flex flex-col gap-2">
                  {error.isPermission ? (
                    <>
                      <p className="text-xs font-medium" style={{ color: 'var(--color-warning, #f59e0b)' }}>Permission denied</p>
                      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
                        macOS blocked access. Grant <strong>Full Disk Access</strong> in{' '}
                        <strong>System Settings → Privacy &amp; Security → Full Disk Access</strong>, then restart.
                      </p>
                    </>
                  ) : (
                    <p className="text-xs" style={{ color: 'var(--text-dim)' }}>{error.message}</p>
                  )}
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-4 py-4 text-xs" style={{ color: 'var(--text-dim)' }}>
                  {filter ? 'No folders match' : 'No subdirectories'}
                </div>
              ) : (
                filtered.map((e, i) => (
                  <button
                    key={e.path}
                    ref={i === activeIdx ? activeRef : undefined}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs transition-colors"
                    style={{
                      background: i === activeIdx ? 'color-mix(in oklch, var(--primary) 12%, transparent)' : undefined,
                      color: i === activeIdx ? 'var(--foreground)' : 'var(--text-soft)',
                      outline: i === activeIdx ? '1px solid color-mix(in oklch, var(--primary) 25%, transparent)' : undefined,
                    }}
                    onMouseEnter={ev => { if (i !== activeIdx) (ev.currentTarget as HTMLElement).style.background = 'color-mix(in oklch, var(--bg-raised) 55%, transparent)'; setActiveIdx(i); }}
                    onMouseLeave={ev => { if (i !== activeIdx) (ev.currentTarget as HTMLElement).style.background = ''; }}
                    onDoubleClick={() => { if (e.isDirectory) { setCur(e.path); load(e.path); } else { choose(e.path); } }}
                    onClick={() => { setActiveIdx(i); if (!e.isDirectory) choose(e.path); }}
                  >
                    {e.isGitRepo ? <RepoIcon /> : e.isDirectory ? <FolderIcon /> : <FileEntryIcon name={e.name} />}
                    <span className="flex-1 truncate font-medium">{e.name}</span>
                    {e.isGitRepo && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: 'color-mix(in oklch, var(--primary) 15%, transparent)', color: 'var(--primary)', border: '1px solid color-mix(in oklch, var(--primary) 25%, transparent)' }}>
                        git
                      </span>
                    )}
                    {!e.isDirectory && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: 'color-mix(in oklch, var(--bg-raised) 80%, transparent)', color: 'var(--text-dim)', border: '1px solid color-mix(in oklch, var(--border-subtle) 60%, transparent)' }}>
                        {e.name.split('.').pop()}
                      </span>
                    )}
                    <span className="text-[10px] opacity-40 flex-shrink-0">{e.isDirectory ? '↵ open' : '↵ select'}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 flex-shrink-0"
          style={{ borderTop: '1px solid color-mix(in oklch, var(--border-subtle) 50%, transparent)', background: 'color-mix(in oklch, var(--bg-raised) 30%, transparent)' }}>
          <div className="flex items-center gap-2 min-w-0">
            <FolderIcon tint="blue" />
            <span className="text-[11px] truncate" style={{ color: 'var(--text-dim)' }}>{resolved || '…'}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] hidden sm:flex items-center gap-1.5" style={{ color: 'var(--text-dim)' }}>
              <kbd className="px-1 py-0.5 rounded text-[9px] font-mono" style={{ background: 'var(--bg-raised)', border: '1px solid color-mix(in oklch, var(--border-subtle) 80%, transparent)' }}>↑↓</kbd> navigate
              <kbd className="px-1 py-0.5 rounded text-[9px] font-mono" style={{ background: 'var(--bg-raised)', border: '1px solid color-mix(in oklch, var(--border-subtle) 80%, transparent)' }}>↵</kbd> open
              <kbd className="px-1 py-0.5 rounded text-[9px] font-mono" style={{ background: 'var(--bg-raised)', border: '1px solid color-mix(in oklch, var(--border-subtle) 80%, transparent)' }}>⌫</kbd> up
            </span>
            <button onClick={onClose}
              className="h-7 px-3 rounded-lg text-xs text-[var(--text-dim)] hover:text-foreground hover:bg-[var(--bg-raised)] transition-colors">
              Cancel
            </button>
            <button
              onClick={() => {
                const sel = activeIdx >= 0 && filtered[activeIdx] ? filtered[activeIdx].path : resolved;
                choose(sel || resolved);
              }}
              disabled={!resolved}
              className="h-7 px-4 rounded-lg text-xs font-medium bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              Select
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}

function FileEntryIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const colors: Record<string, string> = {
    ts: 'oklch(0.65 0.2 240)', tsx: 'oklch(0.65 0.2 240)',
    js: 'oklch(0.75 0.18 80)', jsx: 'oklch(0.75 0.18 80)',
    py: 'oklch(0.65 0.18 145)', go: 'oklch(0.65 0.18 200)',
    rs: 'oklch(0.65 0.2 35)', css: 'oklch(0.65 0.2 320)',
    md: 'var(--text-soft)', json: 'oklch(0.75 0.18 80)',
  };
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" className="flex-shrink-0"
      style={{ color: colors[ext] || 'var(--text-dim)' }}>
      <path d="M4 0h5.5l4.5 4.5V14a2 2 0 01-2 2H4a2 2 0 01-2-2V2a2 2 0 012-2zm5 0v4.5H14L9 0z"/>
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0" style={{ color: 'var(--text-dim)' }}>
      <circle cx="6.5" cy="6.5" r="4.5"/><line x1="10.5" y1="10.5" x2="14" y2="14"/>
    </svg>
  );
}

function FolderIcon({ tint, className = '' }: { tint?: 'blue' | 'yellow' | 'green'; className?: string } = {}) {
  const color = tint === 'blue' ? 'oklch(0.65 0.2 240)' : tint === 'yellow' ? 'oklch(0.75 0.18 80)' : tint === 'green' ? 'oklch(0.65 0.18 145)' : 'var(--text-soft)';
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className={`flex-shrink-0 ${className}`} style={{ color }}>
      <path d="M1 3.5A1.5 1.5 0 012.5 2h3.764c.69 0 1.35.28 1.837.78L9 3.5h4.5A1.5 1.5 0 0115 5v7.5A1.5 1.5 0 0113.5 14h-11A1.5 1.5 0 011 12.5v-9z"/>
    </svg>
  );
}

function RepoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="flex-shrink-0" style={{ color: 'var(--primary)' }}>
      <circle cx="5" cy="3.5" r="1.5"/><circle cx="5" cy="12.5" r="1.5"/>
      <circle cx="11" cy="3.5" r="1.5"/>
      <line x1="5" y1="5" x2="5" y2="11"/><path d="M5 6a3 3 0 003 3h2"/>
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0" style={{ color: 'var(--text-soft)' }}>
      <path d="M1 7l7-6 7 6"/><path d="M3 6v7a1 1 0 001 1h3v-4h2v4h3a1 1 0 001-1V6"/>
    </svg>
  );
}

function RecentIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0" style={{ color: 'var(--text-dim)' }}>
      <circle cx="8" cy="8" r="6.5"/><path d="M8 4.5V8l2.5 2.5"/>
    </svg>
  );
}

function UpIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 8V2M2 5l3-3 3 3"/>
    </svg>
  );
}
