'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface GraphLine {
  type: 'commit' | 'graph';
  graph: string;
  hash: string; shortHash: string; message: string; author: string; date: string; refs: string;
}

interface CommitFile { path: string; status: string; }
interface Ref { label: string; kind: 'head' | 'local' | 'remote' | 'tag'; }

const COL = 16;
const COMMIT_H = 30;
const CONN_H = 12;
const R = 4.5;
const SW = 1.5;

const COLORS = [
  '#3b82f6', '#f59e0b', '#10b981', '#f43f5e', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6',
];

function col2x(col: number) { return col * COL + COL / 2; }
function branchColor(col: number) { return COLORS[col % COLORS.length]; }

function GraphSVG({ graphStr, isCommit, height }: { graphStr: string; isCommit: boolean; height: number }) {
  const maxCols = Math.max(Math.ceil(graphStr.length / 2) + 1, 2);
  const width = maxCols * COL;
  const midY = height / 2;

  const lines: React.ReactNode[] = [];
  let nodeCol = -1;

  for (let i = 0; i < graphStr.length; i++) {
    const ch = graphStr[i];
    if (ch === ' ') continue;

    if (i % 2 === 0) {
      const col = i / 2;
      const x = col2x(col);
      const color = branchColor(col);

      if (ch === '*') {
        nodeCol = col;
        lines.push(<line key={`v${i}`} x1={x} y1={0} x2={x} y2={height} stroke={color} strokeWidth={SW} strokeLinecap="round" />);
      } else if (ch === '|') {
        lines.push(<line key={`v${i}`} x1={x} y1={0} x2={x} y2={height} stroke={color} strokeWidth={SW} strokeLinecap="round" opacity={0.6} />);
      } else if (ch === '_') {
        const x2 = col2x(col + 1);
        lines.push(<line key={`h${i}`} x1={x} y1={midY} x2={x2} y2={midY} stroke={color} strokeWidth={SW} opacity={0.6} />);
      }
    } else {
      const leftCol = Math.floor(i / 2);
      const rightCol = leftCol + 1;
      const xL = col2x(leftCol);
      const xR = col2x(rightCol);

      if (ch === '\\') {
        const color = branchColor(leftCol);
        lines.push(<line key={`d${i}`} x1={xL} y1={0} x2={xR} y2={height} stroke={color} strokeWidth={SW} strokeLinecap="round" opacity={0.6} />);
      } else if (ch === '/') {
        const color = branchColor(rightCol);
        lines.push(<line key={`d${i}`} x1={xR} y1={0} x2={xL} y2={height} stroke={color} strokeWidth={SW} strokeLinecap="round" opacity={0.6} />);
      } else if (ch === '-') {
        const color = branchColor(leftCol);
        lines.push(<line key={`h${i}`} x1={xL} y1={midY} x2={xR} y2={midY} stroke={color} strokeWidth={SW} opacity={0.6} />);
      }
    }
  }

  if (isCommit && nodeCol >= 0) {
    const x = col2x(nodeCol);
    const color = branchColor(nodeCol);
    lines.push(
      <circle key="mask" cx={x} cy={midY} r={R + 1} fill="var(--bg-panel)" />,
      <circle key="ring" cx={x} cy={midY} r={R} fill="none" stroke={color} strokeWidth={2} />,
      <circle key="dot" cx={x} cy={midY} r={2} fill={color} />,
    );
  }

  return (
    <svg width={width} height={height} style={{ overflow: 'visible', flexShrink: 0, display: 'block' }}>
      {lines}
    </svg>
  );
}

function parseRefs(raw: string): Ref[] {
  if (!raw.trim()) return [];
  return raw.split(',').map(r => r.trim()).filter(Boolean).map((r): Ref => {
    if (r.startsWith('HEAD ->')) return { label: r.slice(7).trim(), kind: 'head' };
    if (r === 'HEAD') return { label: 'HEAD', kind: 'head' };
    if (r.startsWith('tag:')) return { label: r.slice(4).trim(), kind: 'tag' };
    if (r.includes('/')) return { label: r, kind: 'remote' };
    return { label: r, kind: 'local' };
  });
}

const REF_CLS: Record<Ref['kind'], string> = {
  head:   'bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/25',
  local:  'bg-blue-500/15    text-blue-600    ring-1 ring-blue-500/25',
  remote: 'bg-amber-500/15   text-amber-600   ring-1 ring-amber-500/25',
  tag:    'bg-violet-500/15  text-violet-600  ring-1 ring-violet-500/25',
};

function RefPills({ raw }: { raw: string }) {
  const refs = parseRefs(raw);
  if (!refs.length) return null;
  return (
    <span className="flex items-center gap-1 flex-shrink-0 flex-wrap">
      {refs.map((ref, i) => (
        <span key={i} className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md leading-none ${REF_CLS[ref.kind]}`}>
          {ref.label}
        </span>
      ))}
    </span>
  );
}

const STATUS_CLS: Record<string, string> = {
  M: 'text-amber-500',
  A: 'text-emerald-500',
  D: 'text-rose-500',
  R: 'text-blue-500',
  C: 'text-cyan-500',
};

function StatusBadge({ status }: { status: string }) {
  const letter = status[0] ?? 'M';
  const cls = STATUS_CLS[letter] ?? '';
  return <span className={`font-mono text-[10px] font-bold w-4 flex-shrink-0 ${cls}`} style={!cls ? { color: 'var(--text-soft)' } : {}}>{letter}</span>;
}

interface Props {
  repo: string;
  onCommitSelect: (hash: string) => void;
  onCommitFileSelect: (hash: string, file: string) => void;
  selectedCommit?: string;
  selectedFile?: string;
}

export default function CommitGraph({ repo, onCommitSelect, onCommitFileSelect, selectedCommit, selectedFile }: Props) {
  const [lines, setLines] = useState<GraphLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const [allBranches, setAllBranches] = useState(false);
  const [fetching, setFetching] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);

  const [expandedCommit, setExpandedCommit] = useState<string | undefined>();
  const [fileCache, setFileCache] = useState<Record<string, CommitFile[] | 'loading'>>({});

  const loadPage = useCallback(async (p: number, reset = false, all = false) => {
    if (!repo) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/git/log?repo=${encodeURIComponent(repo)}&page=${p}&all=${all ? '1' : '0'}`);
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      const next: GraphLine[] = data.lines || [];
      setLines(prev => reset ? next : [...prev, ...next]);
      setHasMore(next.filter((l: GraphLine) => l.type === 'commit').length === 50);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, [repo]);

  useEffect(() => {
    setLines([]); setPage(0); setHasMore(true); setError('');
    setExpandedCommit(undefined); setFileCache({});
    loadPage(0, true, allBranches);
  }, [repo, allBranches]); // eslint-disable-line react-hooks/exhaustive-deps

  const doFetchAll = async () => {
    setFetching(true);
    try {
      await fetch(`/api/git/fetch?repo=${encodeURIComponent(repo)}`, { method: 'POST' });
      setLines([]); setPage(0); setHasMore(true); setError('');
      setExpandedCommit(undefined); setFileCache({});
      await loadPage(0, true, allBranches);
    } finally { setFetching(false); }
  };

  useEffect(() => {
    if (!loaderRef.current) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        const next = page + 1; setPage(next); loadPage(next, false, allBranches);
      }
    }, { threshold: 0.1 });
    obs.observe(loaderRef.current);
    return () => obs.disconnect();
  }, [hasMore, loading, page, loadPage]);

  const handleCommitClick = useCallback(async (hash: string) => {
    if (expandedCommit === hash) { setExpandedCommit(undefined); return; }
    setExpandedCommit(hash);
    onCommitSelect(hash);
    if (!fileCache[hash]) {
      setFileCache(prev => ({ ...prev, [hash]: 'loading' }));
      try {
        const res = await fetch(`/api/git/commit-files?repo=${encodeURIComponent(repo)}&commit=${hash}`);
        const data = await res.json();
        setFileCache(prev => ({ ...prev, [hash]: data.files || [] }));
      } catch {
        setFileCache(prev => ({ ...prev, [hash]: [] }));
      }
    }
  }, [expandedCommit, fileCache, repo, onCommitSelect]);

  if (error) return <div className="p-4 text-rose-500 text-xs">{error}</div>;

  if (!lines.length && loading) return (
    <div className="p-3 space-y-px">
      {Array.from({ length: 18 }).map((_, i) => (
        <Skeleton key={i} className="h-[30px] rounded-none" style={{ opacity: 1 - i * 0.04, background: 'color-mix(in oklch, var(--bg-raised) 50%, transparent)' }} />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5"
        style={{ borderBottom: '1px solid color-mix(in oklch, var(--border-subtle) 50%, transparent)' }}>
        <button
          onClick={() => setAllBranches(v => !v)}
          className="flex items-center gap-1.5 h-6 px-2.5 rounded-md text-[11px] font-medium transition-colors"
          style={{
            background: allBranches
              ? 'color-mix(in oklch, oklch(0.65 0.18 250) 15%, transparent)'
              : 'color-mix(in oklch, var(--bg-raised) 60%, transparent)',
            color: allBranches ? 'oklch(0.65 0.18 250)' : 'var(--text-dim)',
            outline: allBranches ? '1px solid color-mix(in oklch, oklch(0.65 0.18 250) 30%, transparent)' : undefined,
          }}
        >
          {/* branch icon */}
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="5" cy="3.5" r="1.5"/><circle cx="5" cy="12.5" r="1.5"/>
            <circle cx="11" cy="3.5" r="1.5"/>
            <line x1="5" y1="5" x2="5" y2="11"/>
            <path d="M5 5.5a3 3 0 003 3h2"/>
          </svg>
          All branches
        </button>

        <div className="flex-1" />

        <button
          onClick={doFetchAll}
          disabled={fetching}
          className="flex items-center gap-1.5 h-6 px-2.5 rounded-md text-[11px] font-medium transition-colors disabled:opacity-40"
          style={{ background: 'color-mix(in oklch, var(--bg-raised) 60%, transparent)', color: 'var(--text-dim)' }}
          title="git fetch --all, then reload graph"
        >
          {/* refresh icon */}
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"
            className={fetching ? 'animate-spin' : ''}>
            <path d="M13.5 8A5.5 5.5 0 112.5 5" strokeLinecap="round"/>
            <path d="M2.5 2v3h3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {fetching ? 'Fetching…' : 'Fetch all'}
        </button>
      </div>

    <div className="overflow-y-auto flex-1 min-h-0">
      {lines.map((line, idx) => {
        const isCommit = line.type === 'commit';
        const rowH = isCommit ? COMMIT_H : CONN_H;

        if (!isCommit) {
          return (
            <div key={idx} style={{ height: rowH }} className="flex items-start px-3 pt-0">
              <GraphSVG graphStr={line.graph} isCommit={false} height={rowH} />
            </div>
          );
        }

        const isExpanded = expandedCommit === line.hash;
        const isSelected = selectedCommit === line.hash;
        const files = fileCache[line.hash];

        return (
          <div key={line.hash || idx}>
            <div
              style={{
                height: rowH,
                background: isExpanded || isSelected ? 'color-mix(in oklch, var(--primary) 8%, transparent)' : undefined,
              }}
              className="group flex items-center gap-3 px-3 cursor-pointer transition-colors hover:[background:color-mix(in_oklch,var(--bg-raised)_50%,transparent)]"
              onClick={() => handleCommitClick(line.hash)}
            >
              <GraphSVG graphStr={line.graph} isCommit height={rowH} />

              <svg
                width="10" height="10" viewBox="0 0 10 10" fill="none"
                stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
                className={`flex-shrink-0 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                style={{ color: 'var(--text-dim)' }}
              >
                <path d="M3 2l4 3-4 3" />
              </svg>

              <span className="font-mono text-[10px] w-[46px] flex-shrink-0 tabular-nums" style={{ color: 'var(--text-dim)' }}>
                {line.shortHash}
              </span>

              {line.refs && <RefPills raw={line.refs} />}

              <span className={`text-[12px] font-medium flex-1 truncate min-w-0 leading-tight transition-colors`}
                style={{ color: isExpanded || isSelected ? 'var(--foreground)' : 'var(--text-soft)' }}>
                {line.message}
              </span>

              <span className="text-[10px] w-16 flex-shrink-0 text-right truncate hidden xl:block" style={{ color: 'var(--text-dim)' }}>
                {line.author.split(' ')[0]}
              </span>

              <span className="text-[10px] w-14 flex-shrink-0 text-right whitespace-nowrap" style={{ color: 'var(--text-dim)' }}>
                {line.date}
              </span>
            </div>

            {isExpanded && (
              <div style={{ borderBottom: '1px solid color-mix(in oklch, var(--border-subtle) 50%, transparent)', background: 'color-mix(in oklch, var(--bg-panel) 70%, transparent)' }}>
                <div className="px-10 py-1.5 flex items-center gap-1.5" style={{ borderBottom: '1px solid color-mix(in oklch, var(--border-subtle) 30%, transparent)' }}>
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-dim)', flexShrink: 0 }}>
                    <circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.314 2.686-6 6-6s6 2.686 6 6"/>
                  </svg>
                  <span className="text-[11px]" style={{ color: 'var(--text-soft)' }}>{line.author}</span>
                </div>
                {files === 'loading' || files === undefined ? (
                  <div className="px-10 py-2 space-y-1">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-5 rounded" style={{ background: 'color-mix(in oklch, var(--bg-raised) 60%, transparent)' }} />
                    ))}
                  </div>
                ) : files.length === 0 ? (
                  <div className="px-10 py-2 text-[11px]" style={{ color: 'var(--text-dim)' }}>No files changed</div>
                ) : (
                  <div className="py-1">
                    {files.map((f, fi) => {
                      const isFileSelected = selectedCommit === line.hash && selectedFile === f.path;
                      return (
                        <div
                          key={fi}
                          className="flex items-center gap-2 px-10 py-[3px] cursor-pointer transition-colors"
                          style={{
                            background: isFileSelected ? 'color-mix(in oklch, var(--primary) 10%, transparent)' : undefined,
                            color: isFileSelected ? 'var(--foreground)' : 'var(--text-soft)',
                          }}
                          onMouseEnter={e => { if (!isFileSelected) (e.currentTarget as HTMLElement).style.background = 'color-mix(in oklch, var(--bg-raised) 50%, transparent)'; }}
                          onMouseLeave={e => { if (!isFileSelected) (e.currentTarget as HTMLElement).style.background = ''; }}
                          onClick={(e) => { e.stopPropagation(); onCommitFileSelect(line.hash, f.path); }}
                        >
                          <StatusBadge status={f.status} />
                          <span className="font-mono text-[11px] truncate min-w-0">{f.path}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <div ref={loaderRef} className="h-8 flex items-center justify-center">
        {loading && <span className="text-[11px]" style={{ color: 'var(--text-dim)' }}>Loading…</span>}
      </div>
    </div>
    </div>
  );
}
