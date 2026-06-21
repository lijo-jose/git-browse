'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import DirPicker from './ui/DirPicker';
import { COMMAND_EVENT } from './CommandPalette';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { useDangerZone, type DangerOp } from '@/lib/dangerZone';

const PUSH_OP: DangerOp = { title: 'Push', description: 'Pushes commits to the remote repository. Cannot be undone without a force-push.' };
const PULL_OP: DangerOp = { title: 'Pull', description: 'Merges remote changes into your local branch. May create merge commits or conflicts.' };

interface TopBarProps {
  repo: string | null;
  onRepoSelect: (path: string) => void;
  onCloned?: (repoPath: string) => void;
  onOpenGuide: () => void;
}

export default function TopBar({ repo, onRepoSelect, onCloned, onOpenGuide }: TopBarProps) {
  const { unlocked, lock, unlock, guard } = useDangerZone();
  const [branch, setBranch] = useState('');
  const [repoName, setRepoName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneRemote, setCloneRemote] = useState('');
  const [cloneDir, setCloneDir] = useState('~');
  const [cloneName, setCloneName] = useState('');
  const [dirPickerOpen, setDirPickerOpen] = useState(false);
  const cloneRemoteRef = useRef<HTMLInputElement>(null);
  const [branchPickPath, setBranchPickPath] = useState<string | null>(null);
  const [branchPickList, setBranchPickList] = useState<string[]>([]);
  const [branchFilter, setBranchFilter] = useState('');
  const [branchBusy, setBranchBusy] = useState(false);
  const [cloneProgress, setCloneProgress] = useState<string | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);
  const [upstreamPrompt, setUpstreamPrompt] = useState(false);
  const [sync, setSync] = useState<{ ahead: number; behind: number; tracking: string | null } | null>(null);
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);

  const loadSyncStatus = (path: string | null) => {
    if (!path) { setSync(null); return; }
    fetch(`/api/git/sync-status?repo=${encodeURIComponent(path)}`)
      .then(r => r.json())
      .then(d => setSync(d.error ? null : d))
      .catch(() => setSync(null));
  };
  const ref = useRef<HTMLDivElement>(null);
  const syncRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!repo) { setBranch(''); setRepoName(''); setSync(null); setRemoteUrl(null); return; }
    setRepoName(repo.split('/').pop() || repo);
    loadSyncStatus(repo);
    fetch(`/api/git/info?repo=${encodeURIComponent(repo)}`)
      .then(r => r.json())
      .then(d => {
        const origin = (d.remotes || []).find((r: { name: string; fetchUrl: string }) => r.name === 'origin');
        if (!origin) { setRemoteUrl(null); return; }
        let url: string = origin.fetchUrl;
        // convert SSH git@github.com:user/repo.git → https://github.com/user/repo
        url = url.replace(/^git@([^:]+):(.+?)(?:\.git)?$/, 'https://$1/$2');
        url = url.replace(/\.git$/, '');
        setRemoteUrl(url);
      })
      .catch(() => setRemoteUrl(null));
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
      if (syncRef.current && !syncRef.current.contains(e.target as Node)) setSyncOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const openClone = () => {
    setOpen(false);
    setCloneOpen(true);
    setCloneRemote('');
    setCloneName('');
    setTimeout(() => cloneRemoteRef.current?.focus(), 0);
  };

  const submitClone = async () => {
    const remote = cloneRemote.trim();
    const dir = cloneDir.trim();
    if (!remote || !dir) return;
    setCloneOpen(false);
    setBusy('clone');
    setCloneProgress(remote);
    try {
      const res = await fetch('/api/git/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remote, directory: dir, name: cloneName.trim() || undefined }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCloneProgress(null);
      toast.success('Cloned successfully', { description: data.path });
      onCloned?.(data.path);
      onRepoSelect(data.path);
      // fetch branches for step-2 picker
      const br = await fetch(`/api/git/branches?repo=${encodeURIComponent(data.path)}`).then(r => r.json()).catch(() => ({}));
      const names: string[] = (br.branches || []).map((b: { name: string }) => b.name);
      setBranchPickPath(data.path);
      setBranchPickList(names);
      setBranchFilter('');
    } catch (e) {
      setCloneProgress(null);
      toast.error('Clone failed', { description: String(e) });
    } finally { setBusy(null); }
  };

  const checkoutAfterClone = async (branchName: string) => {
    if (!branchPickPath) return;
    setBranchBusy(true);
    try {
      const res = await fetch(`/api/git/checkout?repo=${encodeURIComponent(branchPickPath)}&branch=${encodeURIComponent(branchName)}`, { method: 'POST' });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      toast.success(`Checked out ${branchName}`);
    } catch (e) {
      toast.error('Checkout failed', { description: String(e) });
    } finally {
      setBranchBusy(false);
      setBranchPickPath(null);
    }
  };

  // Keep ahead/behind fresh: refocus + light polling catch commits made in-app or outside
  useEffect(() => {
    if (!repo) return;
    const onFocus = () => loadSyncStatus(repo);
    window.addEventListener('focus', onFocus);
    const t = setInterval(onFocus, 60_000);
    return () => { window.removeEventListener('focus', onFocus); clearInterval(t); };
  }, [repo]);

  // Commands from the global palette (⌘K)
  useEffect(() => {
    const fn = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (id === 'sync:pull') run('pull');
      else if (id === 'sync:fetch') run('fetch');
      else if (id === 'sync:push') run('push');
      else if (id === 'clone') openClone();
    };
    window.addEventListener(COMMAND_EVENT, fn);
    return () => window.removeEventListener(COMMAND_EVENT, fn);
  }); // re-bound each render so run/openClone see fresh state

  const run = (action: 'fetch' | 'pull' | 'push') => {
    if (!repo) return;
    if (action === 'fetch') { executeRun('fetch'); return; }
    guard(action === 'push' ? PUSH_OP : PULL_OP, () => executeRun(action));
  };

  const executeRun = async (action: 'fetch' | 'pull' | 'push') => {
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
        if (data.error) {
          const noUpstream = /no upstream|set.upstream|has no upstream/i.test(data.error);
          if (noUpstream && branch) {
            setBusy(null);
            setUpstreamPrompt(true);
            return;
          }
          throw new Error(data.error);
        }
        toast.success('Pushed', { description: data.result || 'Done' });
      } else {
        const res = await fetch(`/api/git/${action}?repo=${encodeURIComponent(repo)}`, { method: 'POST' });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        toast.success(`${action === 'fetch' ? 'Fetched' : 'Pulled'}`, { description: data.result || 'Done' });
      }
    } catch (e) {
      toast.error(`${action} failed`, { description: String(e) });
    } finally { setBusy(null); loadSyncStatus(repo); }
  };

  const pushWithUpstream = () => {
    setUpstreamPrompt(false);
    guard(PUSH_OP, executePushWithUpstream);
  };

  const executePushWithUpstream = async () => {
    if (!repo) return;
    setBusy('push');
    try {
      const res = await fetch('/api/git/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo, setUpstream: true, branch }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success('Pushed', { description: data.result || 'Done' });
    } catch (e) {
      toast.error('push failed', { description: String(e) });
    } finally { setBusy(null); loadSyncStatus(repo); }
  };

  return (
    <>
    <header className="h-11 flex items-center gap-3 px-4 bg-[var(--bg-panel)] border-b border-[var(--border-subtle)]/60 flex-shrink-0 select-none">
      {/* Logo */}
      <div className="flex items-center gap-2 flex-shrink-0 mr-1">
        <span className="text-sm font-medium text-foreground whitespace-nowrap">git <span className="text-[#f97316]">browse</span></span>
        <span className="w-px h-4 bg-[var(--border-subtle)] mx-1" />
      </div>
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
            {remoteUrl && (
              <a
                href={remoteUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={remoteUrl}
                className="inline-flex items-center justify-center w-5 h-5 rounded text-[var(--text-dim)] hover:text-foreground transition-colors flex-shrink-0"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                </svg>
              </a>
            )}
          </>
        ) : (
          <span className="text-sm text-[var(--text-dim)]">No repository selected</span>
        )}
      </div>

      {/* Open repo: recent + clone */}
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(v => !v)}
          className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium text-[var(--text-dim)] hover:text-foreground hover:bg-[var(--bg-raised)] transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="flex-shrink-0">
            <path d="M1 3.5A1.5 1.5 0 012.5 2h3.764c.69 0 1.35.28 1.837.78L9 3.5h4.5A1.5 1.5 0 0115 5v.5H1V3.5zM1 7v5.5A1.5 1.5 0 002.5 14h11a1.5 1.5 0 001.5-1.5V7H1z"/>
          </svg>
          Open
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M5 7L1 3h8z"/></svg>
        </button>
        {open && (
          <div className="absolute right-0 top-9 z-50 w-80 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-xl shadow-2xl overflow-hidden">
            {recent.length > 0 && (
              <>
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
                <div className="h-px bg-[var(--border-subtle)]/60" />
              </>
            )}
            <button onClick={openClone}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[var(--text-soft)] hover:text-foreground hover:bg-[var(--bg-raised)] transition-colors text-left"
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-[var(--text-dim)] flex-shrink-0">
                <path d="M8 2v8M4.5 6.5L8 10l3.5-3.5M2 13h12"/>
              </svg>
              Clone repository…
            </button>
          </div>
        )}
      </div>

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
        {cloneOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setCloneOpen(false)}>
            <div className="bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl w-[400px] p-5" onClick={e => e.stopPropagation()}>
              <h2 className="text-sm font-semibold text-foreground mb-4">Clone Repository</h2>
              <form onSubmit={e => { e.preventDefault(); submitClone(); }} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-[var(--text-dim)] uppercase tracking-wide">Remote URL *</label>
                  <input
                    ref={cloneRemoteRef}
                    value={cloneRemote}
                    onChange={e => setCloneRemote(e.target.value)}
                    placeholder="https://github.com/user/repo.git"
                    className="h-8 px-3 rounded-lg text-xs bg-[var(--bg-raised)] border border-[var(--border-subtle)] text-foreground placeholder:text-[var(--text-dim)] focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-[var(--text-dim)] uppercase tracking-wide">Directory *</label>
                  <div className="relative">
                    <div className="flex gap-1">
                      <input
                        value={cloneDir}
                        onChange={e => setCloneDir(e.target.value)}
                        placeholder="~/projects"
                        className="flex-1 h-8 px-3 rounded-lg text-xs bg-[var(--bg-raised)] border border-[var(--border-subtle)] text-foreground placeholder:text-[var(--text-dim)] focus:outline-none focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={() => setDirPickerOpen(v => !v)}
                        className="h-8 px-3 rounded-lg text-xs font-medium bg-[var(--bg-raised)] border border-[var(--border-subtle)] text-[var(--text-soft)] hover:text-foreground hover:border-primary transition-colors flex items-center gap-1.5"
                      >
                        <FolderOpenIcon />
                        Browse
                      </button>
                    </div>
                    {dirPickerOpen && (
                      <DirPicker
                        value={cloneDir}
                        onChange={p => setCloneDir(p)}
                        onClose={() => setDirPickerOpen(false)}
                      />
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-[var(--text-dim)] uppercase tracking-wide">Name <span className="normal-case tracking-normal opacity-60">(optional)</span></label>
                  <input
                    value={cloneName}
                    onChange={e => setCloneName(e.target.value)}
                    placeholder="my-project"
                    className="h-8 px-3 rounded-lg text-xs bg-[var(--bg-raised)] border border-[var(--border-subtle)] text-foreground placeholder:text-[var(--text-dim)] focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setCloneOpen(false)}
                    className="h-7 px-3 rounded-md text-xs text-[var(--text-dim)] hover:text-foreground hover:bg-[var(--bg-raised)] transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={!cloneRemote.trim() || !cloneDir.trim()}
                    className="h-7 px-4 rounded-md text-xs font-medium bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity">
                    Clone
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {branchPickPath && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setBranchPickPath(null)}>
            <div className="bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl w-[380px] flex flex-col overflow-hidden" style={{ maxHeight: 480 }} onClick={e => e.stopPropagation()}>
              <div className="px-5 pt-5 pb-3 flex-shrink-0">
                <h2 className="text-sm font-semibold text-foreground">Checkout Branch</h2>
                <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>Select a branch to checkout, or skip to stay on the default.</p>
                <input
                  autoFocus
                  value={branchFilter}
                  onChange={e => setBranchFilter(e.target.value)}
                  placeholder="Filter branches…"
                  className="mt-3 w-full h-8 px-3 rounded-lg text-xs bg-[var(--bg-raised)] border border-[var(--border-subtle)] text-foreground placeholder:text-[var(--text-dim)] focus:outline-none focus:border-primary"
                />
              </div>
              <div className="flex-1 overflow-y-auto px-3 pb-2 min-h-0">
                {branchPickList
                  .filter(b => !branchFilter || b.toLowerCase().includes(branchFilter.toLowerCase()))
                  .map(b => (
                    <button key={b}
                      disabled={branchBusy}
                      onClick={() => checkoutAfterClone(b)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-left transition-colors disabled:opacity-40"
                      style={{ color: 'var(--foreground)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'color-mix(in oklch, var(--bg-raised) 60%, transparent)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}
                    >
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0" style={{ color: 'var(--text-dim)' }}>
                        <circle cx="3" cy="3" r="2"/><circle cx="9" cy="9" r="2"/><path d="M3 5v1a3 3 0 003 3h.5"/>
                      </svg>
                      <span className="truncate font-medium">{b}</span>
                    </button>
                  ))}
                {branchPickList.filter(b => !branchFilter || b.toLowerCase().includes(branchFilter.toLowerCase())).length === 0 && (
                  <p className="px-3 py-3 text-xs" style={{ color: 'var(--text-dim)' }}>No branches match</p>
                )}
              </div>
              <div className="flex-shrink-0 px-5 py-3 flex justify-end" style={{ borderTop: '1px solid color-mix(in oklch, var(--border-subtle) 60%, transparent)' }}>
                <button onClick={() => setBranchPickPath(null)}
                  className="h-7 px-4 rounded-md text-xs font-medium text-[var(--text-dim)] hover:text-foreground hover:bg-[var(--bg-raised)] transition-colors">
                  Skip
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Danger zone toggle */}
        <button
          onClick={() => unlocked ? lock() : unlock()}
          title={unlocked ? 'Danger zone unlocked — click to lock remote operations' : 'Danger zone locked — remote operations require confirmation'}
          className="inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors"
          style={{ color: unlocked ? 'oklch(0.72 0.16 70)' : 'var(--text-dim)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'color-mix(in oklch, var(--bg-raised) 80%, transparent)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}
        >
          {unlocked ? (
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="7" width="10" height="8" rx="1.5"/>
              <path d="M5 7V4.5a3 3 0 015.83-1"/>
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="7" width="10" height="8" rx="1.5"/>
              <path d="M5 7V5a3 3 0 016 0v2"/>
            </svg>
          )}
        </button>

        {/* Sync split button: Pull is primary, Fetch/Push under the caret */}
        <div className="relative" ref={syncRef}>
          <div className="flex items-center rounded-md border transition-colors" style={{ borderColor: !unlocked ? 'color-mix(in oklch, oklch(0.72 0.16 70) 35%, var(--border-subtle))' : 'color-mix(in oklch, var(--border-subtle) 60%, transparent)' }}>
            <button
              disabled={!repo || busy !== null}
              onClick={() => run('pull')}
              title="git pull"
              className="h-7 px-3 rounded-l-md text-xs font-medium text-[var(--text-soft)] hover:text-foreground hover:bg-[var(--bg-raised)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2v9M4.5 7.5L8 11l3.5-3.5M2 14h12"/>
              </svg>
              {busy === 'pull' ? 'Pulling…' : busy === 'fetch' ? 'Fetching…' : busy === 'push' ? 'Pushing…' : 'Pull'}
              {!busy && sync && (sync.behind > 0 || sync.ahead > 0) && (
                <span className="flex items-center gap-1 text-[10px] font-semibold" title={`${sync.behind} behind · ${sync.ahead} ahead of ${sync.tracking ?? 'upstream'}`}>
                  {sync.behind > 0 && <span style={{ color: 'var(--primary)' }}>↓{sync.behind}</span>}
                  {sync.ahead > 0 && <span style={{ color: 'oklch(0.74 0.15 80)' }}>↑{sync.ahead}</span>}
                </span>
              )}
            </button>
            <button
              disabled={!repo || busy !== null}
              onClick={() => setSyncOpen(v => !v)}
              title="More sync actions"
              className="h-7 px-1 rounded-r-md text-xs text-[var(--text-dim)] hover:text-foreground hover:bg-[var(--bg-raised)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-l border-[var(--border-subtle)]/40"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M5 7L1 3h8z"/></svg>
            </button>
          </div>
          {syncOpen && (
            <div className="absolute right-0 top-9 z-50 w-44 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-xl shadow-2xl overflow-hidden py-1">
              {([
                ['fetch', 'Fetch', 'git fetch'],
                ['pull', 'Pull', 'git pull'],
                ['push', 'Push', 'git push'],
              ] as const).map(([id, label, hint]) => (
                <button key={id}
                  onClick={() => { setSyncOpen(false); run(id); }}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-[var(--text-soft)] hover:text-foreground hover:bg-[var(--bg-raised)] transition-colors text-left"
                >
                  <span className="font-medium">{label}</span>
                  <span className="text-[10px] font-mono text-[var(--text-dim)]">{hint}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>

    {/* No-upstream push confirm */}
    <Dialog open={upstreamPrompt} onOpenChange={setUpstreamPrompt}>
      <DialogContent className="sm:max-w-sm shadow-2xl" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', color: 'var(--foreground)' }}>
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Set Upstream Branch</DialogTitle>
        </DialogHeader>
        <p className="text-sm" style={{ color: 'var(--text-soft)' }}>
          Branch <span className="font-mono text-blue-500">{branch}</span> has no upstream.
        </p>
        <p className="text-xs font-mono px-3 py-2 rounded-lg" style={{ background: 'var(--bg-raised)', color: 'var(--text-dim)' }}>
          git push --set-upstream origin {branch}
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setUpstreamPrompt(false)} className="text-xs">Cancel</Button>
          <Button onClick={pushWithUpstream} className="text-xs bg-blue-600 hover:bg-blue-500 text-white">Push & set upstream</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {cloneProgress && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl px-8 py-7 flex flex-col items-center gap-4 w-[360px]">
          <div className="relative w-10 h-10">
            <svg className="animate-spin w-10 h-10" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="3" className="opacity-10" />
              <path d="M20 4 A16 16 0 0 1 36 20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-primary" />
            </svg>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
              className="absolute inset-0 m-auto text-primary">
              <circle cx="5" cy="3.5" r="1.5"/><circle cx="5" cy="12.5" r="1.5"/>
              <circle cx="11" cy="3.5" r="1.5"/>
              <line x1="5" y1="5" x2="5" y2="11"/><path d="M5 6a3 3 0 003 3h2"/>
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">Cloning repository…</p>
            <p className="text-xs mt-1 break-all" style={{ color: 'var(--text-dim)' }}>{cloneProgress}</p>
          </div>
          <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>This may take a moment for large repositories.</p>
        </div>
      </div>
    )}
    </>
  );
}

function FolderOpenIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="flex-shrink-0">
      <path d="M1 3.5A1.5 1.5 0 012.5 2h3.764c.69 0 1.35.28 1.837.78L9 3.5h4.5A1.5 1.5 0 0115 5v.5H1V3.5zM1 7v5.5A1.5 1.5 0 002.5 14h11a1.5 1.5 0 001.5-1.5V7H1z"/>
    </svg>
  );
}
