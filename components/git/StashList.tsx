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

  useEffect(() => { load(); }, [repo]); // eslint-disable-line react-hooks/exhaustive-deps

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
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-14 rounded-lg" style={{ background: 'color-mix(in oklch, var(--bg-raised) 60%, transparent)' }} />
      ))}
    </div>
  );
  if (error) return <p className="p-4 text-rose-500 text-xs">{error}</p>;
  if (!stashes.length) return (
    <div className="flex items-center justify-center h-full">
      <p className="text-xs font-medium" style={{ color: 'var(--text-dim)' }}>No stashes</p>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-0">
      {stashes.map(s => (
        <div key={s.index} className="flex items-start justify-between gap-3 px-3 py-2.5 rounded-xl transition-colors"
          style={{ background: 'var(--bg-panel)', outline: '1px solid var(--border-subtle)' }}>
          <div className="min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: 'var(--foreground)' }}>{s.message}</p>
            {s.date && <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-dim)' }}>{s.date}</p>}
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button disabled={acting !== null} onClick={() => act(s.index, 'apply')}
              className="text-[11px] font-medium text-emerald-600 hover:text-emerald-500 disabled:opacity-40 px-2 py-1 rounded-lg hover:bg-emerald-500/10 transition-colors">
              Apply
            </button>
            <button disabled={acting !== null} onClick={() => act(s.index, 'drop')}
              className="text-[11px] font-medium text-rose-600 hover:text-rose-500 disabled:opacity-40 px-2 py-1 rounded-lg hover:bg-rose-500/10 transition-colors">
              Drop
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
