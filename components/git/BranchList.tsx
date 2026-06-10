'use client';

import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import InteractiveRebaseDialog from './InteractiveRebaseDialog';

interface Branch { name: string; current: boolean; remote: boolean; lastCommit?: string; lastCommitDate?: string; }
type Action = { type: 'checkout' | 'merge' | 'rebase' | 'delete'; branch: string };

export default function BranchList({ repo, onBranchSwitch, onCompare }: { repo: string; onBranchSwitch?: () => void; onCompare?: (branch: string) => void }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [newBranchOpen, setNewBranchOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [creating, setCreating] = useState(false);
  const [rebaseOpen, setRebaseOpen] = useState(false);
  const [rebaseBranch, setRebaseBranch] = useState('');
  const [rebasing, setRebasing] = useState(false);
  const [interactiveOpen, setInteractiveOpen] = useState(false);
  const [interactiveBase, setInteractiveBase] = useState<string | undefined>(undefined);
  const [contextMenu, setContextMenu] = useState<{ branch: Branch; x: number; y: number } | null>(null);

  const load = () => {
    if (!repo) return;
    setLoading(true);
    fetch(`/api/git/branches?repo=${encodeURIComponent(repo)}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setBranches(d.branches || []); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [repo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const doAction = async () => {
    if (!action) return;
    setBusy(true);
    try {
      if (action.type === 'checkout') {
        const res = await fetch(`/api/git/checkout?repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(action.branch)}`, { method: 'POST' });
        const d = await res.json();
        if (d.error) throw new Error(d.error);
        toast.success(`Switched to ${action.branch}`);
        onBranchSwitch?.();
        setBranches(prev => prev.map(b => ({ ...b, current: b.name === action.branch })));
      } else if (action.type === 'merge') {
        const res = await fetch('/api/git/merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repo, branch: action.branch }),
        });
        const d = await res.json();
        if (d.error) throw new Error(d.error);
        toast.success(`Merged ${action.branch}`, { description: d.result });
        onBranchSwitch?.();
      } else if (action.type === 'rebase') {
        const res = await fetch('/api/git/rebase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repo, branch: action.branch }),
        });
        const d = await res.json();
        if (d.error) throw new Error(d.error);
        toast.success(d.result);
        onBranchSwitch?.();
      } else if (action.type === 'delete') {
        const res = await fetch('/api/git/branch', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repo, name: action.branch }),
        });
        const d = await res.json();
        if (d.error) throw new Error(d.error);
        toast.success(`Deleted branch ${action.branch}`);
        load();
      }
    } catch (e) { toast.error(`${action.type} failed`, { description: String(e) }); }
    finally { setBusy(false); setAction(null); }
  };

  const doCreate = async () => {
    if (!newBranchName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/git/branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo, name: newBranchName.trim() }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      toast.success(`Created and switched to ${newBranchName.trim()}`);
      setNewBranchOpen(false);
      setNewBranchName('');
      onBranchSwitch?.();
      load();
    } catch (e) { toast.error('Create branch failed', { description: String(e) }); }
    finally { setCreating(false); }
  };

  const doRebase = async () => {
    if (!rebaseBranch.trim()) return;
    setRebasing(true);
    try {
      const res = await fetch('/api/git/rebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo, branch: rebaseBranch.trim() }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      toast.success(d.result || `Rebased onto ${rebaseBranch.trim()}`);
      setRebaseOpen(false);
      setRebaseBranch('');
      onBranchSwitch?.();
    } catch (e) { toast.error('Rebase failed', { description: String(e) }); }
    finally { setRebasing(false); }
  };

  if (loading) return (
    <div className="p-3 space-y-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-10 rounded-lg" style={{ background: 'color-mix(in oklch, var(--bg-raised) 60%, transparent)' }} />
      ))}
    </div>
  );
  if (error) return <p className="p-4 text-rose-500 text-xs">{error}</p>;

  const local = branches.filter(b => !b.remote);
  const remote = branches.filter(b => b.remote);
  const currentBranch = branches.find(b => b.current)?.name;

  const Row = (b: Branch) => (
    <div key={b.name}
      className="group mx-2 px-3 py-2 rounded-lg cursor-pointer transition-colors mb-0.5 relative"
      style={{
        background: b.current ? 'color-mix(in oklch, oklch(0.64 0.17 150) 8%, transparent)' : undefined,
        outline: b.current ? '1px solid color-mix(in oklch, oklch(0.64 0.17 150) 15%, transparent)' : undefined,
      }}
      onMouseEnter={e => { if (!b.current) (e.currentTarget as HTMLElement).style.background = 'color-mix(in oklch, var(--bg-raised) 50%, transparent)'; }}
      onMouseLeave={e => { if (!b.current) (e.currentTarget as HTMLElement).style.background = ''; }}
      onClick={() => !b.current && !b.remote && setAction({ type: 'checkout', branch: b.name })}
      onContextMenu={e => { e.preventDefault(); setContextMenu({ branch: b, x: e.clientX, y: e.clientY }); }}
    >
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{
          background: b.current ? 'oklch(0.74 0.17 150)' : b.remote ? 'oklch(0.78 0.14 80 / 0.4)' : 'var(--text-dim)',
        }} />
        <span className="text-xs font-medium truncate flex-1" style={{ color: b.current ? 'oklch(0.74 0.17 150)' : 'var(--foreground)' }}>{b.name}</span>
        {b.current && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full tracking-wide bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/25">HEAD</span>
        )}
        {onCompare && !b.current && (
          <button
            onClick={e => { e.stopPropagation(); onCompare(b.name); }}
            title={`Compare HEAD ↔ ${b.name}`}
            className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold"
            style={{ background: 'color-mix(in oklch, var(--primary) 15%, transparent)', color: 'var(--primary)' }}
          >
            <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 6h8M4 10h8M8 2v12"/>
            </svg>
            diff
          </button>
        )}
      </div>
      {(b.lastCommit || b.lastCommitDate) && (
        <div className="flex items-center gap-2 mt-0.5 pl-3.5">
          {b.lastCommit && <p className="text-[10px] truncate flex-1" style={{ color: 'var(--text-dim)' }}>{b.lastCommit}</p>}
          {b.lastCommitDate && <p className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-dim)', opacity: 0.7 }}>{b.lastCommitDate}</p>}
        </div>
      )}
    </div>
  );

  const actionLabels: Record<string, string> = {
    checkout: 'Switch to',
    merge: 'Merge',
    rebase: 'Rebase onto',
    delete: 'Delete',
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto py-2 min-h-0">
        {local.length > 0 && <><Label>Local</Label>{local.map(Row)}</>}
        {remote.length > 0 && <><Label className="mt-2">Remote</Label>{remote.map(Row)}</>}
      </div>

      {/* New branch / Rebase buttons */}
      <div className="flex-shrink-0 px-3 py-2 flex gap-1.5" style={{ borderTop: '1px solid color-mix(in oklch, var(--border-subtle) 60%, transparent)' }}>
        <button
          onClick={() => setNewBranchOpen(true)}
          className="flex-1 h-7 px-3 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
          style={{ background: 'var(--bg-raised)', color: 'var(--foreground)' }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
            <line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/>
          </svg>
          New branch
        </button>
        <button
          onClick={() => setRebaseOpen(true)}
          className="flex-1 h-7 px-3 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
          style={{ background: 'var(--bg-raised)', color: 'var(--foreground)' }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
            <polyline points="2,9 6,3 10,9"/><line x1="6" y1="3" x2="6" y2="11"/>
          </svg>
          Rebase onto…
        </button>
        <button
          onClick={() => { setInteractiveBase(undefined); setInteractiveOpen(true); }}
          title="Interactive rebase (reorder, squash, reword, drop commits)"
          className="flex-1 h-7 px-3 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
          style={{ background: 'var(--bg-raised)', color: 'var(--foreground)' }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <line x1="2" y1="3" x2="10" y2="3"/><line x1="2" y1="6" x2="10" y2="6"/><line x1="2" y1="9" x2="10" y2="9"/>
          </svg>
          Interactive…
        </button>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 rounded-lg shadow-xl overflow-hidden"
          style={{
            left: contextMenu.x, top: contextMenu.y,
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-subtle)',
            minWidth: 160,
          }}
          onClick={e => e.stopPropagation()}
        >
          {!contextMenu.branch.current && !contextMenu.branch.remote && (
            <MenuItem onClick={() => { setAction({ type: 'checkout', branch: contextMenu.branch.name }); setContextMenu(null); }}>
              Checkout
            </MenuItem>
          )}
          {!contextMenu.branch.current && (
            <MenuItem onClick={() => { setAction({ type: 'merge', branch: contextMenu.branch.name }); setContextMenu(null); }}>
              Merge into {currentBranch}
            </MenuItem>
          )}
          {!contextMenu.branch.current && !contextMenu.branch.remote && (
            <MenuItem onClick={() => { setAction({ type: 'rebase', branch: contextMenu.branch.name }); setContextMenu(null); }}>
              Rebase onto {contextMenu.branch.name}
            </MenuItem>
          )}
          {!contextMenu.branch.current && (
            <MenuItem onClick={() => { setInteractiveBase(contextMenu.branch.name); setInteractiveOpen(true); setContextMenu(null); }}>
              Interactive rebase onto {contextMenu.branch.name}
            </MenuItem>
          )}
          {!contextMenu.branch.current && !contextMenu.branch.remote && (
            <MenuItem danger onClick={() => { setAction({ type: 'delete', branch: contextMenu.branch.name }); setContextMenu(null); }}>
              Delete branch
            </MenuItem>
          )}
        </div>
      )}

      {/* Action confirm dialog */}
      <Dialog open={!!action} onOpenChange={() => setAction(null)}>
        <DialogContent className="shadow-2xl" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', color: 'var(--foreground)' }}>
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold capitalize">{action ? actionLabels[action.type] : ''} Branch</DialogTitle>
          </DialogHeader>
          {action && (
            <p className="text-sm" style={{ color: 'var(--text-soft)' }}>
              {action.type === 'checkout' && <>Switch to <span className="font-mono text-blue-500">{action.branch}</span>?</>}
              {action.type === 'merge' && <>Merge <span className="font-mono text-blue-500">{action.branch}</span> into <span className="font-mono text-emerald-500">{currentBranch}</span>?</>}
              {action.type === 'rebase' && <>Rebase <span className="font-mono text-emerald-500">{currentBranch}</span> onto <span className="font-mono text-blue-500">{action.branch}</span>?</>}
              {action.type === 'delete' && <>Delete branch <span className="font-mono text-rose-500">{action.branch}</span>? This cannot be undone.</>}
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAction(null)} className="text-xs">Cancel</Button>
            <Button
              onClick={doAction}
              disabled={busy}
              className={`text-xs ${action?.type === 'delete' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-blue-600 hover:bg-blue-500'} text-white`}
            >
              {busy ? '…' : action ? actionLabels[action.type] : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rebase dialog */}
      <Dialog open={rebaseOpen} onOpenChange={open => { setRebaseOpen(open); if (!open) setRebaseBranch(''); }}>
        <DialogContent className="sm:max-w-sm shadow-2xl" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', color: 'var(--foreground)' }}>
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Rebase onto Branch</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-1">
            <label className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--text-dim)' }}>Target branch</label>
            <input
              autoFocus
              type="text"
              value={rebaseBranch}
              onChange={e => setRebaseBranch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') doRebase(); }}
              placeholder="main"
              className="w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/60"
              style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', color: 'var(--foreground)' }}
            />
            <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>Rebase <span className="font-mono">{currentBranch}</span> onto the typed branch</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRebaseOpen(false)} className="text-xs">Cancel</Button>
            <Button onClick={doRebase} disabled={!rebaseBranch.trim() || rebasing} className="text-xs bg-blue-600 hover:bg-blue-500 text-white">
              {rebasing ? 'Rebasing…' : 'Rebase'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Interactive rebase dialog */}
      <InteractiveRebaseDialog
        repo={repo}
        open={interactiveOpen}
        onOpenChange={setInteractiveOpen}
        branches={branches.map(b => b.name)}
        currentBranch={currentBranch}
        initialBase={interactiveBase}
        onDone={() => { onBranchSwitch?.(); load(); }}
      />

      {/* New branch dialog */}
      <Dialog open={newBranchOpen} onOpenChange={setNewBranchOpen}>
        <DialogContent className="sm:max-w-sm shadow-2xl" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', color: 'var(--foreground)' }}>
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">New Branch</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-1">
            <label className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--text-dim)' }}>Branch name</label>
            <input
              autoFocus
              type="text"
              value={newBranchName}
              onChange={e => setNewBranchName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') doCreate(); }}
              placeholder="feature/my-branch"
              className="w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/60"
              style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', color: 'var(--foreground)' }}
            />
            <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>Branches off <span className="font-mono">{currentBranch}</span></p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewBranchOpen(false)} className="text-xs">Cancel</Button>
            <Button onClick={doCreate} disabled={!newBranchName.trim() || creating} className="text-xs bg-blue-600 hover:bg-blue-500 text-white">
              {creating ? 'Creating…' : 'Create & checkout'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Label({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`px-4 py-1 text-[10px] font-semibold tracking-widest uppercase ${className}`} style={{ color: 'var(--text-dim)' }}>
      {children}
    </p>
  );
}

function MenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2 text-xs transition-colors"
      style={{ color: danger ? 'oklch(0.65 0.2 25)' : 'var(--foreground)' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'color-mix(in oklch, var(--bg-raised) 70%, transparent)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}
    >
      {children}
    </button>
  );
}
