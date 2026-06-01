'use client';

import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Branch { name: string; current: boolean; remote: boolean; lastCommit?: string; lastCommitDate?: string; }

export default function BranchList({ repo, onBranchSwitch }: { repo: string; onBranchSwitch?: () => void }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!repo) return;
    setLoading(true);
    fetch(`/api/git/branches?repo=${encodeURIComponent(repo)}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setBranches(d.branches || []); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [repo]);

  const checkout = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/git/checkout?repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(confirm)}`, { method: 'POST' });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      toast.success(`Switched to ${confirm}`);
      onBranchSwitch?.();
      setBranches(prev => prev.map(b => ({ ...b, current: b.name === confirm })));
    } catch (e) { toast.error('Checkout failed', { description: String(e) }); }
    finally { setBusy(false); setConfirm(null); }
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

  const Row = (b: Branch) => (
    <div key={b.name}
      className="group mx-2 px-3 py-2 rounded-lg cursor-pointer transition-colors mb-0.5"
      style={{
        background: b.current ? 'color-mix(in oklch, oklch(0.64 0.17 150) 8%, transparent)' : undefined,
        outline: b.current ? '1px solid color-mix(in oklch, oklch(0.64 0.17 150) 15%, transparent)' : undefined,
      }}
      onMouseEnter={e => { if (!b.current) (e.currentTarget as HTMLElement).style.background = 'color-mix(in oklch, var(--bg-raised) 50%, transparent)'; }}
      onMouseLeave={e => { if (!b.current) (e.currentTarget as HTMLElement).style.background = ''; }}
      onClick={() => !b.current && !b.remote && setConfirm(b.name)}
    >
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{
          background: b.current ? 'oklch(0.74 0.17 150)' : b.remote ? 'oklch(0.78 0.14 80 / 0.4)' : 'var(--text-dim)',
        }} />
        <span className="text-xs font-medium truncate flex-1" style={{ color: b.current ? 'oklch(0.74 0.17 150)' : 'var(--foreground)' }}>{b.name}</span>
        {b.current && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full tracking-wide bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/25">HEAD</span>
        )}
      </div>
      {b.lastCommit && (
        <p className="text-[10px] truncate mt-0.5 pl-3.5" style={{ color: 'var(--text-dim)' }}>{b.lastCommit}</p>
      )}
    </div>
  );

  return (
    <>
      <div className="flex-1 overflow-y-auto py-2 min-h-0">
        {local.length > 0 && <><Label>Local</Label>{local.map(Row)}</>}
        {remote.length > 0 && <><Label className="mt-2">Remote</Label>{remote.map(Row)}</>}
      </div>

      <Dialog open={!!confirm} onOpenChange={() => setConfirm(null)}>
        <DialogContent className="shadow-2xl" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', color: 'var(--foreground)' }}>
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Switch Branch</DialogTitle>
          </DialogHeader>
          <p className="text-sm" style={{ color: 'var(--text-soft)' }}>
            Switch to <span className="font-mono text-blue-500">{confirm}</span>?
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirm(null)} className="text-xs">Cancel</Button>
            <Button onClick={checkout} disabled={busy} className="bg-blue-600 hover:bg-blue-500 text-white text-xs">
              {busy ? 'Switching…' : 'Checkout'}
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
