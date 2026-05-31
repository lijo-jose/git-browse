'use client';

import { useCallback, useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface FsEntry { name: string; path: string; isDirectory: boolean; isGitRepo: boolean; }
interface Props { onRepoSelect: (p: string) => void; selectedRepo: string | null; }

const FAV_KEY = 'git-browser-favorites';

export default function FolderPanel({ onRepoSelect, selectedRepo }: Props) {
  const [cur, setCur] = useState('~');
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [favs, setFavs] = useState<{ name: string; path: string }[]>([]);
  const [resolved, setResolved] = useState('');

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
    load(cur);
    try { const s = localStorage.getItem(FAV_KEY); if (s) setFavs(JSON.parse(s)); } catch {}
  }, []);

  const go = (e: FsEntry) => {
    if (e.isGitRepo) onRepoSelect(e.path);
    if (e.isDirectory) { setCur(e.path); load(e.path); }
  };

  const crumbs = resolved.split('/').filter(Boolean);
  const nav = (i: number) => { const p = '/' + crumbs.slice(0, i + 1).join('/'); setCur(p); load(p); };

  const pin = (e: FsEntry) => {
    const next = [...favs.filter(f => f.path !== e.path), { name: e.name, path: e.path }];
    setFavs(next); localStorage.setItem(FAV_KEY, JSON.stringify(next));
  };
  const unpin = (path: string) => {
    const next = favs.filter(f => f.path !== path);
    setFavs(next); localStorage.setItem(FAV_KEY, JSON.stringify(next));
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Pinned */}
      {favs.length > 0 && (
        <div className="border-b border-zinc-800/60 py-1.5">
          <p className="px-4 mb-1 text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">Pinned</p>
          {favs.map(f => (
            <div key={f.path} className="group flex items-center gap-2 mx-2 px-2 py-1 rounded-lg cursor-pointer hover:bg-zinc-800/50 transition-colors"
              onClick={() => { setCur(f.path); load(f.path); }}>
              <FolderIcon className="text-blue-400" />
              <span className="text-xs text-zinc-300 font-medium truncate flex-1">{f.name}</span>
              <button onClick={e => { e.stopPropagation(); unpin(f.path); }}
                className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-rose-400 transition-all text-[10px] w-4">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-0.5 px-4 py-2 border-b border-zinc-800/60 overflow-x-auto">
        <button onClick={() => { setCur('~'); load('~'); }}
          className="text-[11px] text-blue-400 hover:text-blue-300 font-medium shrink-0 transition-colors">~</button>
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center shrink-0">
            <span className="text-zinc-700 mx-0.5 text-[11px]">/</span>
            <button onClick={() => nav(i)} className="text-[11px] text-blue-400 hover:text-blue-300 font-medium max-w-[60px] truncate transition-colors">{c}</button>
          </span>
        ))}
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto py-1.5 px-2">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-7 mb-0.5 rounded-lg bg-zinc-800/50" />)
          : entries.map(e => (
            <div key={e.path}
              className={`group flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                selectedRepo === e.path ? 'bg-blue-500/10 ring-1 ring-blue-500/20' : 'hover:bg-zinc-800/50'
              }`}
              onClick={() => go(e)}
              onContextMenu={ev => { ev.preventDefault(); if (e.isDirectory) pin(e); }}
              title={e.isDirectory ? 'Right-click to pin' : e.name}
            >
              {e.isGitRepo ? <RepoIcon /> : e.isDirectory ? <FolderIcon className="text-zinc-400" /> : <FileIcon name={e.name} />}
              <span className={`text-xs truncate flex-1 font-medium ${
                e.isDirectory ? 'text-zinc-300' : 'text-zinc-500'
              } ${selectedRepo === e.path ? '!text-blue-300' : ''}`}>
                {e.name}
              </span>
              {e.isGitRepo && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20 tracking-wide flex-shrink-0">
                  GIT
                </span>
              )}
            </div>
          ))
        }
      </div>
    </div>
  );
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
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-400 flex-shrink-0">
      <circle cx="5" cy="3.5" r="1.5"/><circle cx="5" cy="12.5" r="1.5"/>
      <circle cx="11" cy="3.5" r="1.5"/>
      <line x1="5" y1="5" x2="5" y2="11"/><path d="M5 6a3 3 0 003 3h2"/>
    </svg>
  );
}

function FileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const colors: Record<string, string> = {
    ts: 'text-blue-400', tsx: 'text-blue-400',
    js: 'text-amber-400', jsx: 'text-amber-400',
    py: 'text-emerald-400', go: 'text-cyan-400',
    rs: 'text-orange-400', css: 'text-pink-400',
    md: 'text-zinc-400', json: 'text-yellow-400',
  };
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className={`flex-shrink-0 ${colors[ext] || 'text-zinc-600'}`}>
      <path d="M4 0h5.5l4.5 4.5V14a2 2 0 01-2 2H4a2 2 0 01-2-2V2a2 2 0 012-2zm5 0v4.5H14L9 0z"/>
    </svg>
  );
}
