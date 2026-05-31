'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface TopBarProps {
  repo: string | null;
  onRepoSelect: (path: string) => void;
}

export default function TopBar({ repo, onRepoSelect }: TopBarProps) {
  const [branch, setBranch] = useState('');
  const [repoName, setRepoName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!repo) { setBranch(''); setRepoName(''); return; }
    setRepoName(repo.split('/').pop() || repo);
    fetch(`/api/git/branches?repo=${encodeURIComponent(repo)}`)
      .then(r => r.json())
      .then(d => {
        const cur = (d.branches || []).find((b: { current: boolean; name: string }) => b.current);
        setBranch(cur?.name || '');
      }).catch(() => {});
    try {
      const prev = JSON.parse(localStorage.getItem('git-browser-recent') || '[]') as string[];
      const next = [repo, ...prev.filter(r => r !== repo)].slice(0, 10);
      localStorage.setItem('git-browser-recent', JSON.stringify(next));
      setRecent(next);
    } catch {}
  }, [repo]);

  useEffect(() => {
    try { setRecent(JSON.parse(localStorage.getItem('git-browser-recent') || '[]')); } catch {}
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const run = async (action: 'fetch' | 'pull') => {
    if (!repo) return;
    setBusy(action);
    try {
      const res = await fetch(`/api/git/${action}?repo=${encodeURIComponent(repo)}`, { method: 'POST' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`${action === 'fetch' ? 'Fetched' : 'Pulled'}`, { description: data.result || 'Done' });
    } catch (e) {
      toast.error(`${action} failed`, { description: String(e) });
    } finally { setBusy(null); }
  };

  return (
    <header className="h-11 flex items-center gap-3 px-4 bg-zinc-900 border-b border-zinc-800/60 flex-shrink-0 select-none">
      {/* Brand */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-blue-500 flex items-center justify-center text-white text-xs font-bold">G</div>
        <span className="text-sm font-semibold text-zinc-100">GitBrowse</span>
      </div>

      <div className="w-px h-4 bg-zinc-800 mx-1" />

      {/* Repo + branch */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {repo ? (
          <>
            <span className="text-sm font-medium text-zinc-200 truncate">{repoName}</span>
            {branch && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700/50 text-xs text-zinc-400 font-medium flex-shrink-0">
                <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
                  <circle cx="3" cy="3" r="2"/><circle cx="9" cy="9" r="2"/><path d="M3 5v1a3 3 0 003 3h.5"/>
                </svg>
                {branch}
              </span>
            )}
          </>
        ) : (
          <span className="text-sm text-zinc-600">No repository selected</span>
        )}
      </div>

      {/* Recent */}
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(v => !v)}
          className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          Recent
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M5 7L1 3h8z"/></svg>
        </button>
        {open && recent.length > 0 && (
          <div className="absolute right-0 top-9 z-50 w-80 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="px-3 pt-2.5 pb-1 text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">Recent</div>
            <div className="max-h-52 overflow-y-auto pb-1.5">
              {recent.map(r => (
                <button key={r} onClick={() => { onRepoSelect(r); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors text-left"
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-600 flex-shrink-0">
                    <circle cx="3" cy="3" r="2"/><circle cx="9" cy="9" r="2"/><path d="M3 5v1a3 3 0 003 3h.5"/>
                  </svg>
                  <span className="truncate">{r}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="w-px h-4 bg-zinc-800" />

      {/* Actions */}
      <div className="flex items-center gap-1">
        {[{ id: 'fetch', label: 'Fetch' }, { id: 'pull', label: 'Pull' }].map(({ id, label }) => (
          <button key={id}
            disabled={!repo || busy !== null}
            onClick={() => run(id as 'fetch' | 'pull')}
            className="h-7 px-3 rounded-md text-xs font-medium text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {busy === id ? '…' : label}
          </button>
        ))}
        <button disabled title="Push disabled for safety"
          className="h-7 px-3 rounded-md text-xs font-medium text-zinc-700 cursor-not-allowed"
        >Push</button>
      </div>
    </header>
  );
}
