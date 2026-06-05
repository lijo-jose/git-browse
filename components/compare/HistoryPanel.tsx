'use client';

import { useEffect, useState } from 'react';
import { getHistory, removeHistory, clearHistory, type HistoryEntry } from '@/lib/compareHistory';

interface Props {
  mode: 'folders' | 'files';
  onSelect: (entry: HistoryEntry) => void;
  refreshKey?: number; // bump to trigger re-read
}

export default function HistoryPanel({ mode, onSelect, refreshKey }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [open, setOpen] = useState(true);

  const reload = () => setEntries(getHistory(mode));

  useEffect(reload, [mode, refreshKey]);

  if (entries.length === 0) return null;

  const remove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeHistory(id);
    reload();
  };

  const clear = () => { clearHistory(mode); reload(); };

  return (
    <div className="shrink-0" style={{ borderTop: '1px solid var(--border-subtle)' }}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 transition-colors"
        style={{ color: 'var(--text-dim)' }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-raised)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
      >
        <div className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-widest">History</span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-raised)', color: 'var(--text-dim)' }}>
            {entries.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            role="button"
            onClick={e => { e.stopPropagation(); clear(); }}
            className="text-[10px] transition-colors"
            style={{ color: 'var(--text-dim)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--foreground)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'}
          >Clear</span>
          <svg
            width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className="transition-transform"
            style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
          >
            <path d="M2 4l4 4 4-4"/>
          </svg>
        </div>
      </button>

      {/* Entries */}
      {open && (
        <div className="max-h-48 overflow-y-auto">
          {entries.map(entry => (
            <button
              key={entry.id}
              onClick={() => onSelect(entry)}
              className="w-full flex items-start gap-2 px-3 py-2 text-left group transition-colors"
              style={{ borderBottom: '1px solid color-mix(in oklch, var(--border-subtle) 40%, transparent)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-raised)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
            >
              <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm flex items-center justify-center text-[8px] font-bold text-white shrink-0" style={{ background: '#f87171' }}>L</span>
                  <span className="font-mono text-[10px] truncate" style={{ color: 'var(--text-soft)' }}>{shortPath(entry.left)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm flex items-center justify-center text-[8px] font-bold text-white shrink-0" style={{ background: '#34d399' }}>R</span>
                  <span className="font-mono text-[10px] truncate" style={{ color: 'var(--text-soft)' }}>{shortPath(entry.right)}</span>
                </div>
                <span className="text-[9px]" style={{ color: 'var(--text-dim)' }}>{relativeTime(entry.ts)}</span>
              </div>
              <span
                role="button"
                onClick={e => remove(entry.id, e)}
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 flex items-center justify-center rounded-md mt-0.5"
                style={{ color: 'var(--text-dim)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--foreground)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'}
              >
                <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M9 3L3 9M3 3l6 6"/>
                </svg>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function shortPath(p: string): string {
  const parts = p.split('/');
  if (parts.length <= 3) return p;
  return '…/' + parts.slice(-2).join('/');
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}
