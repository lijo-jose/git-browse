'use client';

import { useState } from 'react';
import { useOperationLog, type OpEntry, type OpStatus } from '@/lib/operationLog';

function fmt(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function ago(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function StatusDot({ status }: { status: OpStatus }) {
  if (status === 'pending') {
    return (
      <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'oklch(0.75 0.14 200)' }} />
    );
  }
  if (status === 'success') {
    return <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'oklch(0.74 0.17 150)' }} />;
  }
  return <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'oklch(0.62 0.22 25)' }} />;
}

function StatusPill({ status }: { status: OpStatus }) {
  const styles: Record<OpStatus, { bg: string; color: string; label: string }> = {
    pending: { bg: 'color-mix(in oklch, oklch(0.75 0.14 200) 15%, transparent)', color: 'oklch(0.65 0.14 200)', label: 'running' },
    success: { bg: 'color-mix(in oklch, oklch(0.74 0.17 150) 15%, transparent)', color: 'oklch(0.64 0.17 150)', label: 'done' },
    error: { bg: 'color-mix(in oklch, oklch(0.62 0.22 25) 15%, transparent)', color: 'oklch(0.62 0.22 25)', label: 'error' },
  };
  const s = styles[status];
  return (
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function EntryRow({ entry }: { entry: OpEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = !!(entry.result || entry.error);

  return (
    <div
      className="px-3 py-2 border-b last:border-b-0"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <StatusDot status={entry.status} />
        <span className="text-xs font-medium truncate flex-1" style={{ color: 'var(--foreground)' }}>
          {entry.label}
        </span>
        <StatusPill status={entry.status} />
        {entry.duration != null && (
          <span className="text-[10px] font-mono flex-shrink-0" style={{ color: 'var(--text-dim)' }}>
            {fmt(entry.duration)}
          </span>
        )}
        <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-dim)' }}>
          {ago(entry.startedAt)}
        </span>
        {hasDetail && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex-shrink-0 rounded px-1 text-[10px] transition-colors"
            style={{ color: 'var(--text-dim)' }}
          >
            {expanded ? '▲' : '▼'}
          </button>
        )}
      </div>
      <div className="mt-1 ml-3.5">
        <code className="text-[10px] font-mono" style={{ color: 'var(--text-dim)' }}>
          {entry.cmd}
        </code>
      </div>
      {/* Suggestion pill — always visible for errors that have one */}
      {entry.status === 'error' && entry.suggestion && (
        <p className="mt-1.5 ml-3.5 text-[10.5px] leading-snug" style={{ color: 'oklch(0.72 0.16 70)' }}>
          {entry.suggestion}
        </p>
      )}
      {expanded && hasDetail && (
        <div
          className="mt-1.5 ml-3.5 rounded px-2 py-1.5 text-[10px] font-mono leading-relaxed whitespace-pre-wrap break-all"
          style={{
            background: entry.error
              ? 'color-mix(in oklch, oklch(0.62 0.22 25) 8%, transparent)'
              : 'color-mix(in oklch, oklch(0.74 0.17 150) 8%, transparent)',
            color: entry.error ? 'oklch(0.62 0.22 25)' : 'var(--text-soft)',
          }}
        >
          {entry.error ?? entry.result}
        </div>
      )}
    </div>
  );
}

export default function OperationDrawer() {
  const { entries, clear } = useOperationLog();
  const [open, setOpen] = useState(false);

  const last = entries[0];

  if (!last) return null;

  return (
    <div className="relative flex-shrink-0" style={{ zIndex: 40 }}>
      {/* Expanded list — absolute, grows upward */}
      {open && (
        <div
          className="absolute bottom-full left-0 right-0 overflow-y-auto"
          style={{
            maxHeight: 240,
            background: 'var(--bg-panel)',
            borderTop: '1px solid var(--border-subtle)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div className="flex items-center justify-between px-3 py-1.5 sticky top-0" style={{ background: 'var(--bg-panel)', borderBottom: '1px solid var(--border-subtle)' }}>
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
              Operations ({entries.length})
            </span>
            <button
              onClick={() => { clear(); setOpen(false); }}
              className="text-[10px] transition-colors hover:opacity-70"
              style={{ color: 'var(--text-dim)' }}
            >
              Clear
            </button>
          </div>
          {entries.map(e => <EntryRow key={e.id} entry={e} />)}
        </div>
      )}

      {/* Collapsed bar — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 transition-colors hover:opacity-80"
        style={{
          height: 28,
          background: 'var(--bg-panel)',
          borderTop: '1px solid var(--border-subtle)',
          color: 'var(--text-soft)',
        }}
      >
        <StatusDot status={last.status} />
        <span className="text-xs font-medium truncate flex-1 text-left" style={{ color: 'var(--foreground)' }}>
          {last.label}
        </span>
        <code className="text-[10px] font-mono truncate max-w-[200px]" style={{ color: 'var(--text-dim)' }}>
          {last.cmd}
        </code>
        {last.duration != null && (
          <span className="text-[10px] font-mono flex-shrink-0" style={{ color: 'var(--text-dim)' }}>
            {fmt(last.duration)}
          </span>
        )}
        {last.error && (
          <span className="text-[10px] truncate max-w-[160px]" style={{ color: 'oklch(0.62 0.22 25)' }}>
            {last.error}
          </span>
        )}
        <span className="text-[10px] flex-shrink-0 ml-auto" style={{ color: 'var(--text-dim)' }}>
          {open ? '▼' : '▲'}
        </span>
      </button>
    </div>
  );
}
