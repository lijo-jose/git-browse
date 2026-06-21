'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme, THEMES, type ThemeId } from '@/lib/theme';
import { useDangerZone } from '@/lib/dangerZone';

const DANGEROUS_IDS = new Set(['sync:push', 'sync:pull', 'sync:fetch', 'tag:new']);

export const COMMAND_EVENT = 'gitbrowse:command';

export function dispatchCommand(id: string) {
  window.dispatchEvent(new CustomEvent(COMMAND_EVENT, { detail: id }));
}

interface Command {
  id: string;
  title: string;
  group: string;
  hint?: string;       // keyboard shortcut or note shown on the right
  keywords?: string;
}

export default function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const { setTheme } = useTheme();
  const { unlocked } = useDangerZone();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Global hotkey
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(v => !v);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      try { setRecent(JSON.parse(localStorage.getItem('git-browser-recent') || '[]')); } catch {}
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const onMainPage = pathname === '/';

  const commands: Command[] = useMemo(() => [
    { id: 'nav:/',            group: 'Go to', title: 'Repository' },
    { id: 'nav:/git-compare', group: 'Go to', title: 'Git Compare', keywords: 'branch tag commit diff' },
    { id: 'nav:/compare',     group: 'Go to', title: 'Compare files / folders', keywords: 'clipboard diff' },
    { id: 'nav:/search',      group: 'Go to', title: 'Search', keywords: 'grep find' },

    { id: 'sync:pull',  group: 'Git', title: 'Pull',  hint: 'U · git pull' },
    { id: 'sync:fetch', group: 'Git', title: 'Fetch', hint: 'git fetch' },
    { id: 'sync:push',  group: 'Git', title: 'Push',  hint: 'P · git push' },
    { id: 'tag:new',    group: 'Git', title: 'Create tag…', keywords: 'tag release version', hint: 'T · git tag' },
    { id: 'clone',      group: 'Git', title: 'Clone repository…' },
    { id: 'refresh',    group: 'Git', title: 'Refresh repository', hint: 'R' },

    { id: 'tab:log',      group: 'View', title: 'Show Log',      hint: 'L' },
    { id: 'tab:changes',  group: 'View', title: 'Show Changes',  hint: 'C' },
    { id: 'tab:branches', group: 'View', title: 'Show Branches', hint: 'B' },
    { id: 'tab:stash',    group: 'View', title: 'Show Stash' },
    { id: 'toggle:diff',     group: 'View', title: 'Toggle diff panel', hint: 'D' },
    { id: 'toggle:explorer', group: 'View', title: 'Toggle explorer',   hint: 'E' },
    { id: 'guide', group: 'View', title: 'Open user guide' },

    ...THEMES.map(t => ({ id: `theme:${t.id}`, group: 'Theme', title: `Theme: ${t.label}` })),

    ...recent.map(r => ({
      id: `repo:${r}`,
      group: 'Open recent repo',
      title: r.split('/').pop() || r,
      hint: r,
      keywords: r,
    })),
  ], [recent]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(c =>
      `${c.title} ${c.group} ${c.keywords || ''}`.toLowerCase().includes(q));
  }, [commands, query]);

  const groups = useMemo(() => {
    const seen: string[] = [];
    for (const c of filtered) if (!seen.includes(c.group)) seen.push(c.group);
    return seen;
  }, [filtered]);

  const execute = useCallback((cmd: Command) => {
    setOpen(false);
    if (cmd.id.startsWith('nav:')) {
      router.push(cmd.id.slice(4));
      return;
    }
    if (cmd.id.startsWith('theme:')) {
      setTheme(cmd.id.slice(6) as ThemeId);
      return;
    }
    if (cmd.id.startsWith('repo:')) {
      const repo = cmd.id.slice(5);
      try { localStorage.setItem('git-browser-last-repo', repo); } catch {}
      if (onMainPage) dispatchCommand(cmd.id);
      else router.push('/');
      return;
    }
    // Page-level commands live on the main page; navigate there first if needed
    if (onMainPage) {
      dispatchCommand(cmd.id);
    } else {
      router.push('/');
      setTimeout(() => dispatchCommand(cmd.id), 150);
    }
  }, [router, onMainPage, setTheme]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && filtered[index]) { e.preventDefault(); execute(filtered[index]); }
  };

  useEffect(() => { setIndex(0); }, [query]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  if (!open) return null;

  let flatIndex = -1;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] bg-black/40 backdrop-blur-[2px]" onClick={() => setOpen(false)}>
      <div
        className="w-[560px] max-w-[90vw] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', maxHeight: '60vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 h-12 flex-shrink-0" style={{ borderBottom: '1px solid color-mix(in oklch, var(--border-subtle) 60%, transparent)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--text-dim)' }}>
            <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type a command or search…"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--foreground)' }}
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ background: 'var(--bg-raised)', color: 'var(--text-dim)' }}>esc</kbd>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto py-1.5 min-h-0">
          {filtered.length === 0 && (
            <p className="px-4 py-6 text-xs text-center" style={{ color: 'var(--text-dim)' }}>No matching commands</p>
          )}
          {groups.map(group => (
            <div key={group}>
              <p className="px-4 pt-2 pb-1 text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--text-dim)' }}>{group}</p>
              {filtered.filter(c => c.group === group).map(cmd => {
                flatIndex++;
                const i = flatIndex;
                const active = i === index;
                return (
                  <button
                    key={cmd.id}
                    data-active={active}
                    onClick={() => execute(cmd)}
                    onMouseEnter={() => setIndex(i)}
                    className="w-full flex items-center gap-3 px-4 py-2 text-left text-xs transition-colors"
                    style={{
                      background: active ? 'color-mix(in oklch, var(--primary) 12%, transparent)' : undefined,
                      color: active ? 'var(--foreground)' : 'var(--text-soft)',
                    }}
                  >
                    <span className="font-medium truncate flex-1">{cmd.title}</span>
                    <span className="flex items-center gap-1.5 flex-shrink-0">
                      {!unlocked && DANGEROUS_IDS.has(cmd.id) && (
                        <span className="flex items-center gap-0.5 text-[10px] font-mono" style={{ color: 'oklch(0.72 0.16 70)' }}>
                          <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="7" width="10" height="8" rx="1.5"/><path d="M5 7V5a3 3 0 016 0v2"/>
                          </svg>
                        </span>
                      )}
                      {cmd.hint && (
                        <span className="text-[10px] font-mono truncate max-w-[220px]" style={{ color: 'var(--text-dim)' }}>{cmd.hint}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 px-4 h-8 flex-shrink-0 text-[10px]" style={{ borderTop: '1px solid color-mix(in oklch, var(--border-subtle) 60%, transparent)', color: 'var(--text-dim)' }}>
          <span>↑↓ navigate</span><span>↵ run</span><span>esc close</span>
        </div>
      </div>
    </div>
  );
}
