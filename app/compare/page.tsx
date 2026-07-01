'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import FileDiffViewer from '@/components/compare/FileDiffViewer';
import ClipboardDiffViewer from '@/components/compare/ClipboardDiffViewer';
import HistoryPanel from '@/components/compare/HistoryPanel';
import FileTree from '@/components/compare/FileTree';
import IgnorePatterns, { DEFAULT_PATTERNS } from '@/components/compare/IgnorePatterns';
import { pushHistory, type HistoryEntry } from '@/lib/compareHistory';
import { useDrop } from '@/lib/useDrop';
import { parseDiff } from '@/components/compare/diffUtils';
import DirPicker from '@/components/ui/DirPicker';

type Mode = 'git' | 'folders' | 'files' | 'clipboard';

interface FsEntry { name: string; path: string; isDirectory: boolean; isGitRepo: boolean; }
interface CompareEntry {
  relativePath: string;
  status: 'left-only' | 'right-only' | 'identical' | 'modified';
  leftPath?: string;
  rightPath?: string;
}

export default function ComparePage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('git');

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const m = p.get('mode') as Mode | null;
    if (m && ['git', 'folders', 'files', 'clipboard'].includes(m)) setMode(m);
  }, []);

  const switchMode = (m: Mode) => {
    setMode(m);
    const p = new URLSearchParams(window.location.search);
    p.set('mode', m);
    router.replace(`/compare?${p.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      {/* ── Top bar ── */}
      <header className="flex items-center gap-3 px-5 h-12 shrink-0" style={{
        background: 'var(--bg-panel)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <span className="text-sm font-semibold">Compare</span>

        {/* Mode switcher */}
        <div className="flex items-center gap-0.5 ml-3 px-1 py-1 rounded-xl" style={{ background: 'var(--bg-raised)' }}>
          {([
            ['git',       'Git',       <GitIcon key="g" />],
            ['folders',   'Folders',   <FolderIcon key="f" />],
            ['files',     'Files',     <FileIcon key="fi" />],
            ['clipboard', 'Clipboard', <ClipboardIcon key="c" />],
          ] as [Mode, string, React.ReactNode][]).map(([id, label, icon]) => (
            <button
              key={id}
              onClick={() => switchMode(id)}
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

      {mode === 'git'       && <GitMode />}
      {mode === 'folders'   && <FoldersMode />}
      {mode === 'files'     && <FilesMode />}
      {mode === 'clipboard' && <div className="flex flex-1 min-h-0 overflow-hidden"><ClipboardDiffViewer /></div>}
    </div>
  );
}

/* ── Git mode ────────────────────────────────────────────────────────────── */
interface GitRefs { branches: string[]; tags: string[]; recent: { hash: string; short: string; subject: string }[] }
interface GitFile { path: string; insertions: number; deletions: number; }

function GitMode() {
  const [repo, setRepo] = useState('');
  const [refs, setRefs] = useState<GitRefs | null>(null);
  const [refsLoading, setRefsLoading] = useState(false);
  const [base, setBase] = useState('');
  const [target, setTarget] = useState('HEAD');
  const [files, setFiles] = useState<GitFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [selFile, setSelFile] = useState<string | null>(null);
  const [diff, setDiff] = useState('');
  const [diffLoading, setDiffLoading] = useState(false);
  const [error, setError] = useState('');
  const [fileFilter, setFileFilter] = useState('');
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('split');
  const [wrap, setWrap] = useState(false);

  // Pre-fill repo + base from query params or last-used repo
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const r = p.get('repo');
    const b = p.get('base');
    if (r) { setRepo(r); }
    else {
      try {
        const last = localStorage.getItem('git-browser-last-repo');
        if (last) setRepo(last);
      } catch {}
    }
    if (b) setBase(b);
  }, []);

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

  const totalAdded   = files.reduce((s, f) => s + f.insertions, 0);
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
            {totalAdded   > 0 && <span className="text-[11px] font-semibold" style={{ color: '#10b981' }}>+{totalAdded}</span>}
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
              <GitFileRow
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
  const shortName = value ? value.split('/').pop() || value : null;

  return (
    <div>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 h-9 px-3 rounded-xl text-xs font-medium transition-all duration-150"
        style={{
          background: 'var(--bg-raised)',
          border: `1.5px solid var(--border-subtle)`,
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
      {open && <DirPicker value={value || '~'} onChange={onChange} onClose={() => setOpen(false)} />}
    </div>
  );
}

/* ── Ref Picker ──────────────────────────────────────────────────────────── */
function RefPicker({ refs, loading, value, onChange, placeholder = 'Select branch / tag / commit…', extraOption }: {
  refs: GitRefs | null; loading: boolean; value: string; onChange: (v: string) => void;
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

/* ── Git file row ────────────────────────────────────────────────────────── */
function GitFileRow({ file, active, onClick }: { file: GitFile; active: boolean; onClick: () => void }) {
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
        {file.deletions  > 0 && <span style={{ color: '#ef4444' }}>−{file.deletions}</span>}
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
  const shortName = value ? value.split('/').pop() || value : null;

  const { dragging, error: dropError, handlers: dropHandlers } = useDrop({
    accept: foldersOnly ? 'directory' : 'file',
    onPath: (path) => { onChange(path); },
  });

  return (
    <div className="space-y-1">
      <div
        {...dropHandlers}
        className="relative rounded-xl transition-all duration-150"
        style={{
          outline: dragging ? `2px dashed ${accent}` : undefined,
          background: dragging ? `${accent}12` : undefined,
        }}
      >
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-2 h-9 px-3 rounded-xl text-xs font-medium transition-all duration-150"
          style={{
            background: dragging ? 'transparent' : 'var(--bg-raised)',
            border: `1.5px solid ${dragging ? 'transparent' : 'var(--border-subtle)'}`,
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
        {dragging && (
          <div className="absolute inset-0 rounded-xl flex items-center justify-center pointer-events-none">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: accent }}>
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
        )}
      </div>
      {dropError && <p className="text-[10px] px-1" style={{ color: '#f87171' }}>{dropError}</p>}
      {open && <DirPicker value={value || '~'} onChange={onChange} onClose={() => setOpen(false)} showFiles={!foldersOnly} />}
    </div>
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

function EmptyHint({ icon, children }: { icon: 'git' | 'folder' | 'file' | 'diff' | 'check'; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 h-full gap-3 p-6" style={{ color: 'var(--text-dim)' }}>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'var(--bg-raised)' }}>
        {icon === 'git'    && <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="4" cy="3" r="1.5"/><circle cx="4" cy="13" r="1.5"/><circle cx="12" cy="3" r="1.5"/><line x1="4" y1="4.5" x2="4" y2="11.5"/><path d="M4 7a4 4 0 004 4h3"/></svg>}
        {icon === 'folder' && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>}
        {icon === 'file'   && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
        {icon === 'diff'   && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-3"/><path d="M9 7V5a2 2 0 012-2h2M9 7h6"/><path d="M20 12h-8m0 0l3-3m-3 3l3 3"/></svg>}
        {icon === 'check'  && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 6L9 17l-5-5"/></svg>}
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

function ErrorCard({ msg }: { msg: string }) {
  return (
    <div className="m-3 p-3 rounded-xl text-xs" style={{ background: 'oklch(0.17 0.07 15 / 0.3)', border: '1px solid oklch(0.64 0.20 15 / 0.3)', color: 'oklch(0.88 0.06 15)' }}>{msg}</div>
  );
}

/* ── Icons ── */
function GitIcon() { return <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="4" cy="3" r="1.5"/><circle cx="4" cy="13" r="1.5"/><circle cx="12" cy="3" r="1.5"/><line x1="4" y1="4.5" x2="4" y2="11.5"/><path d="M4 7a4 4 0 004 4h3"/></svg>; }
function FolderIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>; }
function FileIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>; }
function ClipboardIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2h-3"/></svg>; }
