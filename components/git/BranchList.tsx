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
  const [confirmBranch, setConfirmBranch] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (!repo) return;
    setLoading(true);
    fetch(`/api/git/branches?repo=${encodeURIComponent(repo)}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setBranches(d.branches || []); })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [repo]);

  const doCheckout = async () => {
    if (!confirmBranch) return;
    setSwitching(true);
    try {
      const res = await fetch(
        `/api/git/checkout?repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(confirmBranch)}`,
        { method: 'POST' }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`Switched to ${confirmBranch}`);
      onBranchSwitch?.();
      setBranches((prev) => prev.map((b) => ({ ...b, current: b.name === confirmBranch })));
    } catch (e) {
      toast.error(`Checkout failed`, { description: String(e) });
    } finally { setSwitching(false); setConfirmBranch(null); }
  };

  if (loading) return (
    <div className="p-2 space-y-1">
      {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 rounded-md bg-[#222]" />)}
    </div>
  );
  if (error) return <div className="p-4 text-[#c96b6b] text-xs">{error}</div>;

  const local = branches.filter((b) => !b.remote);
  const remote = branches.filter((b) => b.remote);

  const renderBranch = (b: Branch) => (
    <div
      key={b.name}
      className={`group mx-1.5 px-2 py-2 rounded-md cursor-pointer transition-colors mb-px ${
        b.current ? 'bg-[#4d9de0]/10' : 'hover:bg-[#262626]'
      }`}
      onClick={() => !b.current && !b.remote && setConfirmBranch(b.name)}
    >
      <div className="flex items-center gap-2">
        <span className={`text-[11px] flex-shrink-0 ${b.current ? 'text-[#5ab99b]' : 'text-[#505050]'}`}>
          {b.current ? '●' : b.remote ? '↗' : '⎇'}
        </span>
        <span className={`text-[12px] truncate flex-1 font-medium leading-tight ${b.current ? 'text-[#dcdcdc]' : 'text-[#a0a0a0]'}`}>
          {b.name}
        </span>
        {b.current && (
          <span className="text-[9px] bg-[#5ab99b]/15 text-[#5ab99b] border border-[#5ab99b]/20 px-1.5 py-0.5 rounded font-semibold tracking-wide">
            HEAD
          </span>
        )}
      </div>
      {b.lastCommit && (
        <div className="flex items-center gap-2 mt-0.5 pl-5">
          <span className="text-[10px] text-[#505050] truncate">{b.lastCommit}</span>
          {b.lastCommitDate && <span className="text-[10px] text-[#383838] flex-shrink-0">{b.lastCommitDate}</span>}
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="flex-1 overflow-y-auto py-1">
        <SectionLabel>Local</SectionLabel>
        {local.map(renderBranch)}
        {remote.length > 0 && (
          <><SectionLabel className="mt-2">Remote</SectionLabel>{remote.map(renderBranch)}</>
        )}
      </div>

      <Dialog open={!!confirmBranch} onOpenChange={() => setConfirmBranch(null)}>
        <DialogContent className="bg-[#1e1e1e] border-[#2e2e2e] text-[#dcdcdc] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#dcdcdc] text-sm font-semibold">Switch Branch</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#909090]">
            Switch to <span className="text-[#4d9de0] font-mono font-medium">{confirmBranch}</span>?
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmBranch(null)} className="text-[#909090] hover:text-[#dcdcdc] text-xs">
              Cancel
            </Button>
            <Button onClick={doCheckout} disabled={switching} className="bg-[#4d9de0] text-white hover:bg-[#3d8dd0] text-xs">
              {switching ? 'Switching…' : 'Checkout'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SectionLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`px-3 py-1 text-[10px] font-semibold tracking-widest text-[#505050] uppercase ${className}`}>{children}</div>
  );
}
