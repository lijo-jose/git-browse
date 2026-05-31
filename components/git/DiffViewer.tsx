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

  // Reset file selection whenever the active commit changes
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
        // Populate file tabs but don't auto-select — show full diff by default
        if (commit && !file) {
          setCommitFiles(extractFiles(d.diff || ''));
        }
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [repo, file, commit, selFile]);

  const lines = parseDiff(raw);
  const title = file || (commit ? commit.slice(0, 8) : '');

  if (!repo || (!file && !commit)) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-700">
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
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800/60 flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[11px] font-mono text-zinc-400 truncate">{title}</span>
          {staged !== undefined && (
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full leading-none ${
              staged ? 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/25' : 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/25'
            }`}>{staged ? 'staged' : 'unstaged'}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {(['unified', 'split'] as Mode[]).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors ${
                mode === m ? 'bg-zinc-800 text-zinc-200 ring-1 ring-zinc-700' : 'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/60'
              }`}>{m}</button>
          ))}
        </div>
      </div>

      {/* Commit file tabs */}
      {commit && !file && commitFiles.length > 0 && (
        <div className="flex gap-1 px-3 py-1.5 border-b border-zinc-800/60 overflow-x-auto flex-shrink-0">
          <button onClick={() => setSelFile(null)}
            className={`text-[10px] font-mono px-2 py-1 rounded-md whitespace-nowrap transition-colors ${
              selFile === null ? 'bg-zinc-700 text-zinc-200 ring-1 ring-zinc-600' : 'text-zinc-600 hover:text-zinc-300 bg-zinc-800/60'
            }`}>All</button>
          <span className="w-px bg-zinc-800 my-0.5 flex-shrink-0" />
          {commitFiles.map(cf => (
            <button key={cf} onClick={() => setSelFile(cf)}
              className={`text-[10px] font-mono px-2 py-1 rounded-md whitespace-nowrap transition-colors ${
                selFile === cf ? 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/25' : 'text-zinc-600 hover:text-zinc-300 bg-zinc-800/60'
              }`}>{cf.split('/').pop()}</button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex-1 p-3 space-y-px">
          {Array.from({ length: 22 }).map((_, i) => (
            <Skeleton key={i} className="h-5 rounded-none bg-zinc-800/30" style={{ opacity: 1 - i * 0.035 }} />
          ))}
        </div>
      ) : error ? (
        <p className="p-4 text-rose-400 text-xs">{error}</p>
      ) : mode === 'unified' ? (
        <Unified lines={lines} />
      ) : (
        <Split lines={lines} />
      )}
    </div>
  );
}

function Unified({ lines }: { lines: DiffLine[] }) {
  return (
    <div className="flex-1 overflow-auto min-h-0">
      <div className="font-mono text-[11.5px] leading-5 min-w-max">
        {lines.map((line, i) => (
          <div key={i} className={`flex items-start ${rowBg(line.type)}`}>
            <span className="text-zinc-700 w-12 text-right pr-4 flex-shrink-0 select-none tabular-nums py-px">{line.newLine || line.oldLine || ''}</span>
            <span className={`w-4 flex-shrink-0 select-none py-px text-center font-semibold ${sigColor(line.type)}`}>
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
              <td className={`w-1/2 align-top border-r border-zinc-800/60 ${rowBg(pair.left?.type || 'context')}`}>
                <div className="flex items-start">
                  <span className="text-zinc-700 w-12 text-right pr-4 flex-shrink-0 tabular-nums py-px select-none">{pair.left?.oldLine || ''}</span>
                  <span className="py-px pr-6 whitespace-pre">{pair.left?.content || ''}</span>
                </div>
              </td>
              <td className={`w-1/2 align-top ${rowBg(pair.right?.type || 'context')}`}>
                <div className="flex items-start">
                  <span className="text-zinc-700 w-12 text-right pr-4 flex-shrink-0 tabular-nums py-px select-none">{pair.right?.newLine || ''}</span>
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

function rowBg(t: DiffLine['type']): string {
  switch (t) {
    case 'add':    return 'bg-emerald-950/60 text-emerald-200';
    case 'remove': return 'bg-rose-950/60 text-rose-200';
    case 'header': return 'bg-blue-950/40 text-blue-400';
    case 'meta':   return 'bg-zinc-950 text-zinc-600';
    default:       return 'text-zinc-300';
  }
}

function sigColor(t: DiffLine['type']): string {
  if (t === 'add') return 'text-emerald-500';
  if (t === 'remove') return 'text-rose-500';
  return 'text-zinc-700';
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
