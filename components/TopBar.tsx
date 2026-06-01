'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import ThemeToggle from './ThemeToggle';

interface TopBarProps {
  repo: string | null;
  onRepoSelect: (path: string) => void;
  onOpenGuide: () => void;
}

export default function TopBar({ repo, onRepoSelect, onOpenGuide }: TopBarProps) {
  const [branch, setBranch] = useState('');
  const [repoName, setRepoName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [tagMode, setTagMode] = useState(false);
  const [tagName, setTagName] = useState('');
  const [tagOpen, setTagOpen] = useState(false);
  const [tags, setTags] = useState<{ name: string; date: string; subject: string }[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

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
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
      if (tagRef.current && !tagRef.current.contains(e.target as Node)) setTagOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const loadTags = () => {
    if (!repo) return;
    fetch(`/api/git/tag?repo=${encodeURIComponent(repo)}`)
      .then(r => r.json())
      .then(d => setTags(d.tags || []))
      .catch(() => {});
  };

  const openTagMode = () => {
    setTagOpen(false);
    setTagMode(true);
    setTagName('');
    setTimeout(() => tagInputRef.current?.focus(), 0);
  };

  const toggleTagOpen = () => {
    if (!tagOpen) loadTags();
    setTagOpen(v => !v);
  };

  const submitTag = async () => {
    const t = tagName.trim();
    if (!t || !repo) return;
    setTagMode(false);
    setTagName('');
    setBusy('tag');
    try {
      const res = await fetch('/api/git/tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo, tag: t }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success('Tag pushed', { description: data.result || 'Done' });
    } catch (e) {
      toast.error('Tag failed', { description: String(e) });
    } finally { setBusy(null); }
  };

  const run = async (action: 'fetch' | 'pull' | 'push') => {
    if (!repo) return;
    setBusy(action);
    try {
      if (action === 'push') {
        const res = await fetch('/api/git/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repo, setUpstream: false, branch: '' }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        toast.success('Pushed', { description: data.result || 'Done' });
      } else {
        const res = await fetch(`/api/git/${action}?repo=${encodeURIComponent(repo)}`, { method: 'POST' });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        toast.success(`${action === 'fetch' ? 'Fetched' : 'Pulled'}`, { description: data.result || 'Done' });
      }
    } catch (e) {
      toast.error(`${action} failed`, { description: String(e) });
    } finally { setBusy(null); }
  };

  return (
    <header className="h-11 flex items-center gap-3 px-4 bg-[var(--bg-panel)] border-b border-[var(--border-subtle)]/60 flex-shrink-0 select-none">
      {/* Brand */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-blue-500 flex items-center justify-center text-white text-xs font-bold">G</div>
        <span className="text-sm font-semibold text-foreground">GitBrowse</span>
      </div>

      <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" />

      {/* Repo + branch */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {repo ? (
          <>
            <span className="text-sm font-medium text-foreground truncate">{repoName}</span>
            {branch && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--bg-raised)] border border-[var(--border-subtle)]/50 text-xs text-[var(--text-soft)] font-medium flex-shrink-0">
                <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                  <circle cx="3" cy="3" r="2"/><circle cx="9" cy="9" r="2"/><path d="M3 5v1a3 3 0 003 3h.5"/>
                </svg>
                {branch}
              </span>
            )}
          </>
        ) : (
          <span className="text-sm text-[var(--text-dim)]">No repository selected</span>
        )}
      </div>

      {/* Recent */}
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(v => !v)}
          className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium text-[var(--text-dim)] hover:text-foreground hover:bg-[var(--bg-raised)] transition-colors"
        >
          Recent
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M5 7L1 3h8z"/></svg>
        </button>
        {open && recent.length > 0 && (
          <div className="absolute right-0 top-9 z-50 w-80 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-xl shadow-2xl overflow-hidden">
            <div className="px-3 pt-2.5 pb-1 text-[10px] font-semibold tracking-widest text-[var(--text-dim)] uppercase">Recent</div>
            <div className="max-h-52 overflow-y-auto pb-1.5">
              {recent.map(r => (
                <button key={r} onClick={() => { onRepoSelect(r); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-soft)] hover:text-foreground hover:bg-[var(--bg-raised)] transition-colors text-left"
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--text-dim)] flex-shrink-0">
                    <circle cx="3" cy="3" r="2"/><circle cx="9" cy="9" r="2"/><path d="M3 5v1a3 3 0 003 3h.5"/>
                  </svg>
                  <span className="truncate">{r}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <ThemeToggle />

      <button
        onClick={onOpenGuide}
        title="User Guide"
        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[var(--text-dim)] hover:text-foreground hover:bg-[var(--bg-raised)] transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="7"/>
          <path d="M8 7v4M8 5v.5"/>
        </svg>
      </button>

      <div className="w-px h-4 bg-[var(--border-subtle)]" />

      {/* Actions */}
      <div className="flex items-center gap-1">
        {[{ id: 'fetch', label: 'Fetch' }, { id: 'pull', label: 'Pull' }, { id: 'push', label: 'Push' }].map(({ id, label }) => (
          <button key={id}
            disabled={!repo || busy !== null}
            onClick={() => run(id as 'fetch' | 'pull' | 'push')}
            className="h-7 px-3 rounded-md text-xs font-medium text-[var(--text-dim)] hover:text-foreground hover:bg-[var(--bg-raised)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {busy === id ? '…' : label}
          </button>
        ))}
        {tagMode ? (
          <form onSubmit={e => { e.preventDefault(); submitTag(); }} className="flex items-center gap-1">
            <input
              ref={tagInputRef}
              value={tagName}
              onChange={e => setTagName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { setTagMode(false); setTagName(''); } }}
              placeholder="v1.0.0"
              className="h-7 w-24 px-2 rounded-md text-xs bg-[var(--bg-raised)] border border-[var(--border-subtle)] text-foreground placeholder:text-[var(--text-dim)] focus:outline-none focus:border-primary"
            />
            <button type="submit" disabled={!tagName.trim()}
              className="h-7 px-2 rounded-md text-xs font-medium text-primary hover:bg-[var(--bg-raised)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Push
            </button>
            <button type="button" onClick={() => { setTagMode(false); setTagName(''); }}
              className="h-7 px-2 rounded-md text-xs text-[var(--text-dim)] hover:text-foreground hover:bg-[var(--bg-raised)] transition-colors"
            >
              ✕
            </button>
          </form>
        ) : (
          <div className="relative" ref={tagRef}>
            <div className="flex items-center">
              <button
                disabled={!repo || busy !== null}
                onClick={openTagMode}
                className="h-7 px-3 rounded-l-md text-xs font-medium text-[var(--text-dim)] hover:text-foreground hover:bg-[var(--bg-raised)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                {busy === 'tag' ? '…' : 'Tag'}
              </button>
              <button
                disabled={!repo || busy !== null}
                onClick={toggleTagOpen}
                className="h-7 px-1 rounded-r-md text-xs text-[var(--text-dim)] hover:text-foreground hover:bg-[var(--bg-raised)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-l border-[var(--border-subtle)]/40"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M5 7L1 3h8z"/></svg>
              </button>
            </div>
            {tagOpen && (
              <div className="absolute right-0 top-9 z-50 w-64 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-xl shadow-2xl overflow-hidden">
                <div className="px-3 pt-2.5 pb-1 text-[10px] font-semibold tracking-widest text-[var(--text-dim)] uppercase">Tags</div>
                {tags.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-[var(--text-dim)]">No tags found</div>
                ) : (
                  <div className="max-h-52 overflow-y-auto pb-1.5">
                    {tags.map(t => (
                      <div key={t.name} className="flex flex-col px-3 py-1.5 hover:bg-[var(--bg-raised)] transition-colors">
                        <span className="text-xs font-medium text-foreground">{t.name}</span>
                        {t.date && <span className="text-[10px] text-[var(--text-dim)]">{t.date}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
