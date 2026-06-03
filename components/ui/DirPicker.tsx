'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface FsEntry { name: string; path: string; isDirectory: boolean; }

interface Props {
  value: string;
  onChange: (path: string) => void;
  onClose: () => void;
}

export default function DirPicker({ value, onChange, onClose }: Props) {
  const [cur, setCur] = useState(value || '~');
  const [resolved, setResolved] = useState('');
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/fs?path=${encodeURIComponent(p)}`);
      const d = await res.json();
      // filter to directories only
      setEntries((d.entries || []).filter((e: FsEntry) => e.isDirectory));
      setResolved(d.path || p);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(cur); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [onClose]);

  const crumbs = resolved.split('/').filter(Boolean);
  const nav = (i: number) => { const p = '/' + crumbs.slice(0, i + 1).join('/'); setCur(p); load(p); };
  const select = (e: FsEntry) => { setCur(e.path); load(e.path); };
  const choose = () => { onChange(resolved); onClose(); };

  return (
    <div ref={ref} className="absolute z-[60] top-full mt-1 left-0 right-0 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: 280 }}>
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid color-mix(in oklch, var(--border-subtle) 60%, transparent)' }}>
        <button onClick={() => { setCur('~'); load('~'); }}
          className="text-[11px] font-medium text-blue-500 hover:text-blue-400 transition-colors">~</button>
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center">
            <span className="mx-0.5 text-[11px]" style={{ color: 'var(--text-dim)' }}>/</span>
            <button onClick={() => nav(i)} className="text-[11px] font-medium text-blue-500 hover:text-blue-400 transition-colors break-all">{c}</button>
          </span>
        ))}
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading ? (
          <div className="px-3 py-2 text-xs text-[var(--text-dim)]">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="px-3 py-2 text-xs text-[var(--text-dim)]">No subdirectories</div>
        ) : (
          entries.map(e => (
            <button key={e.path}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-soft)] hover:text-foreground hover:bg-[var(--bg-raised)] transition-colors text-left"
              onClick={() => select(e)}
            >
              <FolderIcon />
              <span className="truncate">{e.name}</span>
            </button>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 flex-shrink-0" style={{ borderTop: '1px solid color-mix(in oklch, var(--border-subtle) 60%, transparent)' }}>
        <span className="text-[11px] text-[var(--text-dim)] truncate flex-1 mr-2">{resolved}</span>
        <button onClick={choose}
          className="h-6 px-3 rounded-md text-[11px] font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity flex-shrink-0">
          Select
        </button>
      </div>
    </div>
  );
}

function FolderIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="text-[var(--text-soft)] flex-shrink-0">
      <path d="M1 3.5A1.5 1.5 0 012.5 2h3.764c.69 0 1.35.28 1.837.78L9 3.5h4.5A1.5 1.5 0 0115 5v7.5A1.5 1.5 0 0113.5 14h-11A1.5 1.5 0 011 12.5v-9z"/>
    </svg>
  );
}
