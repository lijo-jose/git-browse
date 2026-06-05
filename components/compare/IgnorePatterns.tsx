'use client';

import { useRef, useState, KeyboardEvent } from 'react';

export const DEFAULT_PATTERNS = [
  '.git', 'node_modules', '__pycache__', '.DS_Store',
  '*.pyc', '*.pyo', '.env', 'dist', 'build', '.next',
];

interface Props {
  patterns: string[];
  onChange: (patterns: string[]) => void;
}

export default function IgnorePatterns({ patterns, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed || patterns.includes(trimmed)) return;
    onChange([...patterns, trimmed]);
    setInput('');
  };

  const remove = (p: string) => onChange(patterns.filter(x => x !== p));

  const reset = () => onChange([...DEFAULT_PATTERNS]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(input); }
    if (e.key === 'Backspace' && !input && patterns.length) remove(patterns[patterns.length - 1]);
  };

  return (
    <div className="shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      {/* Header toggle */}
      <button
        onClick={() => { setOpen(o => !o); setTimeout(() => inputRef.current?.focus(), 80); }}
        className="w-full flex items-center justify-between px-3 py-2 transition-colors"
        style={{ color: 'var(--text-dim)' }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-raised)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
      >
        <div className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M6 12h12M9 18h6"/>
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-widest">Ignore patterns</span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ background: 'var(--bg-raised)', color: 'var(--text-dim)' }}>
            {patterns.length}
          </span>
        </div>
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 150ms' }}>
          <path d="M2 4l4 4 4-4"/>
        </svg>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {/* Tag input */}
          <div
            className="flex flex-wrap gap-1 p-2 rounded-lg min-h-[36px] cursor-text"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}
            onClick={() => inputRef.current?.focus()}
          >
            {patterns.map(p => (
              <span key={p} className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-md"
                style={{ background: 'var(--bg-panel)', color: 'var(--text-soft)', border: '1px solid var(--border-subtle)' }}>
                {p}
                <button
                  onClick={e => { e.stopPropagation(); remove(p); }}
                  className="opacity-50 hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--text-dim)' }}
                >
                  <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M9 3L3 9M3 3l6 6"/>
                  </svg>
                </button>
              </span>
            ))}
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              onBlur={() => { if (input.trim()) add(input); }}
              placeholder={patterns.length ? '' : 'e.g. node_modules, *.pyc'}
              className="flex-1 min-w-[80px] text-[10px] font-mono bg-transparent outline-none"
              style={{ color: 'var(--foreground)', caretColor: 'var(--primary)' }}
            />
          </div>

          {/* Hints row */}
          <div className="flex items-center justify-between">
            <p className="text-[9px]" style={{ color: 'var(--text-dim)' }}>Enter or comma to add · Backspace to remove last</p>
            <button
              onClick={reset}
              className="text-[9px] font-semibold transition-colors"
              style={{ color: 'var(--text-dim)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--foreground)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'}
            >Reset defaults</button>
          </div>

          {/* Quick-add common patterns */}
          <div className="flex flex-wrap gap-1">
            {['.git','node_modules','__pycache__','dist','build','.next','*.pyc','.env'].filter(p => !patterns.includes(p)).map(p => (
              <button key={p} onClick={() => add(p)}
                className="text-[9px] font-mono px-1.5 py-0.5 rounded-md transition-colors"
                style={{ background: 'var(--bg-panel)', color: 'var(--text-dim)', border: '1px solid var(--border-subtle)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--foreground)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}
              >+ {p}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
