'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { parseDiff, extractChunks, splitPairs, rowStyle, sigStyle, type DiffLine, type Chunk } from './diffUtils';
import { useDrop } from '@/lib/useDrop';

type ViewMode = 'unified' | 'split';

export default function ClipboardDiffViewer() {
  const [leftText, setLeftText] = useState('');
  const [rightText, setRightText] = useState('');
  const [leftLabel, setLeftLabel] = useState('Left');
  const [rightLabel, setRightLabel] = useState('Right');
  const [diff, setDiff] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<ViewMode>('split');
  const [acceptedChunks, setAcceptedChunks] = useState<Record<number, 'left' | 'right'>>({});
  const [saveMsg, setSaveMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runDiff = useCallback(async (left: string, right: string, lLabel: string, rLabel: string) => {
    if (!left && !right) { setDiff(''); return; }
    setLoading(true);
    try {
      const r = await fetch('/api/compare/text', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ leftContent: left, rightContent: right, leftLabel: lLabel, rightLabel: rLabel }),
      });
      const d = await r.json();
      setDiff(d.diff || '');
      setAcceptedChunks({});
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runDiff(leftText, rightText, leftLabel, rightLabel), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [leftText, rightText, leftLabel, rightLabel, runDiff]);

  const lines = parseDiff(diff);
  const chunks = extractChunks(lines);

  const buildMerged = useCallback((preferSide: 'left' | 'right') => {
    const resultLines: string[] = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line.type === 'meta' || line.type === 'header') { i++; continue; }
      if (line.type === 'context') { resultLines.push(line.content); i++; continue; }
      const chunkIdx = chunks.findIndex(c => c.startIndex <= i && i < c.startIndex + c.lines.length);
      if (chunkIdx === -1) { i++; continue; }
      const chunk = chunks[chunkIdx];
      const decision = acceptedChunks[chunkIdx] ?? preferSide;
      if (decision === 'left') {
        for (const l of chunk.lines) { if (l.type === 'remove' || l.type === 'context') resultLines.push(l.content); }
      } else {
        for (const l of chunk.lines) { if (l.type === 'add' || l.type === 'context') resultLines.push(l.content); }
      }
      i = chunk.startIndex + chunk.lines.length;
    }
    return resultLines.join('\n');
  }, [lines, chunks, acceptedChunks]);

  const copyMerged = useCallback(async (preferSide: 'left' | 'right') => {
    setSaving(true); setSaveMsg('');
    try {
      await navigator.clipboard.writeText(buildMerged(preferSide));
      setSaveMsg('Copied to clipboard');
    } catch { setSaveMsg('Copy failed'); }
    finally { setSaving(false); setTimeout(() => setSaveMsg(''), 2000); }
  }, [buildMerged]);

  const hasDiff = chunks.length > 0;

  const PANES = [
    { text: leftText,  label: leftLabel,  setLabel: setLeftLabel,  setText: setLeftText,  accent: '#f87171', accentBg: 'rgba(248,113,113,0.08)' },
    { text: rightText, label: rightLabel, setLabel: setRightLabel, setText: setRightText, accent: '#34d399', accentBg: 'rgba(52,211,153,0.08)' },
  ] as const;

  return (
    <div className="flex flex-col h-full min-h-0 w-full" style={{ background: 'var(--background)' }}>

      {/* ── Input panels ── */}
      <div className="grid grid-cols-2 shrink-0" style={{ height: 240, borderBottom: '1px solid var(--border-subtle)' }}>
        {PANES.map(({ text, label, setLabel, setText, accent, accentBg }, idx) => (
          <ClipboardPane
            key={idx}
            idx={idx}
            text={text} label={label} accent={accent} accentBg={accentBg}
            onLabelChange={setLabel}
            onTextChange={setText}
          />
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-4 h-11 shrink-0 gap-3" style={{
        background: 'var(--bg-panel)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div className="flex items-center gap-2">
          {hasDiff && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-raised)', color: 'var(--text-soft)' }}>
              {chunks.length} chunk{chunks.length !== 1 ? 's' : ''}
            </span>
          )}
          {saveMsg && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>
              {saveMsg}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasDiff && (
            <>
              <div className="flex items-center rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                <button onClick={() => copyMerged('left')} disabled={saving}
                  className="text-[10px] font-semibold px-3 h-7 transition-colors disabled:opacity-40"
                  style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171', borderRight: '1px solid var(--border-subtle)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.2)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.12)'}
                  title="Copy merged preferring left">← Copy L</button>
                <button onClick={() => copyMerged('right')} disabled={saving}
                  className="text-[10px] font-semibold px-3 h-7 transition-colors disabled:opacity-40"
                  style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(52,211,153,0.2)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(52,211,153,0.12)'}
                  title="Copy merged preferring right">Copy R →</button>
              </div>
              <div className="w-px h-5 shrink-0" style={{ background: 'var(--border-subtle)' }} />
            </>
          )}
          {/* View mode pill */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: 'var(--bg-raised)' }}>
            {(['unified', 'split'] as ViewMode[]).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className="text-[10px] font-semibold px-2.5 py-1 rounded-md transition-all duration-150"
                style={mode === m
                  ? { background: 'var(--primary)', color: 'white' }
                  : { color: 'var(--text-dim)' }
                }
                onMouseEnter={e => { if (mode !== m) (e.currentTarget as HTMLElement).style.color = 'var(--foreground)'; }}
                onMouseLeave={e => { if (mode !== m) (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'; }}
              >{m}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Diff output ── */}
      {loading ? (
        <div className="flex-1 p-3 space-y-px">
          {Array.from({ length: 14 }).map((_, i) => (
            <Skeleton key={i} className="h-5 rounded-none" style={{ opacity: 1 - i * 0.05, background: 'var(--bg-raised)' }} />
          ))}
        </div>
      ) : !leftText && !rightText ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3" style={{ color: 'var(--text-dim)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--bg-raised)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2h-3"/></svg>
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold" style={{ color: 'var(--text-soft)' }}>Paste content to compare</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-dim)' }}>Use the Paste buttons above or type directly</p>
          </div>
        </div>
      ) : !hasDiff ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3" style={{ color: 'var(--text-dim)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.1)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.5"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold" style={{ color: '#34d399' }}>Identical content</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-dim)' }}>No differences found</p>
          </div>
        </div>
      ) : mode === 'unified' ? (
        <UnifiedView lines={lines} chunks={chunks} acceptedChunks={acceptedChunks} onAccept={(i, side) => setAcceptedChunks(p => ({ ...p, [i]: side }))} />
      ) : (
        <SplitView lines={lines} chunks={chunks} acceptedChunks={acceptedChunks} onAccept={(i, side) => setAcceptedChunks(p => ({ ...p, [i]: side }))} />
      )}
    </div>
  );
}

/* ── Individual clipboard pane with drag-and-drop ── */
function ClipboardPane({ idx, text, label, accent, accentBg, onLabelChange, onTextChange }: {
  idx: number; text: string; label: string; accent: string; accentBg: string;
  onLabelChange: (v: string) => void; onTextChange: (v: string) => void;
}) {
  const { dragging, handlers: dropHandlers } = useDrop({
    accept: 'file',
    onContent: (content) => onTextChange(content),
  });

  return (
    <div
      {...dropHandlers}
      className="flex flex-col min-h-0 relative transition-all"
      style={{
        borderRight: idx === 0 ? '1px solid var(--border-subtle)' : undefined,
        outline: dragging ? `2px dashed ${accent}` : undefined,
        outlineOffset: '-2px',
      }}
    >
      {/* Drop overlay */}
      {dragging && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded pointer-events-none"
          style={{ background: `${accentBg}`, backdropFilter: 'blur(2px)' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ color: accent }}>
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span className="text-xs font-semibold" style={{ color: accent }}>Drop to load file</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 px-3 h-10 shrink-0" style={{ background: accentBg, borderBottom: `1px solid ${accent}30` }}>
        <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: accent }} />
        <input
          value={label}
          onChange={e => onLabelChange(e.target.value)}
          className="text-xs font-bold bg-transparent border-none outline-none flex-1"
          style={{ color: 'var(--foreground)' }}
          placeholder={idx === 0 ? 'Left' : 'Right'}
        />
        <div className="flex items-center gap-1 ml-auto">
          {text && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-raised)', color: 'var(--text-dim)' }}>
              {text.split('\n').length} lines
            </span>
          )}
          <button
            onClick={async () => { try { const t = await navigator.clipboard.readText(); onTextChange(t); } catch {} }}
            className="flex items-center gap-1 text-[10px] font-semibold px-2.5 h-6 rounded-lg transition-all"
            style={{ background: accent, color: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}
            title="Paste from clipboard"
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.85'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2h-3"/></svg>
            Paste
          </button>
          {text && (
            <button onClick={() => onTextChange('')}
              className="w-6 h-6 flex items-center justify-center rounded-md transition-colors"
              style={{ color: 'var(--text-dim)' }}
              title="Clear"
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--foreground)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'}
            >
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 3L3 9M3 3l6 6"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* Textarea */}
      <textarea
        value={text}
        onChange={e => onTextChange(e.target.value)}
        placeholder={idx === 0 ? 'Paste, type, or drop a file here…' : 'Paste, type, or drop a file here…'}
        className="flex-1 resize-none font-mono text-[11.5px] leading-5 p-3 outline-none"
        style={{ background: 'var(--background)', color: 'var(--foreground)', caretColor: accent }}
        spellCheck={false}
      />
    </div>
  );
}

function ChunkActions({ chunkIdx, accepted, onAccept }: {
  chunkIdx: number; accepted?: 'left' | 'right'; onAccept: (i: number, side: 'left' | 'right') => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5" style={{ background: 'var(--diff-header-bg)' }}>
      <span className="text-[10px] font-semibold" style={{ color: 'var(--diff-header-fg)' }}>Accept:</span>
      <div className="flex items-center rounded-md overflow-hidden ring-1 ring-border">
        <button onClick={() => onAccept(chunkIdx, 'left')}
          className={`text-[10px] font-semibold px-2.5 h-6 transition-colors border-r border-border ${
            accepted === 'left' ? 'text-rose-400 bg-rose-500/15' : 'text-muted-foreground hover:text-foreground bg-muted hover:bg-accent'
          }`}>Left</button>
        <button onClick={() => onAccept(chunkIdx, 'right')}
          className={`text-[10px] font-semibold px-2.5 h-6 transition-colors ${
            accepted === 'right' ? 'text-emerald-400 bg-emerald-500/15' : 'text-muted-foreground hover:text-foreground bg-muted hover:bg-accent'
          }`}>Right</button>
      </div>
      {accepted && (
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ring-1 ${
          accepted === 'left' ? 'bg-rose-500/10 text-rose-400 ring-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20'
        }`}>{accepted === 'left' ? '← accepted' : 'accepted →'}</span>
      )}
    </div>
  );
}

function UnifiedView({ lines, chunks, acceptedChunks, onAccept }: {
  lines: DiffLine[]; chunks: Chunk[]; acceptedChunks: Record<number, 'left' | 'right'>;
  onAccept: (i: number, side: 'left' | 'right') => void;
}) {
  return (
    <div className="diff-scroll flex-1 overflow-auto min-h-0">
      <div className="font-mono text-[11.5px] leading-5 min-w-max">
        {lines.map((line, i) => {
          const chunkIdx = chunks.findIndex(c => c.startIndex <= i && i < c.startIndex + c.lines.length);
          const isChunkStart = chunkIdx >= 0 && chunks[chunkIdx].startIndex === i;
          const accepted = chunkIdx >= 0 ? acceptedChunks[chunkIdx] : undefined;
          return (
            <div key={i}>
              {isChunkStart && <ChunkActions chunkIdx={chunkIdx} accepted={accepted} onAccept={onAccept} />}
              <div className="flex items-start" style={rowStyle(line.type, accepted)}>
                <span className="w-12 text-right pr-4 flex-shrink-0 select-none tabular-nums py-px" style={{ color: 'var(--diff-ln-fg)' }}>{line.newLine || line.oldLine || ''}</span>
                <span className="w-4 flex-shrink-0 select-none py-px text-center font-semibold" style={sigStyle(line.type)}>
                  {line.type === 'add' ? '+' : line.type === 'remove' ? '−' : ' '}
                </span>
                <span className="py-px pr-6 whitespace-pre">{line.content}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SplitView({ lines, chunks, acceptedChunks, onAccept }: {
  lines: DiffLine[]; chunks: Chunk[]; acceptedChunks: Record<number, 'left' | 'right'>;
  onAccept: (i: number, side: 'left' | 'right') => void;
}) {
  const pairs = splitPairs(lines);
  let flatIdx = 0;
  return (
    <div className="diff-scroll flex-1 overflow-auto min-h-0">
      <table className="font-mono text-[11.5px] leading-5 border-collapse min-w-max w-full">
        <tbody>
          {pairs.map((pair, pi) => {
            const i = flatIdx;
            flatIdx += pair.span;
            const chunkIdx = chunks.findIndex(c => c.startIndex <= i && i < c.startIndex + c.lines.length);
            const isChunkStart = chunkIdx >= 0 && chunks[chunkIdx].startIndex === i;
            const accepted = chunkIdx >= 0 ? acceptedChunks[chunkIdx] : undefined;
            return (
              <React.Fragment key={pi}>
                {isChunkStart && (
                  <tr>
                    <td colSpan={2} style={{ borderBottom: '1px solid color-mix(in oklch, var(--border-subtle) 60%, transparent)' }}>
                      <ChunkActions chunkIdx={chunkIdx} accepted={accepted} onAccept={onAccept} />
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="w-1/2 align-top" style={{ ...rowStyle(pair.left?.type || 'context', accepted), borderRight: '1px solid color-mix(in oklch, var(--border-subtle) 60%, transparent)' }}>
                    <div className="flex items-start">
                      <span className="w-12 text-right pr-4 flex-shrink-0 tabular-nums py-px select-none" style={{ color: 'var(--diff-ln-fg)' }}>{pair.left?.oldLine || ''}</span>
                      <span className="py-px pr-6 whitespace-pre">{pair.left?.content || ''}</span>
                    </div>
                  </td>
                  <td className="w-1/2 align-top" style={rowStyle(pair.right?.type || 'context', accepted)}>
                    <div className="flex items-start">
                      <span className="w-12 text-right pr-4 flex-shrink-0 tabular-nums py-px select-none" style={{ color: 'var(--diff-ln-fg)' }}>{pair.right?.newLine || ''}</span>
                      <span className="py-px pr-6 whitespace-pre">{pair.right?.content || ''}</span>
                    </div>
                  </td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
