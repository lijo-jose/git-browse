'use client';

import { useEffect, useState, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface FsEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isGitRepo: boolean;
}

interface FolderPanelProps {
  onRepoSelect: (path: string) => void;
  selectedRepo: string | null;
}

const FAVORITES_KEY = 'git-browser-favorites';

export default function FolderPanel({ onRepoSelect, selectedRepo }: FolderPanelProps) {
  const [currentPath, setCurrentPath] = useState('~');
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [favorites, setFavorites] = useState<{ name: string; path: string }[]>([]);
  const [resolvedPath, setResolvedPath] = useState('');

  const loadDir = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/fs?path=${encodeURIComponent(p)}`);
      const data = await res.json();
      setEntries(data.entries || []);
      setResolvedPath(data.path || p);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDir(currentPath);
    try {
      const saved = localStorage.getItem(FAVORITES_KEY);
      if (saved) setFavorites(JSON.parse(saved));
    } catch {}
  }, []);

  const navigate = (entry: FsEntry) => {
    if (entry.isGitRepo) onRepoSelect(entry.path);
    if (entry.isDirectory) { setCurrentPath(entry.path); loadDir(entry.path); }
  };

  const breadcrumbs = resolvedPath.split('/').filter(Boolean);

  const navigateToBreadcrumb = (idx: number) => {
    const p = '/' + breadcrumbs.slice(0, idx + 1).join('/');
    setCurrentPath(p);
    loadDir(p);
  };

  const addFavorite = (entry: FsEntry) => {
    const updated = [...favorites.filter((f) => f.path !== entry.path), { name: entry.name, path: entry.path }];
    setFavorites(updated);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
  };

  const removeFavorite = (path: string) => {
    const updated = favorites.filter((f) => f.path !== path);
    setFavorites(updated);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
  };

  return (
    <div className="flex flex-col h-full bg-[#1a1a1a]">
      {/* Favorites */}
      {favorites.length > 0 && (
        <div className="border-b border-[#2e2e2e] pb-1 pt-2">
          <SectionLabel>Favorites</SectionLabel>
          {favorites.map((fav) => (
            <div
              key={fav.path}
              className="group flex items-center gap-2 mx-1.5 px-2 py-1 rounded-md cursor-pointer hover:bg-[#262626] transition-colors"
              onClick={() => { setCurrentPath(fav.path); loadDir(fav.path); }}
            >
              <span className="text-[#4d9de0] text-xs">📁</span>
              <span className="text-xs text-[#a0a0a0] truncate flex-1 font-medium">{fav.name}</span>
              <button
                className="opacity-0 group-hover:opacity-100 text-[#505050] hover:text-[#c96b6b] text-[10px] w-4 text-center transition-opacity"
                onClick={(e) => { e.stopPropagation(); removeFavorite(fav.path); }}
              >✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-0.5 px-3 py-1.5 flex-wrap min-h-[28px] border-b border-[#2e2e2e]">
        <button
          className="text-[11px] text-[#4d9de0] hover:text-[#7cb9e8] font-medium transition-colors"
          onClick={() => { setCurrentPath('~'); loadDir('~'); }}
        >~</button>
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center">
            <span className="text-[#383838] text-[11px] mx-0.5">/</span>
            <button
              className="text-[11px] text-[#4d9de0] hover:text-[#7cb9e8] truncate max-w-[70px] font-medium transition-colors"
              onClick={() => navigateToBreadcrumb(i)}
            >{crumb}</button>
          </span>
        ))}
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-7 mx-2 mb-0.5 bg-[#222] rounded-md" />
            ))
          : entries.map((entry) => (
              <div
                key={entry.path}
                className={`group flex items-center gap-2 mx-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                  selectedRepo === entry.path
                    ? 'bg-[#4d9de0]/10 text-[#dcdcdc]'
                    : 'hover:bg-[#262626]'
                }`}
                onClick={() => navigate(entry)}
                onContextMenu={(e) => { e.preventDefault(); if (entry.isDirectory) addFavorite(entry); }}
                title={entry.isDirectory ? 'Right-click to pin to favorites' : entry.name}
              >
                <span className="text-sm flex-shrink-0 leading-none">{getIcon(entry)}</span>
                <span className={`text-[12px] truncate flex-1 leading-tight ${entry.isDirectory ? 'text-[#c8c8c8] font-medium' : 'text-[#888]'}`}>
                  {entry.name}
                </span>
                {entry.isGitRepo && (
                  <span className="text-[9px] bg-[#4d9de0]/15 text-[#4d9de0] border border-[#4d9de0]/20 px-1.5 py-0.5 rounded font-semibold tracking-wide flex-shrink-0">
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-0.5 text-[10px] font-semibold tracking-widest text-[#505050] uppercase">{children}</div>
  );
}

function getIcon(entry: FsEntry): string {
  if (entry.isGitRepo) return '🗂️';
  if (entry.isDirectory) return '📁';
  const ext = entry.name.split('.').pop()?.toLowerCase();
  const icons: Record<string, string> = {
    ts: '🟦', tsx: '🟦', js: '🟨', jsx: '🟨', json: '📋',
    md: '📝', css: '🎨', html: '🌐', py: '🐍', go: '🐹',
    rs: '🦀', sh: '⚙️', yml: '⚙️', yaml: '⚙️', png: '🖼️',
    jpg: '🖼️', svg: '🖼️', lock: '🔒', env: '🔑',
  };
  return icons[ext || ''] || '📄';
}
