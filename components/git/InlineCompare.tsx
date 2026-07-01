'use client';

import { useEffect, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import FileDiffViewer from '@/components/compare/FileDiffViewer';

interface CompareFile { path: string; insertions: number; deletions: number; }
interface Refs { branches: string[]; tags: string[]; recent: { hash: string; short: string; subject: string }[] }

interface Props {
  repo: string;
  initialBase?: string;   // pre-selected ref (e.g. branch name from BranchList)
  onClose: () => void;
}

export default function InlineCompare({ repo, initialBase = '', onClose }: Props) {
  const [refs, setRefs] = useState<Refs | null>(null);
  const [refsLoading, setRefsLoading] = useState(false);
  const [base, setBase] = useState(initialBase);
  const [target, setTarget] = useState('HEAD');
  const [files, setFiles] = useState<CompareFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [selFile, setSelFile] = useState<string | null>(null);
  const [diff, setDiff] = useState('');
  const [diffLoading, setDiffLoading] = useState(false);
  const [error, setError] = useState('');
  const [fileFilter, setFileFilter] = useState('');

  // Load refs
  useEffect(() => {
    if (!repo) return;
    setRefsLoading(true);
    fetch(`/api/git/compare?repo=${encodeURIComponent(repo)}&mode=refs`)
      .then(r => r.json())
      .then(d => { if (!d.error) setRefs(d); })
      .finally(() => setRefsLoading(false));
  }, [repo]);

  // Load files when base or target changes
  useEffect(() => {
    if (!base) { setFiles([]); setSelFile(null); setDiff(''); return; }
    setFilesLoading(true); setError(''); setSelFile(null); setDiff('');
    const p = new URLSearchParams({ repo, mode: 'files', base, target });
    fetch(`/api/git/compare?${p}`)
      .then(r => r.json())
      .then(d => { if (d.error) { setError(d.error); setFiles([]); } else setFiles(d.files || []); })
      .catch(e => setError(String(e)))
      .finally(() => setFilesLoading(false));
  }, [repo, base, target]);

  // Load diff when file selected
  useEffect(() => {
    if (!selFile || !base) { setDiff(''); return; }
    setDiffLoading(true);
    const p = new URLSearchParams({ repo, mode: 'diff', base, target, file: selFile });
    fetch(`/api/git/compare?${p}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setDiff(d.diff || ''); })
      .finally(() => setDiffLoading(false));
  }, [repo, base, target, selFile]);

  const totalAdded = files.reduce((s, f) => s + f.insertions, 0);
  const totalRemoved = files.reduce((s, f) => s + f.deletions, 0);
  const filteredFiles = fileFilter
    ? files.filter(f => f.path.toLowerCase().includes(fileFilter.toLowerCase()))
    : files;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Top bar ── */}
      <div className="h-9 flex items-center gap-2 px-3 flex-shrink-0 border-b"
        style={{ borderColor: 'color-mix(in oklch, var(--border-subtle) 60%, transparent)', background: 'var(--bg-panel)' }}>

        {/* Git compare icon */}
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          style={{ color: 'var(--primary)', flexShrink: 0 }}>
          <circle cx="4" cy="3" r="1.5"/><circle cx="4" cy="13" r="1.5"/><circle cx="12" cy="3" r="1.5"/>
          <line x1="4" y1="4.5" x2="4" y2="11.5"/><path d="M4 7a4 4 0 004 4h3"/>
        </svg>

        <span className="text-[11px] font-semibold" style={{ color: 'var(--foreground)' }}>Compare</span>

        {/* Inline ref pickers: base ↔ target */}
        <div className="flex items-center gap-1 ml-1">
          <RefDropdown refs={refs} loading={refsLoading} value={base} onChange={(v) => { setBase(v); }} placeholder="base…" />
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="flex-shrink-0 opacity-40">
            <path d="M3 8h10M9 4l4 4-4 4"/>
          </svg>
          <RefDropdown refs={refs} loading={refsLoading} value={target} onChange={setTarget} placeholder="target…" extraOption="HEAD" />
        </div>

        {/* Stats */}
        {files.length > 0 && (
          <div className="flex items-center gap-2 ml-2">
            <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>{files.length} files</span>
            {totalAdded > 0 && <span className="text-[10px] font-semibold" style={{ color: '#10b981' }}>+{totalAdded}</span>}
            {totalRemoved > 0 && <span className="text-[10px] font-semibold" style={{ color: '#ef4444' }}>−{totalRemoved}</span>}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1">
          {/* Open full-page compare */}
          <a
            href={`/compare?mode=git${repo ? `&repo=${encodeURIComponent(repo)}` : ''}${base ? `&base=${encodeURIComponent(base)}` : ''}`}
            title="Open in full page"
            target="_blank"
            rel="noreferrer"
            className="w-6 h-6 flex items-center justify-center rounded-md transition-colors"
            style={{ color: 'var(--text-dim)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-raised)'; (e.currentTarget as HTMLElement).style.color = 'var(--foreground)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'; }}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 2h3v3M10 2L6 6M5 3H3a1 1 0 00-1 1v5a1 1 0 001 1h5a1 1 0 001-1V7"/>
            </svg>
          </a>
          {/* Close / exit compare mode */}
          <button onClick={onClose} title="Exit compare"
            className="ml-2 w-6 h-6 flex items-center justify-center rounded-md transition-colors"
            style={{ color: 'var(--text-dim)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-raised)'; (e.currentTarget as HTMLElement).style.color = 'var(--foreground)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'; }}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 3L3 9M3 3l6 6"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Body: file list + diff viewer ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* File list sidebar */}
        <div className="flex flex-col border-r flex-shrink-0"
          style={{ width: 260, borderColor: 'color-mix(in oklch, var(--border-subtle) 60%, transparent)', background: 'var(--bg-panel)' }}>

          {/* Filter */}
          <div className="flex-shrink-0 px-2 py-2 border-b"
            style={{ borderColor: 'color-mix(in oklch, var(--border-subtle) 60%, transparent)' }}>
            <input
              value={fileFilter}
              onChange={e => setFileFilter(e.target.value)}
              placeholder="Filter files…"
              className="w-full px-2.5 py-1 text-[11px] rounded-lg outline-none"
              style={{ background: 'var(--bg-raised)', color: 'var(--foreground)', border: '1px solid var(--border-subtle)' }}
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {error && (
              <div className="m-2 p-2 rounded-lg text-[11px]"
                style={{ background: 'oklch(0.17 0.07 15 / 0.3)', border: '1px solid oklch(0.64 0.20 15 / 0.3)', color: 'oklch(0.88 0.06 15)' }}>
                {error}
              </div>
            )}
            {filesLoading ? (
              <div className="p-2 space-y-1">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-7 rounded-lg" style={{ opacity: 1 - i * 0.1 }} />
                ))}
              </div>
            ) : !base ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 p-4" style={{ color: 'var(--text-dim)' }}>
                <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="opacity-40">
                  <circle cx="4" cy="3" r="1.5"/><circle cx="4" cy="13" r="1.5"/><circle cx="12" cy="3" r="1.5"/>
                  <line x1="4" y1="4.5" x2="4" y2="11.5"/><path d="M4 7a4 4 0 004 4h3"/>
                </svg>
                <p className="text-[11px] text-center">Pick a branch or commit to compare</p>
              </div>
            ) : files.length === 0 && !error ? (
              <div className="flex items-center justify-center h-full p-4" style={{ color: 'var(--text-dim)' }}>
                <p className="text-[11px] text-center">No differences from <span className="font-mono">{base}</span></p>
              </div>
            ) : (
              filteredFiles.map(f => (
                <button key={f.path} onClick={() => setSelFile(f.path)}
                  className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 transition-all"
                  style={{
                    background: selFile === f.path ? 'color-mix(in oklch, var(--primary) 10%, transparent)' : 'transparent',
                    borderLeft: `2px solid ${selFile === f.path ? 'var(--primary)' : 'transparent'}`,
                  }}
                  onMouseEnter={e => { if (selFile !== f.path) (e.currentTarget as HTMLElement).style.background = 'var(--bg-raised)'; }}
                  onMouseLeave={e => { if (selFile !== f.path) (e.currentTarget as HTMLElement).style.background = ''; }}
                >
                  <span className="text-[11px] font-mono truncate flex-1"
                    style={{ color: selFile === f.path ? 'var(--primary)' : 'var(--text-soft)' }}
                    title={f.path}>{f.path}</span>
                  <span className="flex gap-1 text-[10px] font-semibold flex-shrink-0">
                    {f.insertions > 0 && <span style={{ color: '#10b981' }}>+{f.insertions}</span>}
                    {f.deletions  > 0 && <span style={{ color: '#ef4444' }}>−{f.deletions}</span>}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Diff viewer — reuse the same polished viewer as /compare */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
          {!selFile ? (
            <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'var(--text-dim)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="opacity-30">
                <path d="M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-3"/>
                <path d="M9 7V5a2 2 0 012-2h2M9 7h6M20 12h-8m0 0l3-3m-3 3l3 3"/>
              </svg>
              <p className="text-xs">Select a file to view diff</p>
            </div>
          ) : diffLoading ? (
            <div className="p-4 space-y-1.5">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="h-4 rounded" style={{ opacity: 1 - i * 0.07 }} />
              ))}
            </div>
          ) : (
            <FileDiffViewer
              key={`${base}::${target}::${selFile}`}
              leftPath=""
              rightPath=""
              relativePath={selFile}
              status="modified"
              rawDiff={diff}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Compact inline ref dropdown ─────────────────────────────────────────── */
function RefDropdown({ refs, loading, value, onChange, placeholder = 'select ref…', extraOption }: {
  refs: Refs | null; loading: boolean; value: string; onChange: (v: string) => void;
  placeholder?: string; extraOption?: string; // e.g. "HEAD" pinned at top
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const allRefs = refs ? [
    ...(extraOption ? [{ label: extraOption, group: 'Special', value: extraOption }] : []),
    ...refs.branches.map(b => ({ label: b, group: 'Branches', value: b })),
    ...refs.tags.map(t => ({ label: t, group: 'Tags', value: t })),
    ...refs.recent.map(r => ({ label: `${r.short}  ${r.subject}`, group: 'Recent commits', value: r.hash })),
  ] : [];

  const filtered = query
    ? allRefs.filter(r => r.label.toLowerCase().includes(query.toLowerCase()))
    : allRefs;
  const groups = Array.from(new Set(filtered.map(r => r.group)));

  return (
    <div className="relative" ref={dropRef}>
      <button
        onClick={() => { setOpen(v => !v); setQuery(''); }}
        className="flex items-center gap-1.5 h-6 px-2.5 rounded-md text-[11px] font-mono transition-all"
        style={{
          background: open ? 'color-mix(in oklch, var(--primary) 15%, transparent)' : 'var(--bg-raised)',
          border: `1px solid ${open ? 'var(--primary)' : 'var(--border-subtle)'}`,
          color: value ? 'var(--foreground)' : 'var(--text-dim)',
          maxWidth: 200,
        }}
      >
        <span className="truncate">{value || placeholder}</span>
        <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" className="flex-shrink-0">
          <path d="M2 3.5l3 3 3-3"/>
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 rounded-xl shadow-2xl overflow-hidden"
          style={{ width: 280, background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)' }}>
          <div className="p-1.5">
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Filter refs or type SHA…"
              className="w-full px-2.5 py-1.5 text-[11px] rounded-lg outline-none"
              style={{ background: 'var(--bg-raised)', color: 'var(--foreground)', border: '1px solid var(--border-subtle)' }}
              onKeyDown={e => {
                if (e.key === 'Escape') setOpen(false);
                if (e.key === 'Enter' && query.trim()) { onChange(query.trim()); setOpen(false); }
              }}
            />
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 260 }}>
            {loading ? (
              <div className="px-3 py-3 text-[11px] text-center" style={{ color: 'var(--text-dim)' }}>Loading…</div>
            ) : groups.length === 0 && query ? (
              <button
                onClick={() => { onChange(query); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-[11px] font-mono transition-colors"
                style={{ color: 'var(--text-soft)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-raised)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
              >Use &ldquo;{query}&rdquo; as ref ↵</button>
            ) : groups.map(group => (
              <div key={group}>
                <div className="px-3 py-1 text-[9px] font-bold tracking-widest uppercase sticky top-0"
                  style={{ color: 'var(--text-dim)', background: 'var(--bg-panel)' }}>{group}</div>
                {filtered.filter(r => r.group === group).map(r => (
                  <button key={r.value}
                    onClick={() => { onChange(r.value); setOpen(false); }}
                    className="w-full text-left px-3 py-1.5 text-[11px] font-mono flex items-center gap-2 transition-colors"
                    style={{ color: r.value === value ? 'var(--foreground)' : 'var(--text-soft)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-raised)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                  >
                    {r.value === value && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--primary)' }} />}
                    <span className="truncate">{r.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

