'use client';

import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface GitFile { path: string; status: string; staged: boolean; }
interface Props { repo: string; onFileSelect: (f: string, s: boolean) => void; selectedFile?: string; }

const S: Record<string, { cls: string; label: string }> = {
  M: { cls: 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/25', label: 'M' },
  A: { cls: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25', label: 'A' },
  D: { cls: 'bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/25', label: 'D' },
  '?': { cls: 'bg-zinc-800 text-zinc-500', label: '?' },
  R: { cls: 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/25', label: 'R' },
  U: { cls: 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/25', label: 'U' },
};

export default function FileList({ repo, onFileSelect, selectedFile }: Props) {
  const [files, setFiles] = useState<GitFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!repo) return;
    setLoading(true); setError('');
    fetch(`/api/git/status?repo=${encodeURIComponent(repo)}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setFiles(d.files || []); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [repo]);

  if (loading) return (
    <div className="p-3 space-y-1">
      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 rounded-lg bg-zinc-800/50" />)}
    </div>
  );
  if (error) return <p className="p-4 text-rose-400 text-xs">{error}</p>;
  if (!files.length) return <Empty label="Working tree clean" />;

  const staged = files.filter(f => f.staged);
  const unstaged = files.filter(f => !f.staged);

  return (
    <div className="flex-1 overflow-y-auto py-2 min-h-0">
      {staged.length > 0 && <Section label="Staged" files={staged} selectedFile={selectedFile} onFileSelect={onFileSelect} />}
      {unstaged.length > 0 && <Section label="Unstaged" files={unstaged} selectedFile={selectedFile} onFileSelect={onFileSelect} />}
    </div>
  );
}

function Section({ label, files, selectedFile, onFileSelect }: {
  label: string; files: GitFile[]; selectedFile?: string; onFileSelect: (f: string, s: boolean) => void;
}) {
  return (
    <div className="mb-1">
      <p className="px-4 py-1 text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">{label}</p>
      {files.map(f => {
        const style = S[f.status] || S['M'];
        const isSelected = selectedFile === f.path;
        return (
          <div key={`${f.path}-${f.staged}`}
            className={`flex items-center gap-2.5 mx-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
              isSelected ? 'bg-blue-500/10 ring-1 ring-blue-500/20' : 'hover:bg-zinc-800/50'
            }`}
            onClick={() => onFileSelect(f.path, f.staged)}
          >
            <span className={`text-[10px] font-bold w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${style.cls}`}>
              {style.label}
            </span>
            <span className={`text-xs truncate font-medium ${isSelected ? 'text-zinc-100' : 'text-zinc-400'}`}>
              {f.path.split('/').pop()}
            </span>
            <span className={`text-[10px] truncate hidden sm:block flex-1 min-w-0 ${isSelected ? 'text-zinc-500' : 'text-zinc-600'}`}>
              {f.path.includes('/') ? f.path.split('/').slice(0, -1).join('/') : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-xs text-zinc-700 font-medium">{label}</p>
    </div>
  );
}
