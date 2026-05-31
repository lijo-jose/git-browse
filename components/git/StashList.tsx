'use client';

import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface Stash { index: number; message: string; date?: string; }

export default function StashList({ repo }: { repo: string }) {
  const [stashes, setStashes] = useState<Stash[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [acting, setActing] = useState<number | null>(null);

  const load = () => {
    if (!repo) return;
    setLoading(true);
    fetch(`/api/git/stash?repo=${encodeURIComponent(repo)}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setStashes(d.stashes || []); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [repo]);

  const act = async (index: number, action: 'apply' | 'drop') => {
    setActing(index);
    try {
      const res = await fetch(`/api/git/stash/apply?repo=${encodeURIComponent(repo)}&index=${index}&action=${action}`, { method: 'POST' });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      toast.success(`Stash ${action === 'apply' ? 'applied' : 'dropped'}`);
      load();
    } catch (e) { toast.error(String(e)); }
    finally { setActing(null); }
  };

  if (loading) return (
    <div className="p-3 space-y-1">
      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg bg-zinc-800/50" />)}
    </div>
  );
  if (error) return <p className="p-4 text-rose-400 text-xs">{error}</p>;
  if (!stashes.length) return (
    <div className="flex items-center justify-center h-full">
      <p className="text-xs text-zinc-700 font-medium">No stashes</p>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-0">
      {stashes.map(s => (
        <div key={s.index} className="flex items-start justify-between gap-3 px-3 py-2.5 rounded-xl bg-zinc-900 ring-1 ring-zinc-800 hover:ring-zinc-700 transition-colors">
          <div className="min-w-0">
            <p className="text-xs text-zinc-300 font-medium truncate">{s.message}</p>
            {s.date && <p className="text-[10px] text-zinc-600 mt-0.5">{s.date}</p>}
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button disabled={acting !== null} onClick={() => act(s.index, 'apply')}
              className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300 disabled:opacity-40 px-2 py-1 rounded-lg hover:bg-emerald-500/10 transition-colors">
              Apply
            </button>
            <button disabled={acting !== null} onClick={() => act(s.index, 'drop')}
              className="text-[11px] font-medium text-rose-400 hover:text-rose-300 disabled:opacity-40 px-2 py-1 rounded-lg hover:bg-rose-500/10 transition-colors">
              Drop
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
