'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface FileCtxMenu { x: number; y: number; fullPath: string; }
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface GitFile { path: string; status: string; staged: boolean; }
interface Props { repo: string; onFileSelect: (f: string, s: boolean) => void; selectedFile?: string; }

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  M: { bg: 'bg-amber-500/15',   fg: 'text-amber-600'   },
  A: { bg: 'bg-emerald-500/15', fg: 'text-emerald-600' },
  D: { bg: 'bg-rose-500/15',    fg: 'text-rose-600'    },
  '?':{ bg: 'bg-muted',         fg: 'text-muted-foreground' },
  R: { bg: 'bg-blue-500/15',    fg: 'text-blue-600'    },
  U: { bg: 'bg-orange-500/15',  fg: 'text-orange-600'  },
};

export default function FileList({ repo, onFileSelect, selectedFile }: Props) {
  const [files, setFiles] = useState<GitFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [staging, setStaging] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [discardConfirm, setDiscardConfirm] = useState<'selected' | 'all' | null>(null);
  const [commitOpen, setCommitOpen] = useState(false);
  const [pushOpen, setPushOpen] = useState(false);
  const [commitMsg, setCommitMsg] = useState('');
  const [commitAll, setCommitAll] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushSetUpstream, setPushSetUpstream] = useState(false);
  const [pushBranchName, setPushBranchName] = useState('');
  const msgRef = useRef<HTMLTextAreaElement>(null);

  const load = () => {
    if (!repo) return;
    setLoading(true); setError('');
    fetch(`/api/git/status?repo=${encodeURIComponent(repo)}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setFiles(d.files || []); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [repo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!repo) return;
    fetch(`/api/git/branches?repo=${encodeURIComponent(repo)}`)
      .then(r => r.json())
      .then(d => {
        const cur = (d.branches || []).find((b: { current: boolean; name: string }) => b.current);
        if (cur) setPushBranchName(cur.name);
      }).catch(() => {});
  }, [repo]);

  const toggleSelect = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const stageSelected = async () => {
    const filePaths = [...selected];
    if (!filePaths.length) return;
    setStaging(true);
    try {
      const res = await fetch('/api/git/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo, files: filePaths }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success('Staged', { description: `${filePaths.length} file(s) staged` });
      setSelected(new Set());
      load();
    } catch (e) {
      toast.error('Stage failed', { description: String(e) });
    } finally { setStaging(false); }
  };

  const doCommit = async () => {
    if (!commitMsg.trim()) { msgRef.current?.focus(); return; }
    setCommitting(true);
    try {
      const res = await fetch('/api/git/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo, message: commitMsg, all: commitAll }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success('Committed', { description: data.result });
      setCommitOpen(false);
      setCommitMsg('');
      setCommitAll(false);
      load();
    } catch (e) {
      toast.error('Commit failed', { description: String(e) });
    } finally { setCommitting(false); }
  };

  const doDiscard = async (all: boolean) => {
    setDiscarding(true);
    try {
      const unstagedFiles = files.filter(f => !f.staged);
      const filesToDiscard = all
        ? unstagedFiles.map(f => f.path)
        : [...selected].filter(p => unstagedFiles.some(f => f.path === p));
      const body = all ? { repo, all: true } : { repo, files: filesToDiscard };
      const res = await fetch('/api/git/checkout-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(all ? 'Discarded all changes' : `Discarded ${filesToDiscard.length} file(s)`);
      setSelected(new Set());
      setDiscardConfirm(null);
      load();
    } catch (e) {
      toast.error('Discard failed', { description: String(e) });
    } finally { setDiscarding(false); }
  };

  const doPush = async () => {
    setPushing(true);
    try {
      const res = await fetch('/api/git/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo, setUpstream: pushSetUpstream, branch: pushBranchName }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success('Pushed', { description: data.result });
      setPushOpen(false);
      setPushSetUpstream(false);
    } catch (e) {
      toast.error('Push failed', { description: String(e) });
    } finally { setPushing(false); }
  };

  if (loading) return (
    <div className="p-3 space-y-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-8 rounded-lg" style={{ background: 'color-mix(in oklch, var(--bg-raised) 60%, transparent)' }} />
      ))}
    </div>
  );
  if (error) return <p className="p-4 text-rose-500 text-xs">{error}</p>;

  const staged = files.filter(f => f.staged);
  const unstaged = files.filter(f => !f.staged);
  const hasFiles = files.length > 0;
  const allKeys = files.map(f => f.path);
  const allSelected = allKeys.length > 0 && allKeys.every(k => selected.has(k));
  const someSelected = allKeys.some(k => selected.has(k)) && !allSelected;

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allKeys));
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto py-2 min-h-0">
        {!hasFiles && <Empty label="Working tree clean" />}
        {staged.length > 0 && (
          <Section label="Staged" files={staged} repo={repo} selected={selected} selectedFile={selectedFile}
            onFileSelect={onFileSelect} onToggle={toggleSelect}
            onToggleAll={keys => {
              const allIn = keys.every(k => selected.has(k));
              setSelected(prev => { const next = new Set(prev); if (allIn) keys.forEach(k => next.delete(k)); else keys.forEach(k => next.add(k)); return next; });
            }}
          />
        )}
        {unstaged.length > 0 && (
          <Section label="Unstaged" files={unstaged} repo={repo} selected={selected} selectedFile={selectedFile}
            onFileSelect={onFileSelect} onToggle={toggleSelect}
            onToggleAll={keys => {
              const allIn = keys.every(k => selected.has(k));
              setSelected(prev => { const next = new Set(prev); if (allIn) keys.forEach(k => next.delete(k)); else keys.forEach(k => next.add(k)); return next; });
            }}
          />
        )}
      </div>

      {hasFiles && (
        <div className="flex-shrink-0 px-3 py-2 flex items-center gap-2" style={{ borderTop: '1px solid color-mix(in oklch, var(--border-subtle) 60%, transparent)' }}>
          <label className="flex items-center gap-1.5 cursor-pointer mr-1" title="Select / deselect all">
            <input
              type="checkbox"
              checked={allSelected}
              ref={el => { if (el) el.indeterminate = someSelected; }}
              onChange={toggleAll}
              className="w-3 h-3 accent-blue-500 cursor-pointer"
            />
            <span className="text-[10px] font-medium select-none" style={{ color: 'var(--text-dim)' }}>All</span>
          </label>
          <button
            disabled={selected.size === 0 || staging}
            onClick={stageSelected}
            className="h-7 px-3 rounded-md text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ background: 'var(--bg-raised)', color: 'var(--foreground)' }}
          >
            {staging ? '…' : `Stage${selected.size > 0 ? ` (${selected.size})` : ''}`}
          </button>
          <button
            onClick={() => setCommitOpen(true)}
            className="h-7 px-3 rounded-md text-xs font-medium transition-colors"
            style={{ background: 'var(--bg-raised)', color: 'var(--foreground)' }}
          >
            Commit…
          </button>
          <div className="flex-1" />
          {unstaged.length > 0 && (
            <button
              onClick={() => setDiscardConfirm(selected.size > 0 ? 'selected' : 'all')}
              disabled={discarding}
              className="h-7 px-3 rounded-md text-xs font-medium transition-colors disabled:opacity-30"
              style={{ background: 'color-mix(in oklch, oklch(0.55 0.2 25) 12%, transparent)', color: 'oklch(0.65 0.18 25)' }}
              title={selected.size > 0 ? 'Discard selected unstaged changes' : 'Discard all unstaged changes'}
            >
              {selected.size > 0 ? `Discard (${selected.size})` : 'Discard all'}
            </button>
          )}
          <button
            onClick={() => setPushOpen(true)}
            className="h-7 px-3 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors"
          >
            Push…
          </button>
        </div>
      )}

      {/* Commit modal */}
      <Dialog open={commitOpen} onOpenChange={setCommitOpen}>
        <DialogContent className="sm:max-w-md" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--foreground)' }}>Commit changes</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-1">
            <textarea
              ref={msgRef}
              value={commitMsg}
              onChange={e => setCommitMsg(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) doCommit(); }}
              placeholder="Commit message…"
              rows={4}
              className="w-full rounded-lg px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/60"
              style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', color: 'var(--foreground)' }}
            />
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={commitAll} onChange={e => setCommitAll(e.target.checked)} className="w-3.5 h-3.5 accent-blue-500" />
              <span className="text-xs" style={{ color: 'var(--text-soft)' }}>
                <code style={{ color: 'var(--foreground)' }}>-a</code> — stage all tracked modified files
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommitOpen(false)} className="text-xs h-8">Cancel</Button>
            <Button onClick={doCommit} disabled={!commitMsg.trim() || committing} className="text-xs h-8 bg-blue-600 hover:bg-blue-500 text-white">
              {committing ? 'Committing…' : 'Commit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Push modal */}
      <Dialog open={pushOpen} onOpenChange={setPushOpen}>
        <DialogContent className="sm:max-w-sm" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--foreground)' }}>Push</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={pushSetUpstream} onChange={e => setPushSetUpstream(e.target.checked)} className="w-3.5 h-3.5 accent-blue-500" />
              <span className="text-xs" style={{ color: 'var(--text-soft)' }}>
                Create branch in origin (<code style={{ color: 'var(--foreground)' }}>--set-upstream</code>)
              </span>
            </label>
            {pushSetUpstream && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--text-dim)' }}>Branch name</label>
                <input
                  type="text"
                  value={pushBranchName}
                  onChange={e => setPushBranchName(e.target.value)}
                  className="w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/60"
                  style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', color: 'var(--foreground)' }}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPushOpen(false)} className="text-xs h-8">Cancel</Button>
            <Button onClick={doPush} disabled={pushing || (pushSetUpstream && !pushBranchName.trim())} className="text-xs h-8 bg-blue-600 hover:bg-blue-500 text-white">
              {pushing ? 'Pushing…' : pushSetUpstream ? 'Push & set upstream' : 'Push'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discard confirm modal */}
      <Dialog open={!!discardConfirm} onOpenChange={() => setDiscardConfirm(null)}>
        <DialogContent className="sm:max-w-sm" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--foreground)' }}>Discard changes</DialogTitle>
          </DialogHeader>
          <p className="text-sm" style={{ color: 'var(--text-soft)' }}>
            {discardConfirm === 'all'
              ? 'Discard all unstaged changes? This cannot be undone.'
              : `Discard changes in ${selected.size} selected file(s)? This cannot be undone.`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardConfirm(null)} className="text-xs h-8">Cancel</Button>
            <Button
              onClick={() => doDiscard(discardConfirm === 'all')}
              disabled={discarding}
              className="text-xs h-8 bg-rose-600 hover:bg-rose-500 text-white"
            >
              {discarding ? 'Discarding…' : 'Discard'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ label, files, repo, selected, selectedFile, onFileSelect, onToggle, onToggleAll }: {
  label: string;
  files: GitFile[];
  repo: string;
  selected: Set<string>;
  selectedFile?: string;
  onFileSelect: (f: string, s: boolean) => void;
  onToggle: (key: string) => void;
  onToggleAll: (keys: string[]) => void;
}) {
  const [ctxMenu, setCtxMenu] = useState<FileCtxMenu | null>(null);

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

  const keys = files.map(f => f.path);
  const allIn = keys.length > 0 && keys.every(k => selected.has(k));
  const someIn = keys.some(k => selected.has(k)) && !allIn;
  return (
    <div className="mb-1">
      <div className="flex items-center gap-2 px-4 py-1">
        <input
          type="checkbox"
          checked={allIn}
          ref={el => { if (el) el.indeterminate = someIn; }}
          onChange={() => onToggleAll(keys)}
          className="w-3 h-3 accent-blue-500 cursor-pointer"
        />
        <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--text-dim)' }}>{label}</p>
      </div>
      {files.map(f => {
        const s = STATUS_COLORS[f.status] || STATUS_COLORS['M'];
        const isSelected = selectedFile === f.path;
        const key = f.path;
        const checked = selected.has(key);
        const fullPath = `${repo}/${f.path}`;
        return (
          <div key={`${f.path}-${f.staged}`}
            className="flex items-center gap-2 mx-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors"
            style={{
              background: isSelected ? 'color-mix(in oklch, var(--primary) 10%, transparent)' : undefined,
              outline: isSelected ? '1px solid color-mix(in oklch, var(--primary) 20%, transparent)' : undefined,
            }}
            onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'color-mix(in oklch, var(--bg-raised) 50%, transparent)'; }}
            onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = ''; }}
            onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY, fullPath }); }}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(key)}
              onClick={e => e.stopPropagation()}
              className="w-3 h-3 accent-blue-500 flex-shrink-0 cursor-pointer"
            />
            <span className={`text-[10px] font-bold w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ring-1 ring-inset ${s.bg} ${s.fg}`}>
              {f.status[0] ?? 'M'}
            </span>
            <span
              className="text-xs truncate font-medium flex-1 min-w-0"
              style={{ color: isSelected ? 'var(--foreground)' : 'var(--text-soft)' }}
              onClick={() => onFileSelect(f.path, f.staged)}
            >
              {f.path.split('/').pop()}
            </span>
            <span
              className="text-[10px] truncate hidden sm:block min-w-0"
              style={{ color: isSelected ? 'var(--text-soft)' : 'var(--text-dim)' }}
              onClick={() => onFileSelect(f.path, f.staged)}
            >
              {f.path.includes('/') ? f.path.split('/').slice(0, -1).join('/') : ''}
            </span>
          </div>
        );
      })}

      {ctxMenu && (
        <div
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
          <FileCtxItem
            icon={<CopyIcon />}
            label="Copy Path"
            onClick={() => {
              navigator.clipboard.writeText(ctxMenu.fullPath).then(
                () => toast.success('Copied', { description: ctxMenu.fullPath }),
                () => toast.error('Copy failed'),
              );
              setCtxMenu(null);
            }}
          />
          <FileCtxItem
            icon={<VSCodeIcon />}
            label="Open in VS Code"
            onClick={() => { window.location.href = `vscode://file${ctxMenu.fullPath}?windowId=_blank`; setCtxMenu(null); }}
          />
        </div>
      )}
    </div>
  );
}

function FileCtxItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      className="flex items-center gap-2.5 w-full px-3 py-1.5 text-xs text-left transition-colors"
      style={{ color: 'var(--text-soft)' }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'color-mix(in oklch, var(--bg-raised) 60%, transparent)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
      onClick={onClick}
    >
      <span className="flex-shrink-0 opacity-70">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M3 11H2a1 1 0 01-1-1V2a1 1 0 011-1h8a1 1 0 011 1v1"/>
    </svg>
  );
}

function VSCodeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M11.5 1.5l-7 5.5-3-2.5L0 5.5v5l1.5 1 3-2.5 7 5.5 3-1.5V3L11.5 1.5zM13 11.5L7 7.5v-1l6-4v9z"/>
    </svg>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-xs font-medium" style={{ color: 'var(--text-dim)' }}>{label}</p>
    </div>
  );
}
