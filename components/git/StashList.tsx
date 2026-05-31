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
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setStashes(d.stashes || []); })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [repo]);

  const act = async (index: number, action: 'apply' | 'drop') => {
    setActing(index);
    try {
      const res = await fetch(
        `/api/git/stash/apply?repo=${encodeURIComponent(repo)}&index=${index}&action=${action}`,
        { method: 'POST' }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`Stash ${action === 'apply' ? 'applied' : 'dropped'}`);
      load();
    } catch (e) { toast.error(String(e)); }
    finally { setActing(null); }
  };

  if (loading) return (
    <div className="p-2 space-y-1">
      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-md bg-[#222]" />)}
    </div>
  );
  if (error) return <div className="p-4 text-[#c96b6b] text-xs">{error}</div>;
  if (stashes.length === 0) return (
    <div className="flex items-center justify-center h-full">
      <p className="text-xs text-[#404040] font-medium">No stashes</p>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-1">
      {stashes.map((s) => (
        <div key={s.index} className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-lg px-3 py-2.5 flex items-start justify-between gap-2 hover:border-[#383838] transition-colors">
          <div className="min-w-0">
            <p className="text-[12px] text-[#b0b0b0] font-medium truncate">{s.message}</p>
            {s.date && <p className="text-[10px] text-[#505050] mt-0.5">{s.date}</p>}
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button
              className="text-[11px] font-medium text-[#5ab99b] hover:text-[#7dd4be] disabled:opacity-40 px-1.5 py-0.5 rounded hover:bg-[#5ab99b]/10 transition-colors"
              disabled={acting !== null}
              onClick={() => act(s.index, 'apply')}
            >Apply</button>
            <button
              className="text-[11px] font-medium text-[#c96b6b] hover:text-[#e08080] disabled:opacity-40 px-1.5 py-0.5 rounded hover:bg-[#c96b6b]/10 transition-colors"
              disabled={acting !== null}
              onClick={() => act(s.index, 'drop')}
            >Drop</button>
          </div>
        </div>
      ))}
    </div>
  );
}
