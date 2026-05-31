'use client';

import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface DiffViewerProps { repo: string; file?: string; commit?: string; staged?: boolean; }
type DiffMode = 'unified' | 'split';
interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'header' | 'meta';
  content: string;
  oldLine?: number;
  newLine?: number;
}

export default function DiffViewer({ repo, file, commit, staged }: DiffViewerProps) {
  const [raw, setRaw] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<DiffMode>('unified');
  const [commitFiles, setCommitFiles] = useState<string[]>([]);
  const [selectedCommitFile, setSelectedCommitFile] = useState<string | null>(null);

  useEffect(() => {
    if (!repo || (!file && !commit)) { setRaw(''); return; }
    setLoading(true); setError('');
    const params = new URLSearchParams({ repo });
    if (commit) params.set('commit', commit);
    if (file) params.set('file', file);
    else if (selectedCommitFile) params.set('file', selectedCommitFile);

    fetch(`/api/git/diff?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else {
          setRaw(d.diff || '');
          if (commit && !file) {
            const files = extractFiles(d.diff || '');
            setCommitFiles(files);
            if (files.length > 0 && !selectedCommitFile) setSelectedCommitFile(files[0]);
          }
        }
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [repo, file, commit, selectedCommitFile]);

  const lines = parseDiff(raw);
  const title = file || (commit ? commit.slice(0, 8) : '');

  if (!repo || (!file && !commit)) return (
    <div className="flex flex-col items-center justify-center h-full text-[#404040] gap-2">
      <span className="text-3xl opacity-20">⊞</span>
      <p className="text-xs font-medium">Select a file or commit</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#2e2e2e] bg-[#141414] flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[#505050] text-xs">📄</span>
          <span className="text-xs text-[#c0c0c0] font-mono truncate">{title}</span>
          {staged !== undefined && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
              staged
                ? 'bg-[#4d9de0]/15 text-[#4d9de0] border border-[#4d9de0]/20'
                : 'bg-[#d4a44c]/15 text-[#d4a44c] border border-[#d4a44c]/20'
            }`}>
              {staged ? 'staged' : 'unstaged'}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {(['unified', 'split'] as DiffMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors ${
                mode === m
                  ? 'bg-[#4d9de0]/15 text-[#4d9de0] border border-[#4d9de0]/20'
                  : 'text-[#606060] hover:text-[#b0b0b0] hover:bg-[#262626]'
              }`}
            >{m}</button>
          ))}
        </div>
      </div>

      {/* Commit file tabs */}
      {commit && !file && commitFiles.length > 0 && (
        <div className="flex gap-1 px-3 py-1.5 border-b border-[#2e2e2e] overflow-x-auto bg-[#1a1a1a] flex-shrink-0">
          {commitFiles.map((cf) => (
            <button
              key={cf}
              onClick={() => setSelectedCommitFile(cf)}
              className={`text-[10px] font-mono px-2 py-1 rounded-md whitespace-nowrap transition-colors ${
                selectedCommitFile === cf
                  ? 'bg-[#4d9de0]/15 text-[#4d9de0] border border-[#4d9de0]/20'
                  : 'text-[#606060] hover:text-[#b0b0b0] bg-[#1e1e1e] border border-[#2e2e2e]'
              }`}
            >{cf.split('/').pop()}</button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="p-3 space-y-0.5 flex-1">
          {Array.from({ length: 20 }).map((_, i) => <Skeleton key={i} className="h-5 rounded-none bg-[#1e1e1e]" style={{ opacity: 1 - i * 0.03 }} />)}
        </div>
      ) : error ? (
        <div className="p-4 text-[#c96b6b] text-xs">{error}</div>
      ) : mode === 'unified' ? (
        <UnifiedDiff lines={lines} />
      ) : (
        <SplitDiff lines={lines} />
      )}
    </div>
  );
}

function UnifiedDiff({ lines }: { lines: DiffLine[] }) {
  return (
    <div className="flex-1 overflow-auto">
      <div className="font-mono text-[11.5px] leading-5 min-w-max">
        {lines.map((line, i) => (
          <div key={i} className={`flex items-start ${lineClass(line.type)}`}>
            <span className="text-[#383838] w-12 text-right pr-4 flex-shrink-0 select-none tabular-nums py-px">
              {line.newLine || line.oldLine || ''}
            </span>
            <span className="text-[#3c3c3c] w-4 flex-shrink-0 select-none py-px text-center">
              {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
            </span>
            <span className="whitespace-pre flex-1 py-px pr-4">{line.content}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SplitDiff({ lines }: { lines: DiffLine[] }) {
  const pairs = buildSplitPairs(lines);
  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full font-mono text-[11.5px] leading-5 border-collapse min-w-max">
        <tbody>
          {pairs.map((pair, i) => (
            <tr key={i}>
              <td className={`w-1/2 align-top border-r border-[#2e2e2e] ${lineClass(pair.left?.type || 'context')}`}>
                <div className="flex items-start">
                  <span className="text-[#383838] w-12 text-right pr-4 flex-shrink-0 tabular-nums py-px select-none">{pair.left?.oldLine || ''}</span>
                  <span className="whitespace-pre py-px pr-4">{pair.left?.content || ''}</span>
                </div>
              </td>
              <td className={`w-1/2 align-top ${lineClass(pair.right?.type || 'context')}`}>
                <div className="flex items-start">
                  <span className="text-[#383838] w-12 text-right pr-4 flex-shrink-0 tabular-nums py-px select-none">{pair.right?.newLine || ''}</span>
                  <span className="whitespace-pre py-px pr-4">{pair.right?.content || ''}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function lineClass(type: DiffLine['type']): string {
  switch (type) {
    case 'add':    return 'bg-[#1a2e1e] text-[#b5d6b2]';
    case 'remove': return 'bg-[#2e1a1a] text-[#d6b2b2]';
    case 'header': return 'bg-[#1a1f2e] text-[#7aadcf]';
    case 'meta':   return 'bg-[#141414] text-[#454545]';
    default:       return 'text-[#b0b0b0]';
  }
}

function parseDiff(raw: string): DiffLine[] {
  const result: DiffLine[] = [];
  let oldLine = 0, newLine = 0;
  for (const line of raw.split('\n')) {
    if (line.startsWith('@@')) {
      const m = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)/);
      if (m) { oldLine = parseInt(m[1]); newLine = parseInt(m[2]); }
      result.push({ type: 'header', content: line });
    } else if (/^(diff |index |--- |\+\+\+ |commit |Author|Date)/.test(line)) {
      result.push({ type: 'meta', content: line });
    } else if (line.startsWith('+')) {
      result.push({ type: 'add', content: line.slice(1), newLine: newLine++ });
    } else if (line.startsWith('-')) {
      result.push({ type: 'remove', content: line.slice(1), oldLine: oldLine++ });
    } else {
      result.push({ type: 'context', content: line.slice(1), oldLine: oldLine++, newLine: newLine++ });
    }
  }
  return result;
}

function buildSplitPairs(lines: DiffLine[]) {
  const pairs: { left?: DiffLine; right?: DiffLine }[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.type === 'remove' && lines[i + 1]?.type === 'add') {
      pairs.push({ left: line, right: lines[i + 1] }); i += 2;
    } else if (line.type === 'remove') {
      pairs.push({ left: line }); i++;
    } else if (line.type === 'add') {
      pairs.push({ right: line }); i++;
    } else {
      pairs.push({ left: line, right: line }); i++;
    }
  }
  return pairs;
}

function extractFiles(diff: string): string[] {
  return diff.split('\n')
    .filter((l) => l.startsWith('diff --git'))
    .map((l) => { const m = l.match(/b\/(.+)$/); return m ? m[1] : ''; })
    .filter(Boolean);
}
