'use client';

import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface GitFile { path: string; status: string; staged: boolean; }
interface FileListProps {
  repo: string;
  onFileSelect: (file: string, staged: boolean) => void;
  selectedFile?: string;
}

const STATUS: Record<string, { color: string; bg: string; label: string }> = {
  M: { color: '#d4a44c', bg: '#d4a44c18', label: 'M' },
  A: { color: '#5ab99b', bg: '#5ab99b18', label: 'A' },
  D: { color: '#c96b6b', bg: '#c96b6b18', label: 'D' },
  '?': { color: '#636363', bg: 'transparent', label: '?' },
  R: { color: '#4d9de0', bg: '#4d9de018', label: 'R' },
  U: { color: '#c47e3c', bg: '#c47e3c18', label: 'U' },
};

export default function FileList({ repo, onFileSelect, selectedFile }: FileListProps) {
  const [files, setFiles] = useState<GitFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!repo) return;
    setLoading(true); setError('');
    fetch(`/api/git/status?repo=${encodeURIComponent(repo)}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setFiles(d.files || []); })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [repo]);

  if (loading) return (
    <div className="p-2 space-y-1">
      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-7 rounded-md bg-[#222]" />)}
    </div>
  );
  if (error) return <div className="p-4 text-[#c96b6b] text-xs">{error}</div>;

  const staged = files.filter((f) => f.staged);
  const unstaged = files.filter((f) => !f.staged);
  if (files.length === 0) return <EmptyState label="Clean — no changes" />;

  const renderSection = (label: string, items: GitFile[]) =>
    items.length > 0 && (
      <div className="mb-1">
        <div className="px-3 py-1.5 text-[10px] font-semibold tracking-widest text-[#505050] uppercase">{label}</div>
        {items.map((f) => {
          const s = STATUS[f.status] || STATUS['M'];
          const isSelected = selectedFile === f.path;
          return (
            <div
              key={`${f.path}-${f.staged}`}
              className={`flex items-center gap-2.5 mx-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                isSelected ? 'bg-[#4d9de0]/10' : 'hover:bg-[#262626]'
              }`}
              onClick={() => onFileSelect(f.path, f.staged)}
            >
              <span
                className="flex-shrink-0 w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center"
                style={{ color: s.color, background: s.bg }}
              >{s.label}</span>
              <span className={`text-[12px] truncate leading-tight ${isSelected ? 'text-[#dcdcdc]' : 'text-[#a0a0a0]'}`}>
                {f.path}
              </span>
            </div>
          );
        })}
      </div>
    );

  return (
    <div className="flex-1 overflow-y-auto py-1">
      {renderSection('Staged', staged)}
      {renderSection('Unstaged', unstaged)}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-xs text-[#404040] font-medium">{label}</p>
    </div>
  );
}
