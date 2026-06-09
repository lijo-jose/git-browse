'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Toaster } from '@/components/ui/sonner';
import ThemeToggle from '@/components/ThemeToggle';
import { parseDiff } from '@/components/compare/diffUtils';

/* ── Types ──────────────────────────────────────────────────────────────── */
interface Refs { branches: string[]; tags: string[]; recent: { hash: string; short: string; subject: string }[] }
interface CompareFile { path: string; insertions: number; deletions: number; }
interface FsEntry { name: string; path: string; isDirectory: boolean; isGitRepo: boolean; }

/* ── Page ───────────────────────────────────────────────────────────────── */
export default function GitComparePage() {
  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <header className="flex items-center gap-3 px-5 h-12 shrink-0" style={{
        background: 'var(--bg-panel)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <Link href="/" className="flex items-center gap-1.5 text-xs font-medium transition-colors"
          style={{ color: 'var(--text-dim)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--foreground)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          GitBrowse
        </Link>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--border-subtle)' }}><path d="M9 18l6-6-6-6"/></svg>
        <span className="text-sm font-semibold">Git Compare</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--bg-raised)', color: 'var(--text-dim)' }}>branch · tag · commit</span>
        <div className="ml-auto"><ThemeToggle /></div>
      </header>

      <GitCompareMain />

      <Toaster theme="dark" position="bottom-right" />
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */
function GitCompareMain() {
  const [repo, setRepo] = useState('');
  const [refs, setRefs] = useState<Refs | null>(null);

  // Pre-fill repo from ?repo= query param
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const r = p.get('repo');
    if (r) setRepo(r);
  }, []);
  const [refsLoading, setRefsLoading] = useState(false);
  const [base, setBase] = useState('');
  const [target, setTarget] = useState('HEAD');
  const [files, setFiles] = useState<CompareFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [selFile, setSelFile] = useState<string | null>(null);
  const [diff, setDiff] = useState('');
  const [diffLoading, setDiffLoading] = useState(false);
  const [error, setError] = useState('');
  const [fileFilter, setFileFilter] = useState('');
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('split');
  const [wrap, setWrap] = useState(false);

  // Load refs when repo changes
  useEffect(() => {
    if (!repo) { setRefs(null); setBase(''); setFiles([]); setSelFile(null); setDiff(''); return; }
    setRefsLoading(true); setBase(''); setFiles([]); setSelFile(null); setDiff('');
    fetch(`/api/git/compare?repo=${encodeURIComponent(repo)}&mode=refs`)
      .then(r => r.json())
      .then(d => { if (!d.error) setRefs(d); })
      .finally(() => setRefsLoading(false));
  }, [repo]);

  // Load changed files when base or target changes
  useEffect(() => {
    if (!repo || !base) { setFiles([]); setSelFile(null); setDiff(''); return; }
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
    if (!selFile || !base || !repo) { setDiff(''); return; }
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
    <div className="flex flex-1 overflow-hidden min-h-0">
      {/* ── Sidebar ── */}
      <aside className="w-72 shrink-0 flex flex-col overflow-hidden" style={{
        background: 'var(--bg-panel)',
        borderRight: '1px solid var(--border-subtle)',
      }}>
        {/* Repo picker */}
        <div className="shrink-0 px-3 pt-3 pb-3 space-y-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>Repository</p>
          <RepoPicker value={repo} onChange={setRepo} />
        </div>

        {/* Ref pickers */}
        <div className="shrink-0 px-3 pt-3 pb-3 space-y-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>From</p>
          {!repo ? (
            <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>Select a repository first</p>
          ) : (
            <RefPicker refs={refs} loading={refsLoading} value={base} onChange={setBase} placeholder="Select base branch / commit…" />
          )}
          <p className="text-[10px] font-bold uppercase tracking-widest pt-1" style={{ color: 'var(--text-dim)' }}>To</p>
          {!repo ? null : (
            <RefPicker refs={refs} loading={refsLoading} value={target} onChange={setTarget} placeholder="HEAD" extraOption="HEAD" />
          )}
        </div>

        {/* Stats */}
        {files.length > 0 && (
          <div className="shrink-0 flex items-center gap-2 px-3 py-2 flex-wrap" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <span className="text-[11px]" style={{ color: 'var(--text-dim)' }}>{files.length} file{files.length !== 1 ? 's' : ''}</span>
            {totalAdded > 0 && <span className="text-[11px] font-semibold" style={{ color: '#10b981' }}>+{totalAdded}</span>}
            {totalRemoved > 0 && <span className="text-[11px] font-semibold" style={{ color: '#ef4444' }}>−{totalRemoved}</span>}
          </div>
        )}

        {/* File filter */}
        {files.length > 0 && (
          <div className="shrink-0 px-3 py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <input
              value={fileFilter}
              onChange={e => setFileFilter(e.target.value)}
              placeholder="Filter files…"
              className="w-full px-2.5 py-1.5 text-[11px] rounded-lg outline-none"
              style={{ background: 'var(--bg-raised)', color: 'var(--foreground)', border: '1px solid var(--border-subtle)' }}
            />
          </div>
        )}

        {/* File list */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="m-3 p-3 rounded-xl text-xs" style={{ background: 'oklch(0.17 0.07 15 / 0.3)', border: '1px solid oklch(0.64 0.20 15 / 0.3)', color: 'oklch(0.88 0.06 15)' }}>
              {error}
            </div>
          )}
          {filesLoading ? (
            <LoadingSkeleton />
          ) : !repo || !base ? (
            <EmptyHint icon="git">
              {!repo ? 'Select a repository' : 'Pick a branch, tag, or commit'}
            </EmptyHint>
          ) : files.length === 0 && !error ? (
            <EmptyHint icon="check">No differences from <code className="font-mono">{base}</code></EmptyHint>
          ) : (
            filteredFiles.map(f => (
              <FileRow
                key={f.path}
                file={f}
                active={selFile === f.path}
                onClick={() => setSelFile(f.path)}
              />
            ))
          )}
        </div>
      </aside>

      {/* ── Main diff area ── */}
      <main className="flex-1 flex flex-col min-h-0 min-w-0" style={{ background: 'var(--background)' }}>
        {!selFile ? (
          <EmptyHint icon="diff">Select a file from the list to view its diff</EmptyHint>
        ) : (
          <GitDiffViewer
            diff={diff}
            loading={diffLoading}
            filePath={selFile}
            base={base}
            target={target}
            mode={viewMode}
            onModeChange={setViewMode}
            wrap={wrap}
            onWrapChange={setWrap}
          />
        )}
      </main>
    </div>
  );
}

/* ── Repo Picker ─────────────────────────────────────────────────────────── */
function RepoPicker({ value, onChange }: { value: string; onChange: (p: string) => void }) {
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

  const crumbs = resolved.split('/').filter(Boolean);
  const dirs = entries.filter(e => e.isDirectory);
  const shortName = value ? value.split('/').pop() || value : null;

  return (
    <div className="space-y-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 h-9 px-3 rounded-xl text-xs font-medium transition-all duration-150"
        style={{
          background: open ? 'color-mix(in oklch, var(--primary) 15%, transparent)' : 'var(--bg-raised)',
          border: `1.5px solid ${open ? 'var(--primary)' : 'var(--border-subtle)'}`,
          color: value ? 'var(--foreground)' : 'var(--text-dim)',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" style={{ color: 'var(--primary)', opacity: 0.8 }}>
          <circle cx="4" cy="3" r="1.5"/><circle cx="4" cy="13" r="1.5"/><circle cx="12" cy="3" r="1.5"/>
          <line x1="4" y1="4.5" x2="4" y2="11.5"/>
          <path d="M4 7a4 4 0 004 4h3"/>
        </svg>
        <span className="font-mono truncate flex-1 text-left text-[11px]">{shortName ?? 'Choose git repo…'}</span>
        {value && (
          <span className="shrink-0 opacity-40 hover:opacity-100 transition-opacity" onClick={e => { e.stopPropagation(); onChange(''); }}>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 3L3 9M3 3l6 6"/></svg>
          </span>
        )}
      </button>

      {open && (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
          {/* Breadcrumbs */}
          <div className="flex items-center gap-0.5 px-2 py-1.5 overflow-x-auto" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-raised)' }}>
            <button onClick={() => { setCur('~'); load('~'); }} className="text-[10px] font-mono px-1.5 py-0.5 rounded-md shrink-0" style={{ color: 'var(--text-dim)' }}>~</button>
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-0.5">
                <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ color: 'var(--border-subtle)' }}><path d="M4 2l4 4-4 4"/></svg>
                <button onClick={() => { const p = '/' + crumbs.slice(0, i + 1).join('/'); setCur(p); load(p); }}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded-md shrink-0 max-w-[72px] truncate"
                  style={{ color: 'var(--text-soft)' }}>{c}</button>
              </span>
            ))}
          </div>

          {/* Entries */}
          <div className="max-h-52 overflow-y-auto">
            {fetching ? (
              <div className="p-2 space-y-1">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-7 rounded-lg animate-pulse" style={{ background: 'var(--bg-raised)', opacity: 1 - i * 0.15 }} />)}</div>
            ) : dirs.length === 0 ? (
              <p className="p-4 text-center text-[11px]" style={{ color: 'var(--text-dim)' }}>No folders</p>
            ) : (
              dirs.map(e => (
                <button key={e.path}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-left transition-colors"
                  style={{ color: 'var(--foreground)' }}
                  onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = 'var(--bg-raised)'}
                  onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = ''}
                  onClick={() => { setCur(e.path); load(e.path); }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ color: e.isGitRepo ? 'var(--primary)' : 'var(--text-dim)', opacity: 0.8 }}>
                    <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
                  </svg>
                  <span className="font-mono truncate flex-1">{e.name}</span>
                  {e.isGitRepo && <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold" style={{ background: 'color-mix(in oklch, var(--primary) 15%, transparent)', color: 'var(--primary)' }}>git</span>}
                </button>
              ))
            )}
          </div>

          {/* Select button */}
          <div className="flex items-center justify-between px-3 py-2 gap-2" style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-raised)' }}>
            <span className="font-mono text-[10px] truncate flex-1" style={{ color: 'var(--text-dim)' }}>{resolved}</span>
            <button
              onClick={() => {
                const entry = entries.find(e => e.path === resolved) ?? { isGitRepo: resolved.endsWith('/.git') };
                // Check if we're in a git repo
                const selectedDir = dirs.find(d => d.path === resolved);
                if (selectedDir?.isGitRepo || entries.some(e => e.name === '.git')) {
                  onChange(resolved); setOpen(false);
                } else {
                  onChange(resolved); setOpen(false);
                }
              }}
              className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--primary)' }}
            >
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M2 6l3 3 5-5"/></svg>
              Select
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Ref Picker ──────────────────────────────────────────────────────────── */
function RefPicker({ refs, loading, value, onChange, placeholder = 'Select branch / tag / commit…', extraOption }: {
  refs: Refs | null; loading: boolean; value: string; onChange: (v: string) => void;
  placeholder?: string; extraOption?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
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
        className="w-full flex items-center justify-between h-9 px-3 rounded-xl text-xs font-medium transition-all"
        style={{
          background: open ? 'color-mix(in oklch, var(--primary) 15%, transparent)' : 'var(--bg-raised)',
          border: `1.5px solid ${open ? 'var(--primary)' : 'var(--border-subtle)'}`,
          color: value ? 'var(--foreground)' : 'var(--text-dim)',
        }}
      >
        <span className="font-mono truncate text-[11px] text-left flex-1">{value || placeholder}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 ml-1">
          <path d="M2 3.5l3 3 3-3"/>
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl shadow-2xl overflow-hidden"
          style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', maxHeight: 300 }}>
          <div className="p-1.5">
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Filter refs or type a SHA…"
              className="w-full px-2.5 py-1.5 text-[11px] rounded-lg outline-none"
              style={{ background: 'var(--bg-raised)', color: 'var(--foreground)', border: '1px solid var(--border-subtle)' }}
              onKeyDown={e => {
                if (e.key === 'Escape') setOpen(false);
                if (e.key === 'Enter' && query.trim()) { onChange(query.trim()); setOpen(false); }
              }}
            />
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 240 }}>
            {loading ? (
              <div className="px-3 py-4 text-xs text-center" style={{ color: 'var(--text-dim)' }}>Loading refs…</div>
            ) : groups.length === 0 ? (
              query ? (
                <button
                  onClick={() => { onChange(query); setOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs font-mono transition-colors"
                  style={{ color: 'var(--text-soft)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-raised)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                >
                  Use &ldquo;{query}&rdquo; as ref ↵
                </button>
              ) : (
                <div className="px-3 py-4 text-xs text-center" style={{ color: 'var(--text-dim)' }}>No refs found</div>
              )
            ) : groups.map(group => (
              <div key={group}>
                <div className="px-3 py-1 text-[10px] font-bold tracking-widest uppercase sticky top-0"
                  style={{ color: 'var(--text-dim)', background: 'var(--bg-panel)' }}>{group}</div>
                {filtered.filter(r => r.group === group).map(r => (
                  <button
                    key={r.value}
                    onClick={() => { onChange(r.value); setOpen(false); }}
                    className="w-full text-left px-3 py-1.5 text-[11px] font-mono flex items-center gap-2 transition-colors"
                    style={{ color: r.value === value ? 'var(--foreground)' : 'var(--text-soft)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-raised)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                  >
                    {r.value === value && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--primary)' }} />}
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

/* ── File row ────────────────────────────────────────────────────────────── */
function FileRow({ file, active, onClick }: { file: CompareFile; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 text-left transition-all"
      style={active
        ? { background: 'color-mix(in oklch, var(--primary) 10%, transparent)', borderLeft: '2px solid var(--primary)', paddingLeft: 10 }
        : { borderLeft: '2px solid transparent' }
      }
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--bg-raised)'; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = ''; }}
    >
      <span className="font-mono text-[11px] truncate flex-1" style={{ color: active ? 'var(--primary)' : 'var(--foreground)' }}
        title={file.path}>{file.path}</span>
      <span className="flex-shrink-0 flex gap-1.5 text-[10px] font-semibold">
        {file.insertions > 0 && <span style={{ color: '#10b981' }}>+{file.insertions}</span>}
        {file.deletions > 0  && <span style={{ color: '#ef4444' }}>−{file.deletions}</span>}
      </span>
    </button>
  );
}

/* ── Git Diff Viewer ─────────────────────────────────────────────────────── */
interface GitDiffViewerProps {
  diff: string; loading: boolean; filePath: string; base: string; target: string;
  mode: 'unified' | 'split'; onModeChange: (m: 'unified' | 'split') => void;
  wrap: boolean; onWrapChange: (w: boolean) => void;
}

function GitDiffViewer({ diff, loading, filePath, base, target, mode, onModeChange, wrap, onWrapChange }: GitDiffViewerProps) {
  const lines = parseDiff(diff);

  // Group into hunks
  const hunks: { header: string; lines: ReturnType<typeof parseDiff> }[] = [];
  let currentHunk: ReturnType<typeof parseDiff> = [];
  let currentHeader = '';
  for (const line of lines) {
    if (line.type === 'header') {
      if (currentHunk.length || currentHeader) hunks.push({ header: currentHeader, lines: currentHunk });
      currentHeader = line.content;
      currentHunk = [];
    } else if (line.type !== 'meta') {
      currentHunk.push(line);
    }
  }
  if (currentHunk.length || currentHeader) hunks.push({ header: currentHeader, lines: currentHunk });

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-panel)' }}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-dim)', flexShrink: 0 }}>
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
          </svg>
          <span className="text-[11px] font-mono truncate" style={{ color: 'var(--text-soft)' }}>{filePath}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-mono shrink-0" style={{ background: 'var(--bg-raised)', color: 'var(--text-dim)' }}>
            {base.length > 14 ? base.slice(0, 10) + '…' : base} → {target.length > 14 ? target.slice(0, 10) + '…' : target}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onWrapChange(!wrap)}
            className="text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors"
            style={wrap ? { background: 'var(--bg-raised)', color: 'var(--foreground)', outline: '1px solid var(--border-subtle)' } : { color: 'var(--text-dim)' }}
          >wrap</button>
          {(['unified', 'split'] as const).map(m => (
            <button key={m} onClick={() => onModeChange(m)}
              className="text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors"
              style={mode === m
                ? { background: 'var(--bg-raised)', color: 'var(--foreground)', outline: '1px solid var(--border-subtle)' }
                : { color: 'var(--text-dim)' }}
            >{m}</button>
          ))}
        </div>
      </div>

      {/* Diff content */}
      <div className="flex-1 overflow-auto font-mono text-[11px]">
        {loading ? (
          <LoadingSkeleton />
        ) : hunks.length === 0 ? (
          <EmptyHint icon="check">No changes in this file</EmptyHint>
        ) : (
          <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
            <tbody>
              {hunks.map((hunk, hi) => (
                <>
                  {/* Hunk header */}
                  <tr key={`h${hi}`}>
                    <td colSpan={mode === 'split' ? 4 : 3} className="px-4 py-1 text-[10px] font-mono select-none"
                      style={{ background: 'rgba(96,165,250,0.08)', color: '#60a5fa', borderTop: hi > 0 ? '1px solid var(--border-subtle)' : undefined }}>
                      {hunk.header}
                    </td>
                  </tr>
                  {mode === 'unified'
                    ? hunk.lines.map((l, li) => <UnifiedRow key={`${hi}-${li}`} line={l} wrap={wrap} />)
                    : splitPairs(hunk.lines).map((p, li) => <SplitRow key={`${hi}-${li}`} pair={p} wrap={wrap} />)
                  }
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function UnifiedRow({ line, wrap }: { line: ReturnType<typeof parseDiff>[0]; wrap: boolean }) {
  const bg = line.type === 'add' ? 'rgba(16,185,129,0.09)' : line.type === 'remove' ? 'rgba(239,68,68,0.09)' : 'transparent';
  const sigColor = line.type === 'add' ? '#10b981' : line.type === 'remove' ? '#ef4444' : 'var(--text-dim)';
  return (
    <tr style={{ background: bg }}>
      <td className="select-none text-right pr-2 pl-3 w-10 align-top pt-px" style={{ color: sigColor, opacity: 0.5 }}>
        {line.type === 'add' ? line.newLine : line.type === 'remove' ? line.oldLine : line.oldLine ?? ''}
      </td>
      <td className="w-5 text-center select-none align-top pt-px" style={{ color: sigColor }}>
        {line.type === 'add' ? '+' : line.type === 'remove' ? '−' : ' '}
      </td>
      <td className="pr-4 align-top" style={{ color: 'var(--text-soft)', paddingTop: 1, paddingBottom: 1, whiteSpace: wrap ? 'pre-wrap' : 'pre', wordBreak: wrap ? 'break-all' : undefined }}>{line.content}</td>
    </tr>
  );
}

function SplitRow({ pair, wrap }: { pair: { left?: ReturnType<typeof parseDiff>[0]; right?: ReturnType<typeof parseDiff>[0] }; wrap: boolean }) {
  const lBg = pair.left?.type === 'remove' ? 'rgba(239,68,68,0.09)' : 'transparent';
  const rBg = pair.right?.type === 'add' ? 'rgba(16,185,129,0.09)' : 'transparent';
  const ws: React.CSSProperties = { whiteSpace: wrap ? 'pre-wrap' : 'pre', wordBreak: wrap ? 'break-all' : undefined };
  return (
    <tr>
      <td className="select-none text-right pr-1 pl-2 w-8 border-r align-top pt-px" style={{ color: 'var(--text-dim)', opacity: 0.4, background: lBg, borderColor: 'var(--border-subtle)' }}>
        {pair.left?.oldLine ?? ''}
      </td>
      <td className="px-2 align-top" style={{ background: lBg, color: 'var(--text-soft)', width: 'calc(50% - 2rem)', paddingTop: 1, paddingBottom: 1, ...ws }}>
        {pair.left?.content ?? ''}
      </td>
      <td className="select-none text-right pr-1 pl-2 w-8 border-l border-r align-top pt-px" style={{ color: 'var(--text-dim)', opacity: 0.4, background: rBg, borderColor: 'var(--border-subtle)' }}>
        {pair.right?.newLine ?? ''}
      </td>
      <td className="px-2 align-top" style={{ background: rBg, color: 'var(--text-soft)', width: 'calc(50% - 2rem)', paddingTop: 1, paddingBottom: 1, ...ws }}>
        {pair.right?.content ?? ''}
      </td>
    </tr>
  );
}

function splitPairs(lines: ReturnType<typeof parseDiff>) {
  const pairs: { left?: ReturnType<typeof parseDiff>[0]; right?: ReturnType<typeof parseDiff>[0] }[] = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.type === 'remove' && lines[i + 1]?.type === 'add') { pairs.push({ left: l, right: lines[i + 1] }); i += 2; }
    else if (l.type === 'remove') { pairs.push({ left: l }); i++; }
    else if (l.type === 'add')    { pairs.push({ right: l }); i++; }
    else                          { pairs.push({ left: l, right: l }); i++; }
  }
  return pairs;
}

/* ── Shared helpers ──────────────────────────────────────────────────────── */
function EmptyHint({ icon, children }: { icon: 'git' | 'diff' | 'check'; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 h-full gap-3 p-6" style={{ color: 'var(--text-dim)' }}>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'var(--bg-raised)' }}>
        {icon === 'git' && (
          <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="4" cy="3" r="1.5"/><circle cx="4" cy="13" r="1.5"/><circle cx="12" cy="3" r="1.5"/>
            <line x1="4" y1="4.5" x2="4" y2="11.5"/>
            <path d="M4 7a4 4 0 004 4h3"/>
          </svg>
        )}
        {icon === 'diff' && (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-3"/>
            <path d="M9 7V5a2 2 0 012-2h2M9 7h6"/>
            <path d="M20 12h-8m0 0l3-3m-3 3l3 3"/>
          </svg>
        )}
        {icon === 'check' && (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        )}
      </div>
      <p className="text-xs text-center leading-relaxed max-w-[180px]">{children}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-3 space-y-1.5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="h-5 rounded animate-pulse" style={{ background: 'var(--bg-raised)', opacity: 1 - i * 0.08 }} />
      ))}
    </div>
  );
}
