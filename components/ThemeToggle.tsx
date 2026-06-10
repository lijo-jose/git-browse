'use client';

import { useRef, useState, useEffect } from 'react';
import { useTheme, THEMES, FONT_SIZES, type FontSize } from '@/lib/theme';

export default function ThemeToggle({ placement = 'topbar' }: { placement?: 'topbar' | 'rail' }) {
  const { theme, setTheme, fontSize, setFontSize } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Theme & font size"
        className={placement === 'rail'
          ? 'w-9 h-9 flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-foreground hover:bg-[var(--bg-raised)] transition-colors'
          : 'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors'}
      >
        <svg width={placement === 'rail' ? 16 : 13} height={placement === 'rail' ? 16 : 13} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="3"/>
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.22 3.22l1.42 1.42M11.36 11.36l1.42 1.42M3.22 12.78l1.42-1.42M11.36 4.64l1.42-1.42"/>
        </svg>
        {placement !== 'rail' && <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor"><path d="M5 7L1 3h8z"/></svg>}
      </button>

      {open && (
        <div className={`absolute z-50 w-52 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-xl shadow-2xl overflow-hidden ${
          placement === 'rail' ? 'left-11 bottom-0' : 'right-0 top-9'
        }`}>
          {/* Theme section */}
          <div className="px-3 pt-2.5 pb-1 text-[10px] font-semibold tracking-widest text-[var(--text-dim)] uppercase">Theme</div>
          <div className="px-2 pb-2 flex flex-col gap-0.5">
            {THEMES.map(t => (
              <button
                key={t.id}
                onClick={() => { setTheme(t.id); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs transition-colors text-left ${
                  theme === t.id
                    ? 'bg-primary/20 text-[var(--foreground)] font-medium'
                    : 'text-[var(--text-soft)] hover:bg-[var(--bg-raised)] hover:text-[var(--foreground)]'
                }`}
              >
                <ThemeSwatch id={t.id} />
                {t.label}
                {theme === t.id && (
                  <svg className="ml-auto" width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M2 5l2.5 2.5L8 3"/></svg>
                )}
              </button>
            ))}
          </div>

          <div className="mx-3 h-px bg-[var(--border-subtle)]" />

          {/* Font size section */}
          <div className="px-3 pt-2 pb-1 text-[10px] font-semibold tracking-widest text-[var(--text-dim)] uppercase">Font size</div>
          <div className="px-2 pb-2.5 flex items-center gap-1">
            {FONT_SIZES.map(s => (
              <button
                key={s}
                onClick={() => setFontSize(s as FontSize)}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  fontSize === s
                    ? 'bg-primary/20 text-[var(--foreground)]'
                    : 'text-[var(--text-dim)] hover:bg-[var(--bg-raised)] hover:text-[var(--foreground)]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ThemeSwatch({ id }: { id: string }) {
  const swatches: Record<string, string> = {
    'dark':      'linear-gradient(135deg, #0e0e10 50%, #1c1c20 50%)',
    'calm-dark': 'linear-gradient(135deg, #161b26 50%, #1e2433 50%)',
    'dim':       'linear-gradient(135deg, #222018 50%, #2c2924 50%)',
    'light':     'linear-gradient(135deg, #f5f6f9 50%, #e8eaf0 50%)',
  };
  return (
    <span
      className="w-4 h-4 rounded-sm border border-white/10 flex-shrink-0"
      style={{ background: swatches[id] ?? '#888' }}
    />
  );
}
