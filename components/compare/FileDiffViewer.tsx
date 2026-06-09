'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  leftPath: string;
  rightPath: string;
  relativePath: string;
  status: 'left-only' | 'right-only' | 'identical' | 'modified';
  rawDiff?: string;
}

type ViewMode = 'unified' | 'split';

interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'header' | 'meta';
  content: string;
  oldLine?: number;
  newLine?: number;
}

interface Chunk {
  header: string;
  lines: DiffLine[];
  startIndex: number; // index in flat lines array
}

export default function FileDiffViewer({ leftPath, rightPath, relativePath, status, rawDiff }: Props) {
  const [diff, setDiff] = useState(rawDiff ?? '');
  const [leftContent, setLeftContent] = useState('');
  const [rightContent, setRightContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<ViewMode>('split');
  const [wrap, setWrap] = useState(false);
  const [acceptedChunks, setAcceptedChunks] = useState<Record<number, 'left' | 'right'>>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    if (rawDiff !== undefined) { setDiff(rawDiff); return; }
    if (!leftPath && !rightPath) return;
    setLoading(true);
    setError('');
    setAcceptedChunks({});
    setSaveMsg('');
    const p = new URLSearchParams();
    if (leftPath) p.set('left', leftPath);
    if (rightPath) p.set('right', rightPath);
    fetch(`/api/compare/file?${p}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return; }
        setDiff(d.diff || '');
        setLeftContent(d.leftContent || '');
        setRightContent(d.rightContent || '');
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [leftPath, rightPath, rawDiff]); // eslint-disable-line react-hooks/exhaustive-deps

  const lines = parseDiff(diff);
  const chunks = extractChunks(lines);
  const hasChanges = chunks.length > 0;

  const buildMergedContent = useCallback(() => {
    // Build merged result from accepted chunks + context
    const resultLines: string[] = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line.type === 'meta' || line.type === 'header') { i++; continue; }
      if (line.type === 'context') { resultLines.push(line.content); i++; continue; }
      // Find which chunk this line belongs to
      const chunkIdx = chunks.findIndex(c => c.startIndex <= i && i < c.startIndex + c.lines.length);
      if (chunkIdx === -1) { i++; continue; }
      const chunk = chunks[chunkIdx];
      const decision = acceptedChunks[chunkIdx];
      if (decision === 'left') {
        // take removes (left side), skip adds
        for (const l of chunk.lines) { if (l.type === 'remove') resultLines.push(l.content); else if (l.type === 'context') resultLines.push(l.content); }
      } else if (decision === 'right') {
        // take adds (right side), skip removes
        for (const l of chunk.lines) { if (l.type === 'add') resultLines.push(l.content); else if (l.type === 'context') resultLines.push(l.content); }
      } else {
        // unresolved: keep both sides
        for (const l of chunk.lines) { if (l.type !== 'meta' && l.type !== 'header') resultLines.push(l.content); }
      }
      i = chunk.startIndex + chunk.lines.length;
    }
    return resultLines.join('\n');
  }, [lines, chunks, acceptedChunks]);

  const saveToLeft = async () => {
    setSaving(true); setSaveMsg('');
    try {
      const content = buildMergedContent();
      const r = await fetch('/api/compare/merge', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ target: leftPath, content }) });
      const d = await r.json();
      setSaveMsg(d.ok ? 'Saved to left' : d.error);
    } catch (e) { setSaveMsg(String(e)); } finally { setSaving(false); }
  };

  const saveToRight = async () => {
    setSaving(true); setSaveMsg('');
    try {
      const content = buildMergedContent();
      const r = await fetch('/api/compare/merge', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ target: rightPath, content }) });
      const d = await r.json();
      setSaveMsg(d.ok ? 'Saved to right' : d.error);
    } catch (e) { setSaveMsg(String(e)); } finally { setSaving(false); }
  };

  const copyAllFromLeft = async () => {
    setSaving(true); setSaveMsg('');
    try {
      const r = await fetch('/api/compare/merge', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ target: rightPath, content: leftContent }) });
      const d = await r.json();
      setSaveMsg(d.ok ? 'Copied left → right' : d.error);
    } catch (e) { setSaveMsg(String(e)); } finally { setSaving(false); }
  };

  const copyAllFromRight = async () => {
    setSaving(true); setSaveMsg('');
    try {
      const r = await fetch('/api/compare/merge', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ target: leftPath, content: rightContent }) });
      const d = await r.json();
      setSaveMsg(d.ok ? 'Copied right → left' : d.error);
    } catch (e) { setSaveMsg(String(e)); } finally { setSaving(false); }
  };

  if (!leftPath && !rightPath && rawDiff === undefined) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center opacity-50">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-3"/><path d="M9 7V5a2 2 0 012-2h2M9 7h6"/>
        </svg>
      </div>
      <p className="text-xs font-medium">Select a file to compare</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between h-11 px-4 shrink-0 gap-3 border-b border-border bg-card">
        {/* File path */}
        <div className="flex items-center gap-2 min-w-0">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted-foreground">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
          </svg>
          <span className="text-[11px] font-mono truncate text-muted-foreground">{relativePath}</span>
          {chunks.length > 0 && (
            <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              {chunks.length} chunk{chunks.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Save message */}
          {saveMsg && (
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ring-1 ${
              saveMsg.startsWith('Saved') || saveMsg.startsWith('Copied')
                ? 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/20'
                : 'bg-destructive/10 text-destructive ring-destructive/20'
            }`}>{saveMsg}</span>
          )}

          {status !== 'identical' && rawDiff === undefined && (
            <>
              {/* Copy-all group */}
              <div className="flex items-center rounded-lg overflow-hidden ring-1 ring-border">
                <button onClick={copyAllFromLeft} disabled={saving || !leftPath}
                  className="text-[10px] font-medium px-2.5 h-7 bg-muted text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40 border-r border-border"
                  title="Overwrite right with entire left file">L → R</button>
                <button onClick={copyAllFromRight} disabled={saving || !rightPath}
                  className="text-[10px] font-medium px-2.5 h-7 bg-muted text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40"
                  title="Overwrite left with entire right file">R → L</button>
              </div>

              {/* Merge save group */}
              {hasChanges && (
                <div className="flex items-center rounded-lg overflow-hidden ring-1 ring-primary/30">
                  <button onClick={saveToLeft} disabled={saving}
                    className="text-[10px] font-semibold px-2.5 h-7 bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-40 border-r border-primary/20">
                    Save → L
                  </button>
                  <button onClick={saveToRight} disabled={saving}
                    className="text-[10px] font-semibold px-2.5 h-7 bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-40">
                    Save → R
                  </button>
                </div>
              )}

              <div className="w-px h-5 bg-border shrink-0" />
            </>
          )}

          {/* Wrap toggle */}
          <button
            onClick={() => setWrap(w => !w)}
            title={wrap ? 'Disable word wrap' : 'Enable word wrap'}
            className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-lg transition-all"
            style={wrap
              ? { background: 'color-mix(in oklch, var(--primary) 15%, transparent)', color: 'var(--primary)', outline: '1px solid color-mix(in oklch, var(--primary) 30%, transparent)' }
              : { background: 'var(--bg-raised)', color: 'var(--text-dim)', outline: '1px solid var(--border-subtle)' }
            }
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/>
            </svg>
            Wrap
          </button>

          {/* View mode toggle */}
          <div className="flex items-center p-0.5 rounded-lg bg-muted">
            {(['unified', 'split'] as ViewMode[]).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`text-[10px] font-medium px-2.5 py-1 rounded-md transition-all ${
                  mode === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >{m}</button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 p-3 space-y-px">
          {Array.from({ length: 22 }).map((_, i) => (
            <Skeleton key={i} className="h-5 rounded-none bg-muted" style={{ opacity: 1 - i * 0.035 }} />
          ))}
        </div>
      ) : error ? (
        <div className="m-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      ) : status === 'identical' ? (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-500"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <p className="text-xs font-medium">Files are identical</p>
        </div>
      ) : !hasChanges ? (
        <div className="flex-1 overflow-auto min-h-0">
          <p className="font-mono text-[11.5px] leading-5 p-4 text-muted-foreground">No differences</p>
        </div>
      ) : mode === 'unified' ? (
        <UnifiedView lines={lines} chunks={chunks} acceptedChunks={acceptedChunks} wrap={wrap} onAccept={(i, side) => setAcceptedChunks(p => ({ ...p, [i]: side }))} />
      ) : (
        <SplitView lines={lines} chunks={chunks} acceptedChunks={acceptedChunks} wrap={wrap} onAccept={(i, side) => setAcceptedChunks(p => ({ ...p, [i]: side }))} />
      )}
    </div>
  );
}

/* ── Unified view ── */
function UnifiedView({ lines, chunks, acceptedChunks, wrap, onAccept }: {
  lines: DiffLine[];
  chunks: Chunk[];
  acceptedChunks: Record<number, 'left' | 'right'>;
  wrap: boolean;
  onAccept: (i: number, side: 'left' | 'right') => void;
}) {
  return (
    <div className="diff-scroll flex-1 overflow-auto min-h-0">
      <div className={`font-mono text-[11.5px] leading-5 ${wrap ? 'w-full' : 'min-w-max'}`}>
        {lines.map((line, i) => {
          const chunkIdx = chunks.findIndex(c => c.startIndex <= i && i < c.startIndex + c.lines.length);
          const isChunkStart = chunkIdx >= 0 && chunks[chunkIdx].startIndex === i;
          const accepted = chunkIdx >= 0 ? acceptedChunks[chunkIdx] : undefined;
          return (
            <div key={i}>
              {isChunkStart && (
                <ChunkActions chunkIdx={chunkIdx} accepted={accepted} onAccept={onAccept} inline />
              )}
              <div className="flex items-start" style={rowStyle(line.type, accepted, line)}>
                <span className="w-12 text-right pr-4 flex-shrink-0 select-none tabular-nums py-px" style={{ color: 'var(--diff-ln-fg)' }}>{line.newLine || line.oldLine || ''}</span>
                <span className="w-4 flex-shrink-0 select-none py-px text-center font-semibold" style={sigStyle(line.type)}>
                  {line.type === 'add' ? '+' : line.type === 'remove' ? '−' : ' '}
                </span>
                <span className={`py-px pr-6 ${wrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}`}>{line.content}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Split view ── */
function SplitView({ lines, chunks, acceptedChunks, wrap, onAccept }: {
  lines: DiffLine[];
  chunks: Chunk[];
  acceptedChunks: Record<number, 'left' | 'right'>;
  wrap: boolean;
  onAccept: (i: number, side: 'left' | 'right') => void;
}) {
  const leftRef  = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncing  = useRef(false);

  useEffect(() => {
    const left  = leftRef.current;
    const right = rightRef.current;
    if (!left || !right) return;

    const syncLeft = () => {
      if (syncing.current) return;
      syncing.current = true;
      right.scrollTop  = left.scrollTop;
      right.scrollLeft = left.scrollLeft;
      syncing.current = false;
    };
    const syncRight = () => {
      if (syncing.current) return;
      syncing.current = true;
      left.scrollTop  = right.scrollTop;
      left.scrollLeft = right.scrollLeft;
      syncing.current = false;
    };

    left.addEventListener('scroll',  syncLeft,  { passive: true });
    right.addEventListener('scroll', syncRight, { passive: true });
    return () => {
      left.removeEventListener('scroll',  syncLeft);
      right.removeEventListener('scroll', syncRight);
    };
  }, []);

  // Build aligned rows.
  // A "block" is a maximal run of remove/add lines (no context in between).
  // Within a block, collect ALL removes and ALL adds (they may be interleaved),
  // then pad the shorter side with spacers so both sides have max(R,A) rows.
  interface AlignedRow {
    left?: DiffLine;
    right?: DiffLine;
    chunkIdx: number;
    isChunkStart: boolean;
    accepted?: 'left' | 'right';
  }

  const rows: AlignedRow[] = [];
  let li = 0;

  while (li < lines.length) {
    const cur = lines[li];
    if (cur.type === 'header' || cur.type === 'meta') { li++; continue; }

    if (cur.type === 'remove' || cur.type === 'add') {
      // Collect all removes and adds in this contiguous block (may be interleaved)
      const removes: DiffLine[] = [];
      const adds: DiffLine[] = [];
      const blockStart = li;
      while (li < lines.length && (lines[li].type === 'remove' || lines[li].type === 'add')) {
        if (lines[li].type === 'remove') removes.push(lines[li]);
        else                             adds.push(lines[li]);
        li++;
      }

      const chunkIdx = chunks.findIndex(c => c.startIndex <= blockStart && blockStart < c.startIndex + c.lines.length);
      const accepted = chunkIdx >= 0 ? acceptedChunks[chunkIdx] : undefined;
      const maxLen   = Math.max(removes.length, adds.length);

      for (let k = 0; k < maxLen; k++) {
        rows.push({
          left:  removes[k],
          right: adds[k],
          chunkIdx,
          isChunkStart: k === 0 && chunkIdx >= 0 && chunks[chunkIdx].startIndex === blockStart,
          accepted,
        });
      }
    } else {
      const chunkIdx = chunks.findIndex(c => c.startIndex <= li && li < c.startIndex + c.lines.length);
      rows.push({
        left: cur, right: cur,
        chunkIdx,
        isChunkStart: chunkIdx >= 0 && chunks[chunkIdx].startIndex === li,
        accepted: chunkIdx >= 0 ? acceptedChunks[chunkIdx] : undefined,
      });
      li++;
    }
  }

  const contentClass = `font-mono text-[11.5px] leading-5 ${wrap ? 'w-full' : 'min-w-max'}`;
  const wrapClass    = wrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre';
  const divider      = 'color-mix(in oklch, var(--border-subtle) 60%, transparent)';
  const NBSP         = ' '; // preserves line height in empty/spacer cells

  const renderPane = (side: 'left' | 'right') => (
    <div
      ref={side === 'left' ? leftRef : rightRef}
      className="diff-scroll flex-1 overflow-auto min-h-0 min-w-0"
    >
      <div className={contentClass}>
        {rows.map((row, ri) => {
          const line    = side === 'left' ? row.left  : row.right;
          const lineNo  = side === 'left' ? line?.oldLine : line?.newLine;
          const isSpacer = !line;
          // Spacer background: subtle diagonal hatch on the same colour as the "missing" side
          const spacerBg = `repeating-linear-gradient(45deg,transparent,transparent 4px,${
            side === 'left'
              ? 'color-mix(in oklch, var(--diff-remove-bg) 35%, transparent)'
              : 'color-mix(in oklch, var(--diff-add-bg) 35%, transparent)'
          } 4px,${
            side === 'left'
              ? 'color-mix(in oklch, var(--diff-remove-bg) 35%, transparent)'
              : 'color-mix(in oklch, var(--diff-add-bg) 35%, transparent)'
          } 8px)`;

          return (
            <React.Fragment key={ri}>
              {row.isChunkStart && (
                <div style={{ borderBottom: `1px solid ${divider}` }}>
                  <ChunkActions chunkIdx={row.chunkIdx} accepted={row.accepted} onAccept={onAccept} />
                </div>
              )}
              <div
                className="flex items-start"
                style={isSpacer
                  ? { background: spacerBg }
                  : rowStyle(line!.type, row.accepted, line)
                }
              >
                {/* Line number — NBSP keeps height when empty */}
                <span className="w-12 text-right pr-3 flex-shrink-0 tabular-nums py-px select-none"
                  style={{ color: 'var(--diff-ln-fg)' }}>
                  {lineNo ?? NBSP}
                </span>
                {/* Content — NBSP keeps height when spacer */}
                <span className={`py-px pr-4 flex-1 ${wrapClass}`}>
                  {isSpacer ? NBSP : line!.content}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {renderPane('left')}
      <div className="w-px flex-shrink-0" style={{ background: divider }} />
      {renderPane('right')}
    </div>
  );
}

/* ── Chunk accept/reject controls ── */
function ChunkActions({ chunkIdx, accepted, onAccept }: {
  chunkIdx: number;
  accepted?: 'left' | 'right';
  onAccept: (i: number, side: 'left' | 'right') => void;
  inline?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5" style={{ background: 'var(--diff-header-bg)' }}>
      <span className="text-[10px] font-semibold" style={{ color: 'var(--diff-header-fg)' }}>Accept:</span>
      <div className="flex items-center rounded-md overflow-hidden ring-1 ring-border">
        <button
          onClick={() => onAccept(chunkIdx, 'left')}
          className={`text-[10px] font-semibold px-2.5 h-6 transition-colors border-r border-border ${
            accepted === 'left'
              ? 'text-rose-400 bg-rose-500/15'
              : 'text-muted-foreground hover:text-foreground bg-muted hover:bg-accent'
          }`}
        >Left</button>
        <button
          onClick={() => onAccept(chunkIdx, 'right')}
          className={`text-[10px] font-semibold px-2.5 h-6 transition-colors ${
            accepted === 'right'
              ? 'text-emerald-400 bg-emerald-500/15'
              : 'text-muted-foreground hover:text-foreground bg-muted hover:bg-accent'
          }`}
        >Right</button>
      </div>
      {accepted && (
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ring-1 ${
          accepted === 'left'
            ? 'bg-rose-500/10 text-rose-400 ring-rose-500/20'
            : 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20'
        }`}>
          {accepted === 'left' ? '← accepted' : 'accepted →'}
        </span>
      )}
    </div>
  );
}

/* ── Helpers ── */
function rowStyle(type: DiffLine['type'], accepted?: 'left' | 'right', line?: DiffLine | null): React.CSSProperties {
  // Dim non-accepted side when a decision has been made
  if (accepted === 'left' && type === 'add') return { background: 'color-mix(in oklch, var(--diff-add-bg) 30%, transparent)', opacity: 0.4 };
  if (accepted === 'right' && type === 'remove') return { background: 'color-mix(in oklch, var(--diff-remove-bg) 30%, transparent)', opacity: 0.4 };
  switch (type) {
    case 'add':    return { background: 'var(--diff-add-bg)', color: 'var(--diff-add-fg)' };
    case 'remove': return { background: 'var(--diff-remove-bg)', color: 'var(--diff-remove-fg)' };
    case 'header': return { background: 'var(--diff-header-bg)', color: 'var(--diff-header-fg)' };
    case 'meta':   return { color: 'var(--diff-meta-fg)' };
    default:       return { color: 'var(--foreground)' };
  }
}

function sigStyle(type: DiffLine['type']): React.CSSProperties {
  if (type === 'add') return { color: 'var(--diff-add-sig)' };
  if (type === 'remove') return { color: 'var(--diff-remove-sig)' };
  return { color: 'var(--diff-ln-fg)' };
}

function parseDiff(raw: string): DiffLine[] {
  const result: DiffLine[] = [];
  let ol = 0, nl = 0;
  for (const line of raw.split('\n')) {
    if (line.startsWith('@@')) {
      const m = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)/);
      if (m) { ol = +m[1]; nl = +m[2]; }
      result.push({ type: 'header', content: line });
    } else if (/^(--- |\+\+\+ |Index: |=+$)/.test(line) || line === '') {
      result.push({ type: 'meta', content: line });
    } else if (line.startsWith('+')) {
      result.push({ type: 'add', content: line.slice(1), newLine: nl++ });
    } else if (line.startsWith('-')) {
      result.push({ type: 'remove', content: line.slice(1), oldLine: ol++ });
    } else {
      result.push({ type: 'context', content: line.slice(1), oldLine: ol++, newLine: nl++ });
    }
  }
  return result;
}

function extractChunks(lines: DiffLine[]): Chunk[] {
  const chunks: Chunk[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].type === 'header') {
      const start = i + 1;
      let j = start;
      // collect lines until next header or meta
      while (j < lines.length && lines[j].type !== 'header') j++;
      const chunkLines = lines.slice(start, j);
      if (chunkLines.some(l => l.type === 'add' || l.type === 'remove')) {
        chunks.push({ header: lines[i].content, lines: chunkLines, startIndex: start });
      }
      i = j;
    } else {
      i++;
    }
  }
  return chunks;
}

function splitPairs(lines: DiffLine[]): Array<{ left?: DiffLine; right?: DiffLine; span: number }> {
  const pairs: Array<{ left?: DiffLine; right?: DiffLine; span: number }> = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.type === 'remove' && lines[i + 1]?.type === 'add') { pairs.push({ left: l, right: lines[i + 1], span: 2 }); i += 2; }
    else if (l.type === 'remove') { pairs.push({ left: l, span: 1 }); i++; }
    else if (l.type === 'add') { pairs.push({ right: l, span: 1 }); i++; }
    else { pairs.push({ left: l, right: l, span: 1 }); i++; }
  }
  return pairs;
}
