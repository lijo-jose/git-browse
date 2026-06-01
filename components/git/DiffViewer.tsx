'use client';

import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface Props { repo: string; file?: string; commit?: string; staged?: boolean; }
type Mode = 'unified' | 'split';
interface DiffLine { type: 'add' | 'remove' | 'context' | 'header' | 'meta'; content: string; oldLine?: number; newLine?: number; }

export default function DiffViewer({ repo, file, commit, staged }: Props) {
  const [raw, setRaw] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<Mode>('unified');
  const [commitFiles, setCommitFiles] = useState<string[]>([]);
  const [selFile, setSelFile] = useState<string | null>(null);

  useEffect(() => {
    setSelFile(null);
    setCommitFiles([]);
  }, [commit]);

  useEffect(() => {
    if (!repo || (!file && !commit)) { setRaw(''); return; }
    setLoading(true); setError('');
    const p = new URLSearchParams({ repo });
    if (commit) p.set('commit', commit);
    if (file) p.set('file', file);
    else if (selFile) p.set('file', selFile);

    fetch(`/api/git/diff?${p}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return; }
        setRaw(d.diff || '');
        if (commit && !file) setCommitFiles(extractFiles(d.diff || ''));
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [repo, file, commit, selFile]);

  const lines = parseDiff(raw);
  const title = file || (commit ? commit.slice(0, 8) : '');

  if (!repo || (!file && !commit)) return (
    <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'var(--text-dim)' }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-30">
        <path d="M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-3M9 7V5a2 2 0 012-2h2M9 7h6m-6 0l-2 2"/>
        <path d="M21 12l-9.5 9.5-4 1 1-4L18 9l3 3z"/>
      </svg>
      <p className="text-xs font-medium">Select a file or commit</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 flex-shrink-0" style={{ borderBottom: '1px solid color-mix(in oklch, var(--border-subtle) 60%, transparent)' }}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[11px] font-mono truncate" style={{ color: 'var(--text-soft)' }}>{title}</span>
          {staged !== undefined && (
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full leading-none ${
              staged ? 'bg-blue-500/15 text-blue-500 ring-1 ring-blue-500/25' : 'bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/25'
            }`}>{staged ? 'staged' : 'unstaged'}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {(['unified', 'split'] as Mode[]).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className="text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors"
              style={mode === m
                ? { background: 'var(--bg-raised)', color: 'var(--foreground)', outline: '1px solid var(--border-subtle)' }
                : { color: 'var(--text-dim)' }
              }
            >{m}</button>
          ))}
        </div>
      </div>

      {/* Commit file tabs */}
      {commit && !file && commitFiles.length > 0 && (
        <div className="flex gap-1 px-3 py-1.5 overflow-x-auto flex-shrink-0" style={{ borderBottom: '1px solid color-mix(in oklch, var(--border-subtle) 60%, transparent)' }}>
          <button onClick={() => setSelFile(null)}
            className="text-[10px] font-mono px-2 py-1 rounded-md whitespace-nowrap transition-colors"
            style={selFile === null
              ? { background: 'var(--bg-raised)', color: 'var(--foreground)', outline: '1px solid var(--border-subtle)' }
              : { background: 'color-mix(in oklch, var(--bg-raised) 60%, transparent)', color: 'var(--text-dim)' }
            }>All</button>
          <span className="w-px my-0.5 flex-shrink-0" style={{ background: 'var(--border-subtle)' }} />
          {commitFiles.map(cf => (
            <button key={cf} onClick={() => setSelFile(cf)}
              className="text-[10px] font-mono px-2 py-1 rounded-md whitespace-nowrap transition-colors"
              style={selFile === cf
                ? { background: 'color-mix(in oklch, var(--primary) 15%, transparent)', color: 'var(--primary)', outline: '1px solid color-mix(in oklch, var(--primary) 25%, transparent)' }
                : { background: 'color-mix(in oklch, var(--bg-raised) 60%, transparent)', color: 'var(--text-dim)' }
              }>{cf.split('/').pop()}</button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex-1 p-3 space-y-px">
          {Array.from({ length: 22 }).map((_, i) => (
            <Skeleton key={i} className="h-5 rounded-none" style={{ opacity: 1 - i * 0.035, background: 'color-mix(in oklch, var(--bg-raised) 40%, transparent)' }} />
          ))}
        </div>
      ) : error ? (
        <p className="p-4 text-rose-500 text-xs">{error}</p>
      ) : mode === 'unified' ? (
        <Unified lines={lines} />
      ) : (
        <Split lines={lines} />
      )}
    </div>
  );
}

function rowStyle(t: DiffLine['type']): React.CSSProperties {
  switch (t) {
    case 'add':    return { background: 'var(--diff-add-bg)', color: 'var(--diff-add-fg)' };
    case 'remove': return { background: 'var(--diff-remove-bg)', color: 'var(--diff-remove-fg)' };
    case 'header': return { background: 'var(--diff-header-bg)', color: 'var(--diff-header-fg)' };
    case 'meta':   return { color: 'var(--diff-meta-fg)' };
    default:       return { color: 'var(--foreground)' };
  }
}

function sigStyle(t: DiffLine['type']): React.CSSProperties {
  if (t === 'add') return { color: 'var(--diff-add-sig)' };
  if (t === 'remove') return { color: 'var(--diff-remove-sig)' };
  return { color: 'var(--diff-ln-fg)' };
}

function Unified({ lines }: { lines: DiffLine[] }) {
  return (
    <div className="flex-1 overflow-auto min-h-0">
      <div className="font-mono text-[11.5px] leading-5 min-w-max">
        {lines.map((line, i) => (
          <div key={i} className="flex items-start" style={rowStyle(line.type)}>
            <span className="w-12 text-right pr-4 flex-shrink-0 select-none tabular-nums py-px" style={{ color: 'var(--diff-ln-fg)' }}>{line.newLine || line.oldLine || ''}</span>
            <span className="w-4 flex-shrink-0 select-none py-px text-center font-semibold" style={sigStyle(line.type)}>
              {line.type === 'add' ? '+' : line.type === 'remove' ? '−' : ' '}
            </span>
            <span className="py-px pr-6 whitespace-pre">{line.content}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Split({ lines }: { lines: DiffLine[] }) {
  const pairs = splitPairs(lines);
  return (
    <div className="flex-1 overflow-auto min-h-0">
      <table className="font-mono text-[11.5px] leading-5 border-collapse min-w-max w-full">
        <tbody>
          {pairs.map((pair, i) => (
            <tr key={i}>
              <td className="w-1/2 align-top" style={{ ...rowStyle(pair.left?.type || 'context'), borderRight: '1px solid color-mix(in oklch, var(--border-subtle) 60%, transparent)' }}>
                <div className="flex items-start">
                  <span className="w-12 text-right pr-4 flex-shrink-0 tabular-nums py-px select-none" style={{ color: 'var(--diff-ln-fg)' }}>{pair.left?.oldLine || ''}</span>
                  <span className="py-px pr-6 whitespace-pre">{pair.left?.content || ''}</span>
                </div>
              </td>
              <td className="w-1/2 align-top" style={rowStyle(pair.right?.type || 'context')}>
                <div className="flex items-start">
                  <span className="w-12 text-right pr-4 flex-shrink-0 tabular-nums py-px select-none" style={{ color: 'var(--diff-ln-fg)' }}>{pair.right?.newLine || ''}</span>
                  <span className="py-px pr-6 whitespace-pre">{pair.right?.content || ''}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function parseDiff(raw: string): DiffLine[] {
  const result: DiffLine[] = [];
  let ol = 0, nl = 0;
  for (const line of raw.split('\n')) {
    if (line.startsWith('@@')) {
      const m = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)/);
      if (m) { ol = +m[1]; nl = +m[2]; }
      result.push({ type: 'header', content: line });
    } else if (/^(diff |index |--- |\+\+\+ |commit |Author:|Date:|    )/.test(line) || line === '') {
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

function splitPairs(lines: DiffLine[]) {
  const pairs: { left?: DiffLine; right?: DiffLine }[] = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.type === 'remove' && lines[i + 1]?.type === 'add') { pairs.push({ left: l, right: lines[i + 1] }); i += 2; }
    else if (l.type === 'remove') { pairs.push({ left: l }); i++; }
    else if (l.type === 'add') { pairs.push({ right: l }); i++; }
    else { pairs.push({ left: l, right: l }); i++; }
  }
  return pairs;
}

function extractFiles(diff: string): string[] {
  return diff.split('\n').filter(l => l.startsWith('diff --git'))
    .map(l => { const m = l.match(/b\/(.+)$/); return m ? m[1] : ''; }).filter(Boolean);
}
