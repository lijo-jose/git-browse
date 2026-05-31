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
  const [loading, setLoading] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!repo) { setBranch(''); setRepoName(''); return; }
    setRepoName(repo.split('/').pop() || repo);
    fetch(`/api/git/branches?repo=${encodeURIComponent(repo)}`)
      .then((r) => r.json())
      .then((d) => {
        const cur = (d.branches || []).find((b: { current: boolean }) => b.current) as { name: string } | undefined;
        setBranch(cur?.name || '');
      })
      .catch(() => {});
    try {
      const saved = JSON.parse(localStorage.getItem('git-browser-recent') || '[]') as string[];
      const updated = [repo, ...saved.filter((r) => r !== repo)].slice(0, 10);
      localStorage.setItem('git-browser-recent', JSON.stringify(updated));
      setRecent(updated);
    } catch {}
  }, [repo]);

  useEffect(() => {
    try { setRecent(JSON.parse(localStorage.getItem('git-browser-recent') || '[]')); } catch {}
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowRecent(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const gitAction = async (action: 'fetch' | 'pull') => {
    if (!repo) { toast.error('No repo selected'); return; }
    setLoading(action);
    try {
      const res = await fetch(`/api/git/${action}?repo=${encodeURIComponent(repo)}`, { method: 'POST' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`${action === 'fetch' ? 'Fetch' : 'Pull'} complete`, { description: data.result || undefined });
    } catch (e) {
      toast.error(`${action} failed`, { description: String(e) });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 h-11 bg-[#1e1e1e] border-b border-[#2e2e2e] flex-shrink-0 select-none">
      {/* App identity */}
      <div className="flex items-center gap-2 mr-2">
        <span className="text-[#4d9de0] text-base leading-none">⎇</span>
        <span className="text-sm font-semibold text-[#dcdcdc] tracking-tight">GitBrowse</span>
      </div>

      <div className="h-4 w-px bg-[#2e2e2e]" />

      {/* Repo info */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {repo ? (
          <>
            <span className="text-sm font-medium text-[#dcdcdc] truncate">{repoName}</span>
            <span className="text-[#383838] text-xs truncate hidden lg:block">{repo}</span>
            {branch && (
              <span className="flex items-center gap-1.5 bg-[#262626] border border-[#363636] px-2 py-0.5 rounded-md text-[11px] text-[#4d9de0] font-medium flex-shrink-0">
                <span className="text-[10px]">⎇</span> {branch}
              </span>
            )}
          </>
        ) : (
          <span className="text-xs text-[#505050]">No repository selected</span>
        )}
      </div>

      {/* Recent repos dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          className="flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-medium text-[#858585] hover:text-[#dcdcdc] hover:bg-[#262626] transition-colors"
          onClick={() => setShowRecent((v) => !v)}
        >
          Recent
          <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor" className="opacity-50">
            <path d="M5 7L1 3h8L5 7z"/>
          </svg>
        </button>
        {showRecent && recent.length > 0 && (
          <div className="absolute right-0 top-9 z-50 bg-[#1e1e1e] border border-[#2e2e2e] rounded-lg shadow-2xl w-80 overflow-hidden">
            <div className="px-3 pt-2 pb-1 text-[10px] font-semibold tracking-widest text-[#505050] uppercase">Recent Repositories</div>
            <div className="max-h-56 overflow-y-auto pb-1">
              {recent.map((r) => (
                <button
                  key={r}
                  className="w-full text-left px-3 py-1.5 text-xs text-[#b0b0b0] hover:bg-[#262626] hover:text-[#dcdcdc] truncate flex items-center gap-2 transition-colors"
                  onClick={() => { onRepoSelect(r); setShowRecent(false); }}
                >
                  <span className="text-[#4d9de0] text-[10px] flex-shrink-0">⎇</span>
                  <span className="truncate">{r}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="h-4 w-px bg-[#2e2e2e]" />

      {/* Action buttons */}
      <div className="flex gap-1">
        {[
          { id: 'fetch', label: 'Fetch', icon: '↓' },
          { id: 'pull',  label: 'Pull',  icon: '⇩' },
        ].map(({ id, label, icon }) => (
          <button
            key={id}
            disabled={!repo || loading !== null}
            onClick={() => gitAction(id as 'fetch' | 'pull')}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium text-[#858585] hover:text-[#dcdcdc] hover:bg-[#262626] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <span className="text-[13px] leading-none">{loading === id ? '…' : icon}</span>
            {label}
          </button>
        ))}
        <button
          disabled
          title="Push disabled for safety"
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium text-[#404040] cursor-not-allowed"
        >
          <span className="text-[13px] leading-none">⇧</span> Push
        </button>
      </div>
    </div>
  );
}
