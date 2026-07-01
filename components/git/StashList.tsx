'use client';

import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useOperationLog } from '@/lib/operationLog';
import { gitErrorToast } from '@/lib/gitErrorToast';

interface Stash { index: number; message: string; date?: string; }

export default function StashList({ repo }: { repo: string }) {
  const { logOp } = useOperationLog();
  const [stashes, setStashes] = useState<Stash[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [acting, setActing] = useState<number | null>(null);
  const [stashing, setStashing] = useState(false);
  const [stashMsg, setStashMsg] = useState('');
  const [showMsgInput, setShowMsgInput] = useState(false);

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

  const stashChanges = async () => {
    setStashing(true);
    const msg = stashMsg.trim();
    const op = logOp('Stash', msg ? `git stash push -m "${msg}"` : 'git stash push');
    try {
      const body: Record<string, string> = { repo };
      if (msg) body.message = msg;
      const res = await fetch('/api/git/stash-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      op.success(d.result || 'Stashed changes');
      toast.success(d.result || 'Stashed changes');
      setStashMsg('');
      setShowMsgInput(false);
      load();
    } catch (e) { gitErrorToast('Stash failed', e, op); }
    finally { setStashing(false); }
  };

  const act = async (index: number, action: 'apply' | 'pop' | 'drop') => {
    setActing(index);
    const cmdMap = { apply: `git stash apply stash@{${index}}`, pop: `git stash pop stash@{${index}}`, drop: `git stash drop stash@{${index}}` };
    const op = logOp(`Stash ${action}`, cmdMap[action]);
    try {
      const res = await fetch(`/api/git/stash/apply?repo=${encodeURIComponent(repo)}&index=${index}&action=${action}`, { method: 'POST' });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      const label = action === 'apply' ? 'applied' : action === 'pop' ? 'popped' : 'dropped';
      op.success(`Stash ${label}`);
      toast.success(`Stash ${label}`);
      load();
    } catch (e) { gitErrorToast(`Stash ${action} failed`, e, op); }
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

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Stash push controls */}
      <div className="flex-shrink-0 px-3 pt-3 pb-2 space-y-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        {showMsgInput && (
          <input
            autoFocus
            value={stashMsg}
            onChange={e => setStashMsg(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') stashChanges();
              if (e.key === 'Escape') { setShowMsgInput(false); setStashMsg(''); }
            }}
            placeholder="Stash message (optional)"
            className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', color: 'var(--foreground)' }}
          />
        )}
        <div className="flex gap-1.5">
          <button
            disabled={stashing}
            onClick={() => { if (showMsgInput) stashChanges(); else setShowMsgInput(true); }}
            className="flex-1 text-[11px] font-medium py-1.5 rounded-lg transition-colors disabled:opacity-40"
            style={{ background: 'var(--bg-raised)', color: 'var(--foreground)', outline: '1px solid var(--border-subtle)' }}
          >
            {showMsgInput ? 'Confirm Stash' : 'Stash Changes'}
          </button>
          {showMsgInput && (
            <button
              onClick={() => { setShowMsgInput(false); setStashMsg(''); }}
              className="text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-dim)' }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Stash list */}
      {!stashes.length ? (
        <div className="flex items-center justify-center flex-1">
          <p className="text-xs font-medium" style={{ color: 'var(--text-dim)' }}>No stashes</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-0">
          {stashes.map(s => (
            <div key={s.index} className="flex items-start justify-between gap-3 px-3 py-2.5 rounded-xl transition-colors"
              style={{ background: 'var(--bg-panel)', outline: '1px solid var(--border-subtle)' }}>
              <div className="min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: 'var(--foreground)' }}>{s.message}</p>
                {s.date && <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-dim)' }}>{s.date}</p>}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button disabled={acting !== null} onClick={() => act(s.index, 'pop')}
                  className="text-[11px] font-medium text-emerald-600 hover:text-emerald-500 disabled:opacity-40 px-2 py-1 rounded-lg hover:bg-emerald-500/10 transition-colors">
                  Pop
                </button>
                <button disabled={acting !== null} onClick={() => act(s.index, 'apply')}
                  className="text-[11px] font-medium hover:opacity-80 disabled:opacity-40 px-2 py-1 rounded-lg transition-colors"
                  style={{ color: 'var(--text-dim)' }}>
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
      )}
    </div>
  );
}
