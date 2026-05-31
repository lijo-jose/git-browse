'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// ── Types ────────────────────────────────────────────────────────────────────

interface GraphLine {
  type: 'commit' | 'graph';
  graph: string;
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  refs: string;
}

interface Ref {
  label: string;
  kind: 'head' | 'local' | 'remote' | 'tag';
}

interface CommitGraphProps {
  repo: string;
  onCommitSelect: (hash: string) => void;
  selectedCommit?: string;
}

// ── Branch colour palette ────────────────────────────────────────────────────

const PALETTE = [
  '#4d9de0', // blue      (col 0)
  '#d4a44c', // amber     (col 1)
  '#5ab99b', // teal      (col 2)
  '#c96b6b', // rose      (col 3)
  '#9b7fd4', // purple    (col 4)
  '#4dbbdb', // cyan      (col 5)
  '#d48b5a', // orange    (col 6)
  '#a0d45a', // lime      (col 7)
  '#d45ab5', // pink      (col 8)
  '#5ad48b', // mint      (col 9)
];

function colColor(col: number): string {
  return PALETTE[col % PALETTE.length];
}

// ── Graph character → colour column mapping ──────────────────────────────────
// git --graph uses 2 chars per visual column: [char][space]
// We scan the raw graph prefix and assign a colour to each printed char
// based on its logical column index (charPos / 2).

interface GraphChar {
  ch: string;
  col: number; // logical column (0-based)
}

function parseGraphPrefix(raw: string): GraphChar[] {
  const result: GraphChar[] = [];
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === ' ') continue;          // spacing — skip, doesn't need colour
    const col = Math.floor(i / 2);
    result.push({ ch, col });
  }
  return result;
}

// Render a graph prefix string as a row of coloured monospace characters.
function GraphPrefix({ raw, commitCol }: { raw: string; commitCol: number }) {
  // Pad raw to a fixed width so commit rows and graph-only rows align
  const chars = parseGraphPrefix(raw);

  // Rebuild as fixed-width spans. We iterate char by char over the raw string,
  // turning every non-space char into a coloured span.
  const spans: React.ReactNode[] = [];
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === ' ') {
      spans.push(<span key={i}> </span>);
    } else {
      const col = Math.floor(i / 2);
      const isNode = ch === '*';
      const color = colColor(isNode ? commitCol : col);
      spans.push(
        <span
          key={i}
          style={{ color, fontWeight: isNode ? 700 : 400 }}
        >
          {ch}
        </span>
      );
    }
  }
  return (
    <span className="font-mono text-[12px] leading-none whitespace-pre select-none flex-shrink-0">
      {spans}
    </span>
  );
}

// ── Ref pill parser ──────────────────────────────────────────────────────────

function parseRefs(raw: string): Ref[] {
  if (!raw.trim()) return [];
  return raw.split(',').map((r) => r.trim()).filter(Boolean).map((r): Ref => {
    if (r.startsWith('HEAD ->')) return { label: r.replace('HEAD ->', '').trim(), kind: 'head' };
    if (r === 'HEAD') return { label: 'HEAD', kind: 'head' };
    if (r.startsWith('tag:')) return { label: r.replace('tag:', '').trim(), kind: 'tag' };
    if (r.includes('/')) return { label: r, kind: 'remote' };
    return { label: r, kind: 'local' };
  });
}

const REF_STYLE: Record<Ref['kind'], string> = {
  head:   'bg-[#5ab99b]/20 text-[#5ab99b] border border-[#5ab99b]/30',
  local:  'bg-[#4d9de0]/15 text-[#4d9de0] border border-[#4d9de0]/25',
  remote: 'bg-[#d4a44c]/15 text-[#d4a44c] border border-[#d4a44c]/25',
  tag:    'bg-[#9b7fd4]/15 text-[#9b7fd4] border border-[#9b7fd4]/25',
};

function RefPills({ raw }: { raw: string }) {
  const refs = parseRefs(raw);
  if (refs.length === 0) return null;
  return (
    <span className="flex items-center gap-1 flex-shrink-0">
      {refs.map((ref, i) => (
        <span
          key={i}
          className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md leading-none ${REF_STYLE[ref.kind]}`}
        >
          {ref.kind === 'head' ? '⬡ ' : ''}{ref.label}
        </span>
      ))}
    </span>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function CommitGraph({ repo, onCommitSelect, selectedCommit }: CommitGraphProps) {
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
      setLines((prev) => reset ? next : [...prev, ...next]);
      // page has 50 commits; if we got fewer commit rows, assume done
      const commitCount = next.filter((l) => l.type === 'commit').length;
      setHasMore(commitCount === 50);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, [repo]);

  useEffect(() => {
    setLines([]); setPage(0); setHasMore(true); setError('');
    loadPage(0, true);
  }, [repo]);

  // Infinite scroll
  useEffect(() => {
    if (!loaderRef.current) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        const next = page + 1; setPage(next); loadPage(next);
      }
    }, { threshold: 0.1 });
    obs.observe(loaderRef.current);
    return () => obs.disconnect();
  }, [hasMore, loading, page, loadPage]);

  if (error) return <div className="p-4 text-[#c96b6b] text-xs">{error}</div>;

  if (lines.length === 0 && loading) {
    return (
      <div className="p-2 space-y-px">
        {Array.from({ length: 16 }).map((_, i) => (
          <Skeleton key={i} className="h-6 rounded-none bg-[#1e1e1e]" style={{ opacity: 1 - i * 0.04 }} />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full overflow-x-hidden">
      <div className="min-w-0">
        {lines.map((line, idx) => {
          // Find which column the '*' node is in for this row (determines its colour)
          const nodePos = line.graph.indexOf('*');
          const commitCol = nodePos >= 0 ? Math.floor(nodePos / 2) : 0;

          if (line.type === 'graph') {
            // Connector-only row — just render the graph prefix, no commit info
            return (
              <div key={idx} className="flex items-center h-[14px] px-3">
                <GraphPrefix raw={line.graph} commitCol={commitCol} />
              </div>
            );
          }

          const isSelected = selectedCommit === line.hash;
          const refs = parseRefs(line.refs);

          return (
            <div
              key={line.hash || idx}
              className={`group flex items-center gap-3 px-3 py-[5px] cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-[#4d9de0]/12'
                  : 'hover:bg-[#1e1e1e]'
              }`}
              onClick={() => onCommitSelect(line.hash)}
            >
              {/* Graph tree */}
              <GraphPrefix raw={line.graph} commitCol={commitCol} />

              {/* Short hash */}
              <span
                className="font-mono text-[10.5px] w-[52px] flex-shrink-0 tabular-nums"
                style={{ color: colColor(commitCol), opacity: 0.75 }}
              >
                {line.shortHash}
              </span>

              {/* Refs */}
              {refs.length > 0 && <RefPills raw={line.refs} />}

              {/* Message */}
              <span className={`text-[12px] flex-1 truncate leading-tight font-medium min-w-0 ${
                isSelected ? 'text-[#dcdcdc]' : 'text-[#909090] group-hover:text-[#c0c0c0]'
              }`}>
                {line.message}
              </span>

              {/* Author (first name only) */}
              <span className="text-[10px] text-[#464646] w-20 flex-shrink-0 text-right truncate hidden lg:block">
                {line.author.split(' ')[0]}
              </span>

              {/* Date */}
              <span className="text-[10px] text-[#3c3c3c] w-16 flex-shrink-0 text-right whitespace-nowrap">
                {line.date}
              </span>
            </div>
          );
        })}

        <div ref={loaderRef} className="h-6 flex items-center justify-center">
          {loading && <span className="text-[11px] text-[#404040]">Loading…</span>}
        </div>
      </div>
    </div>
  );
}
