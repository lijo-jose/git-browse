'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// ── Types ────────────────────────────────────────────────────────────────────

interface GraphLine {
  type: 'commit' | 'graph';
  graph: string;
  hash: string; shortHash: string; message: string; author: string; date: string; refs: string;
}

interface Ref { label: string; kind: 'head' | 'local' | 'remote' | 'tag'; }

// ── Layout constants ─────────────────────────────────────────────────────────

const COL = 16;          // px per graph column
const COMMIT_H = 30;     // row height for a commit row
const CONN_H = 12;       // row height for connector-only rows
const R = 4.5;           // commit node radius
const SW = 1.5;          // stroke width for lines

// ── Branch colours ───────────────────────────────────────────────────────────

const COLORS = [
  '#3b82f6', // blue-500
  '#f59e0b', // amber-500
  '#10b981', // emerald-500
  '#f43f5e', // rose-500
  '#8b5cf6', // violet-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
  '#84cc16', // lime-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
];

function col2x(col: number) { return col * COL + COL / 2; }
function branchColor(col: number) { return COLORS[col % COLORS.length]; }

// ── SVG graph slice for one row ───────────────────────────────────────────────

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
      // Even positions → vertical / node
      const col = i / 2;
      const x = col2x(col);
      const color = branchColor(col);

      if (ch === '*') {
        nodeCol = col;
        // Full vertical line (circle is drawn on top, masking center)
        lines.push(<line key={`v${i}`} x1={x} y1={0} x2={x} y2={height} stroke={color} strokeWidth={SW} strokeLinecap="round" />);
      } else if (ch === '|') {
        lines.push(<line key={`v${i}`} x1={x} y1={0} x2={x} y2={height} stroke={color} strokeWidth={SW} strokeLinecap="round" opacity={0.6} />);
      } else if (ch === '_') {
        // Horizontal underline connector (git uses this for wide merges)
        const x2 = col2x(col + 1);
        lines.push(<line key={`h${i}`} x1={x} y1={midY} x2={x2} y2={midY} stroke={color} strokeWidth={SW} opacity={0.6} />);
      }
    } else {
      // Odd positions → diagonals
      const leftCol = Math.floor(i / 2);
      const rightCol = leftCol + 1;
      const xL = col2x(leftCol);
      const xR = col2x(rightCol);

      if (ch === '\\') {
        // Goes from leftCol at top to rightCol at bottom
        const color = branchColor(leftCol);
        lines.push(<line key={`d${i}`} x1={xL} y1={0} x2={xR} y2={height} stroke={color} strokeWidth={SW} strokeLinecap="round" opacity={0.6} />);
      } else if (ch === '/') {
        // Goes from rightCol at top to leftCol at bottom
        const color = branchColor(rightCol);
        lines.push(<line key={`d${i}`} x1={xR} y1={0} x2={xL} y2={height} stroke={color} strokeWidth={SW} strokeLinecap="round" opacity={0.6} />);
      } else if (ch === '-') {
        const color = branchColor(leftCol);
        lines.push(<line key={`h${i}`} x1={xL} y1={midY} x2={xR} y2={midY} stroke={color} strokeWidth={SW} opacity={0.6} />);
      }
    }
  }

  // Commit node on top — circle with inner dot
  if (isCommit && nodeCol >= 0) {
    const x = col2x(nodeCol);
    const color = branchColor(nodeCol);
    lines.push(
      // Mask the line through the node
      <circle key="mask" cx={x} cy={midY} r={R + 1} fill="#18181b" />,
      // Colored ring
      <circle key="ring" cx={x} cy={midY} r={R} fill="none" stroke={color} strokeWidth={2} />,
      // Center dot
      <circle key="dot" cx={x} cy={midY} r={2} fill={color} />,
    );
  }

  return (
    <svg width={width} height={height} style={{ overflow: 'visible', flexShrink: 0, display: 'block' }}>
      {lines}
    </svg>
  );
}

// ── Ref pills ────────────────────────────────────────────────────────────────

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
  head:   'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25',
  local:  'bg-blue-500/15    text-blue-400    ring-1 ring-blue-500/25',
  remote: 'bg-amber-500/15   text-amber-400   ring-1 ring-amber-500/25',
  tag:    'bg-violet-500/15  text-violet-400  ring-1 ring-violet-500/25',
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

// ── Main component ────────────────────────────────────────────────────────────

interface Props { repo: string; onCommitSelect: (hash: string) => void; selectedCommit?: string; }

export default function CommitGraph({ repo, onCommitSelect, selectedCommit }: Props) {
  const [lines, setLines] = useState<GraphLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const loaderRef = useRef<HTMLDivElement>(null);

  const loadPage = useCallback(async (p: number, reset = false) => {
    if (!repo) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/git/log?repo=${encodeURIComponent(repo)}&page=${p}`);
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
    loadPage(0, true);
  }, [repo]);

  useEffect(() => {
    if (!loaderRef.current) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        const next = page + 1; setPage(next); loadPage(next);
      }
    }, { threshold: 0.1 });
    obs.observe(loaderRef.current);
    return () => obs.disconnect();
  }, [hasMore, loading, page, loadPage]);

  if (error) return <div className="p-4 text-rose-400 text-xs">{error}</div>;

  if (!lines.length && loading) return (
    <div className="p-3 space-y-px">
      {Array.from({ length: 18 }).map((_, i) => (
        <Skeleton key={i} className="h-[30px] rounded-none bg-zinc-800/40" style={{ opacity: 1 - i * 0.04 }} />
      ))}
    </div>
  );

  return (
    <div className="overflow-y-auto h-full min-h-0">
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

        const isSelected = selectedCommit === line.hash;

        return (
          <div key={line.hash || idx}
            style={{ height: rowH }}
            className={`group flex items-center gap-3 px-3 cursor-pointer transition-colors ${
              isSelected ? 'bg-blue-500/8' : 'hover:bg-zinc-800/40'
            }`}
            onClick={() => onCommitSelect(line.hash)}
          >
            {/* SVG graph */}
            <GraphSVG graphStr={line.graph} isCommit height={rowH} />

            {/* Hash */}
            <span className="font-mono text-[10px] text-zinc-600 w-[46px] flex-shrink-0 tabular-nums group-hover:text-zinc-500">
              {line.shortHash}
            </span>

            {/* Refs */}
            {line.refs && <RefPills raw={line.refs} />}

            {/* Message */}
            <span className={`text-[12px] font-medium flex-1 truncate min-w-0 leading-tight transition-colors ${
              isSelected ? 'text-zinc-100' : 'text-zinc-400 group-hover:text-zinc-200'
            }`}>
              {line.message}
            </span>

            {/* Author */}
            <span className="text-[10px] text-zinc-700 w-16 flex-shrink-0 text-right truncate hidden xl:block">
              {line.author.split(' ')[0]}
            </span>

            {/* Date */}
            <span className="text-[10px] text-zinc-700 w-14 flex-shrink-0 text-right whitespace-nowrap">
              {line.date}
            </span>
          </div>
        );
      })}

      <div ref={loaderRef} className="h-8 flex items-center justify-center">
        {loading && <span className="text-[11px] text-zinc-700">Loading…</span>}
      </div>
    </div>
  );
}
