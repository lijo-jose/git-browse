'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface FsEntry { name: string; path: string; isDirectory: boolean; isGitRepo: boolean; isIgnored?: boolean; }
interface Props { onRepoSelect: (p: string) => void; selectedRepo: string | null; navigateTo?: string | null; }

const FAV_KEY = 'git-browser-favorites';
const COMPARE_LEFT_KEY = 'git-browser-compare-left';

interface CtxMenu { x: number; y: number; entry: FsEntry; }

export default function FolderPanel({ onRepoSelect, selectedRepo, navigateTo }: Props) {
  const [cur, setCur] = useState('~');
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showIgnored, setShowIgnored] = useState(false);
  const [favs, setFavs] = useState<{ name: string; path: string; isGitRepo?: boolean }[]>([]);
  const [resolved, setResolved] = useState('');
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [compareLeft, setCompareLeft] = useState<{ name: string; path: string } | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const load = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/fs?path=${encodeURIComponent(p)}`);
      const d = await res.json();
      setEntries(d.entries || []);
      setResolved(d.path || p);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const initialDir = selectedRepo
      ? (() => {
          const winPath = /^[A-Za-z]:[/\\]/.test(selectedRepo);
          const parts = selectedRepo.split(/[/\\]/);
          parts.pop();
          return winPath ? (parts.join('\\') + '\\') || selectedRepo : parts.join('/') || '/';
        })()
      : cur;
    load(initialDir);
    try {
      const s = localStorage.getItem(FAV_KEY); if (s) setFavs(JSON.parse(s));
      const cl = localStorage.getItem(COMPARE_LEFT_KEY); if (cl) setCompareLeft(JSON.parse(cl));
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!navigateTo) return;
    const winNav = /^[A-Za-z]:[/\\]/.test(navigateTo);
    const navParts = navigateTo.split(/[/\\]/);
    navParts.pop();
    const dir = winNav ? (navParts.join('\\') + '\\') || navigateTo : navParts.join('/') || '/';
    setCur(dir);
    load(dir);
  }, [navigateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close context menu on outside click or scroll
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    document.addEventListener('click', close);
    document.addEventListener('contextmenu', close);
    document.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('contextmenu', close);
      document.removeEventListener('scroll', close, true);
    };
  }, [ctxMenu]);

  const go = (e: FsEntry) => {
    if (e.isGitRepo) onRepoSelect(e.path);
    if (e.isDirectory) { setCur(e.path); load(e.path); }
  };

  const isWindows = /^[A-Za-z]:[/\\]/.test(resolved);
  const sep = isWindows ? '\\' : '/';
  const crumbs = resolved.split(/[/\\]/).filter(Boolean);
  const nav = (i: number) => {
    const parts = crumbs.slice(0, i + 1);
    const p = isWindows ? parts.join('\\') + '\\' : '/' + parts.join('/');
    setCur(p); load(p);
  };

  const pin = (e: FsEntry) => {
    const next = [...favs.filter(f => f.path !== e.path), { name: e.name, path: e.path, isGitRepo: e.isGitRepo }];
    setFavs(next); localStorage.setItem(FAV_KEY, JSON.stringify(next));
  };
  const unpin = (path: string) => {
    const next = favs.filter(f => f.path !== path);
    setFavs(next); localStorage.setItem(FAV_KEY, JSON.stringify(next));
  };

  const openCtxMenu = (ev: React.MouseEvent, entry: FsEntry) => {
    ev.preventDefault();
    ev.stopPropagation();
    setCtxMenu({ x: ev.clientX, y: ev.clientY, entry });
  };

  const copyPath = (path: string) => {
    navigator.clipboard.writeText(path).then(
      () => toast.success('Copied', { description: path }),
      () => toast.error('Copy failed'),
    );
    setCtxMenu(null);
  };

  const setAsLeft = (entry: FsEntry) => {
    const val = { name: entry.name, path: entry.path };
    setCompareLeft(val);
    localStorage.setItem(COMPARE_LEFT_KEY, JSON.stringify(val));
    toast.success('Set as left folder', { description: entry.path });
    setCtxMenu(null);
  };

  const compareWith = (right: FsEntry) => {
    if (!compareLeft) return;
    localStorage.removeItem(COMPARE_LEFT_KEY);
    setCompareLeft(null);
    setCtxMenu(null);
    router.push(`/compare?left=${encodeURIComponent(compareLeft.path)}&right=${encodeURIComponent(right.path)}`);
  };

  const clearLeft = () => {
    localStorage.removeItem(COMPARE_LEFT_KEY);
    setCompareLeft(null);
    setCtxMenu(null);
  };

  const isPinned = (path: string) => favs.some(f => f.path === path);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Compare left banner */}
      {compareLeft && (
        <div className="flex items-center gap-2 px-3 py-1.5 text-[11px]"
          style={{ background: 'color-mix(in oklch, oklch(0.6 0.18 140) 10%, transparent)', borderBottom: '1px solid color-mix(in oklch, oklch(0.6 0.18 140) 25%, transparent)' }}>
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ color: 'oklch(0.6 0.18 140)', flexShrink: 0 }}>
            <path d="M2 8h12M8 2l6 6-6 6"/>
          </svg>
          <span className="flex-1 truncate" style={{ color: 'var(--text-soft)' }}>
            Left: <span className="font-medium" style={{ color: 'var(--foreground)' }}>{compareLeft.name}</span>
          </span>
          <button onClick={clearLeft} className="text-[10px] hover:text-rose-400 transition-colors" style={{ color: 'var(--text-dim)' }}>✕</button>
        </div>
      )}

      {/* Pinned */}
      {favs.length > 0 && (
        <div className="py-1.5" style={{ borderBottom: '1px solid color-mix(in oklch, var(--border-subtle) 60%, transparent)' }}>
          <p className="px-4 mb-1 text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--text-dim)' }}>Pinned</p>
          {favs.map(f => (
            <div key={f.path} className="group flex items-center gap-2 mx-2 px-2 py-1 rounded-lg cursor-pointer transition-colors"
              style={{}}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'color-mix(in oklch, var(--bg-raised) 50%, transparent)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
              onClick={() => { onRepoSelect(f.path); setCur(f.path); load(f.path); }}
              onContextMenu={ev => openCtxMenu(ev, { name: f.name, path: f.path, isDirectory: true, isGitRepo: f.isGitRepo ?? false })}
            >
              <FolderIcon className="text-blue-500" />
              <span className="text-xs font-medium truncate flex-1" style={{ color: 'var(--foreground)' }}>{f.name}</span>
              <button onClick={e => { e.stopPropagation(); unpin(f.path); }}
                className="opacity-0 group-hover:opacity-100 hover:text-rose-500 transition-all text-[10px] w-4"
                style={{ color: 'var(--text-dim)' }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-0.5 px-4 py-2" style={{ borderBottom: '1px solid color-mix(in oklch, var(--border-subtle) 60%, transparent)' }}>
        {isWindows ? null : (
          <button onClick={() => { setCur('~'); load('~'); }}
            className="text-[11px] font-medium transition-colors text-blue-500 hover:text-blue-400">~</button>
        )}
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center">
            <span className="mx-0.5 text-[11px]" style={{ color: 'var(--text-dim)' }}>{sep}</span>
            <button onClick={() => nav(i)} className="text-[11px] font-medium transition-colors text-blue-500 hover:text-blue-400 break-all">{c}</button>
          </span>
        ))}
        <label className="ml-auto flex items-center gap-1.5 cursor-pointer select-none flex-shrink-0">
          <input
            type="checkbox"
            checked={showIgnored}
            onChange={e => setShowIgnored(e.target.checked)}
            className="w-3 h-3 accent-blue-500"
          />
          <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>ignored</span>
        </label>
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto py-1.5 px-2">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-7 mb-0.5 rounded-lg" style={{ background: 'color-mix(in oklch, var(--bg-raised) 50%, transparent)' }} />
          ))
          : entries.filter(e => showIgnored || !e.isIgnored).map(e => (
            <div key={e.path}
              className="group flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors"
              style={{
                background: selectedRepo === e.path ? 'color-mix(in oklch, var(--primary) 10%, transparent)' : undefined,
                outline: selectedRepo === e.path ? '1px solid color-mix(in oklch, var(--primary) 20%, transparent)' : undefined,
                opacity: e.isIgnored ? 0.45 : 1,
              }}
              onMouseEnter={ev => { if (selectedRepo !== e.path) (ev.currentTarget as HTMLElement).style.background = 'color-mix(in oklch, var(--bg-raised) 50%, transparent)'; }}
              onMouseLeave={ev => { if (selectedRepo !== e.path) (ev.currentTarget as HTMLElement).style.background = ''; }}
              onClick={() => go(e)}
              onContextMenu={ev => openCtxMenu(ev, e)}
              title={e.path}
            >
              {e.isGitRepo ? <RepoIcon /> : e.isDirectory ? <FolderIcon className="text-[var(--text-soft)]" /> : <FileIcon name={e.name} />}
              <span className="text-xs truncate flex-1 font-medium"
                style={{ color: selectedRepo === e.path ? 'var(--primary)' : e.isDirectory ? 'var(--foreground)' : 'var(--text-dim)' }}>
                {e.name}
              </span>
              {e.isGitRepo && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-600 border border-blue-500/20 tracking-wide flex-shrink-0">
                  GIT
                </span>
              )}
              {e.isIgnored && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: 'color-mix(in oklch, var(--text-dim) 10%, transparent)', color: 'var(--text-dim)', border: '1px solid color-mix(in oklch, var(--text-dim) 20%, transparent)' }}>
                  ignored
                </span>
              )}
            </div>
          ))
        }
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <div
          ref={ctxRef}
          className="fixed z-50 py-1 rounded-xl shadow-xl min-w-[190px]"
          style={{
            left: ctxMenu.x,
            top: ctxMenu.y,
            background: 'var(--bg-panel)',
            border: '1px solid color-mix(in oklch, var(--border-subtle) 80%, transparent)',
            boxShadow: '0 8px 32px color-mix(in oklch, black 30%, transparent)',
          }}
          onClick={e => e.stopPropagation()}
        >
          <CtxItem icon={<CopyIcon />} label="Copy Path" onClick={() => copyPath(ctxMenu.entry.path)} />
          <CtxDivider />
          {ctxMenu.entry.isDirectory && (
            <>
              {isPinned(ctxMenu.entry.path)
                ? <CtxItem icon={<PinOffIcon />} label="Unpin" onClick={() => { unpin(ctxMenu.entry.path); setCtxMenu(null); }} />
                : <CtxItem icon={<PinIcon />} label="Pin" onClick={() => { pin(ctxMenu.entry); setCtxMenu(null); }} />
              }
              <CtxDivider />
              {compareLeft && compareLeft.path !== ctxMenu.entry.path ? (
                <>
                  <CtxItem
                    icon={<CompareIcon />}
                    label={`Compare with "${compareLeft.name}"`}
                    onClick={() => compareWith(ctxMenu.entry)}
                    accent="oklch(0.65 0.18 140)"
                  />
                  <CtxItem icon={<LeftIcon />} label="Set as Left folder" hint="replace current compare target" onClick={() => setAsLeft(ctxMenu.entry)} />
                  <CtxItem icon={<XIcon />} label="Clear left folder" onClick={clearLeft} />
                </>
              ) : (
                <CtxItem icon={<LeftIcon />} label="Set as Left folder" hint="then right-click another folder to compare" onClick={() => setAsLeft(ctxMenu.entry)} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CtxItem({ icon, label, hint, onClick, accent }: { icon: React.ReactNode; label: string; hint?: string; onClick: () => void; accent?: string }) {
  return (
    <button
      className="flex items-center gap-2.5 w-full px-3 py-1.5 text-xs text-left transition-colors"
      style={{ color: accent || 'var(--text-soft)' }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'color-mix(in oklch, var(--bg-raised) 60%, transparent)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
      onClick={onClick}
    >
      <span className="flex-shrink-0 opacity-70">{icon}</span>
      <span className="flex flex-col gap-0">
        <span>{label}</span>
        {hint && <span className="text-[10px] opacity-50 leading-tight">{hint}</span>}
      </span>
    </button>
  );
}

function CtxDivider() {
  return <div className="my-1 mx-2" style={{ borderTop: '1px solid color-mix(in oklch, var(--border-subtle) 60%, transparent)' }} />;
}

function FolderIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className={`flex-shrink-0 ${className}`}>
      <path d="M1 3.5A1.5 1.5 0 012.5 2h3.764c.69 0 1.35.28 1.837.78L9 3.5h4.5A1.5 1.5 0 0115 5v7.5A1.5 1.5 0 0113.5 14h-11A1.5 1.5 0 011 12.5v-9z"/>
    </svg>
  );
}

function RepoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-500 flex-shrink-0">
      <circle cx="5" cy="3.5" r="1.5"/><circle cx="5" cy="12.5" r="1.5"/>
      <circle cx="11" cy="3.5" r="1.5"/>
      <line x1="5" y1="5" x2="5" y2="11"/><path d="M5 6a3 3 0 003 3h2"/>
    </svg>
  );
}

function FileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const colors: Record<string, string> = {
    ts: 'text-blue-500', tsx: 'text-blue-500',
    js: 'text-amber-500', jsx: 'text-amber-500',
    py: 'text-emerald-500', go: 'text-cyan-500',
    rs: 'text-orange-500', css: 'text-pink-500',
    md: 'text-[var(--text-soft)]', json: 'text-yellow-500',
  };
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className={`flex-shrink-0 ${colors[ext] || 'text-[var(--text-dim)]'}`}>
      <path d="M4 0h5.5l4.5 4.5V14a2 2 0 01-2 2H4a2 2 0 01-2-2V2a2 2 0 012-2zm5 0v4.5H14L9 0z"/>
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M3 11H2a1 1 0 01-1-1V2a1 1 0 011-1h8a1 1 0 011 1v1"/>
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 1.5l5 5-3 1-3 3 1 3-6-6 3-1z"/><line x1="1" y1="15" x2="5.5" y2="10.5"/>
    </svg>
  );
}

function PinOffIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 1.5l5 5-3 1-3 3 1 3-6-6 3-1z"/><line x1="1" y1="15" x2="5.5" y2="10.5"/><line x1="1" y1="1" x2="15" y2="15"/>
    </svg>
  );
}

function LeftIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="2" width="14" height="12" rx="1.5"/><line x1="8" y1="2" x2="8" y2="14"/>
    </svg>
  );
}

function CompareIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3L1 8l4 5"/><path d="M11 3l4 5-4 5"/>
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/>
    </svg>
  );
}
