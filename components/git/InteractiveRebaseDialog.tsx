'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface RebaseCommit { hash: string; shortHash: string; subject: string; author: string; date: string; }
type RebaseAction = 'pick' | 'reword' | 'squash' | 'fixup' | 'drop';
interface TodoRow extends RebaseCommit { action: RebaseAction; message: string; }
interface RebaseState { inProgress: boolean; conflicts: string[]; stoppedAt?: string; }

const ACTIONS: { value: RebaseAction; label: string; hint: string }[] = [
  { value: 'pick',   label: 'pick',   hint: 'keep commit as-is' },
  { value: 'reword', label: 'reword', hint: 'keep commit, edit message' },
  { value: 'squash', label: 'squash', hint: 'fold into previous, combine messages' },
  { value: 'fixup',  label: 'fixup',  hint: 'fold into previous, discard message' },
  { value: 'drop',   label: 'drop',   hint: 'remove commit' },
];

export default function InteractiveRebaseDialog({
  repo, open, onOpenChange, branches, currentBranch, initialBase, onDone,
}: {
  repo: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: string[];
  currentBranch?: string;
  initialBase?: string;
  onDone?: () => void;
}) {
  const [base, setBase] = useState('');
  const [rows, setRows] = useState<TodoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [state, setState] = useState<RebaseState | null>(null);

  useEffect(() => {
    if (!open) { setRows([]); setBase(''); setState(null); return; }
    // If a rebase is already paused on conflicts, go straight to the conflict view.
    fetch(`/api/git/rebase?repo=${encodeURIComponent(repo)}`)
      .then(r => r.json())
      .then(d => { if (d.state?.inProgress) setState(d.state); else if (initialBase) selectBase(initialBase); })
      .catch(() => {});
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectBase = (b: string) => {
    setBase(b);
    setRows([]);
    if (!b) return;
    setLoading(true);
    fetch(`/api/git/rebase?repo=${encodeURIComponent(repo)}&base=${encodeURIComponent(b)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setRows((d.commits || []).map((c: RebaseCommit) => ({ ...c, action: 'pick' as RebaseAction, message: '' })));
      })
      .catch(e => toast.error('Failed to load commits', { description: String(e) }))
      .finally(() => setLoading(false));
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
  };

  const update = (i: number, patch: Partial<TodoRow>) => {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const firstKept = rows.findIndex(r => r.action !== 'drop');
  const invalid =
    rows.length === 0 ||
    (firstKept !== -1 && ['squash', 'fixup'].includes(rows[firstKept].action)) ||
    rows.some(r => r.action === 'reword' && !r.message.trim());

  const run = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/git/rebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo, base,
          todo: rows.map(r => ({ hash: r.hash, action: r.action, message: r.message.trim() || undefined })),
        }),
      });
      const d = await res.json();
      if (d.state?.inProgress) {
        setState(d.state);
        toast.warning('Rebase paused on conflicts');
      } else if (d.error) {
        throw new Error(d.error);
      } else {
        toast.success(d.result || 'Rebase completed');
        onOpenChange(false);
        onDone?.();
      }
    } catch (e) { toast.error('Rebase failed', { description: String(e) }); }
    finally { setRunning(false); }
  };

  const resolveAction = async (action: 'continue' | 'skip' | 'abort') => {
    setRunning(true);
    try {
      const res = await fetch('/api/git/rebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo, action }),
      });
      const d = await res.json();
      if (d.state?.inProgress) {
        setState(d.state);
        toast.warning(d.error ? 'Resolve and stage conflicts first' : 'Stopped again — more conflicts', { description: d.error });
      } else if (d.error) {
        throw new Error(d.error);
      } else {
        toast.success(d.result || `Rebase ${action === 'abort' ? 'aborted' : 'completed'}`);
        setState(null);
        onOpenChange(false);
        onDone?.();
      }
    } catch (e) { toast.error(`Rebase ${action} failed`, { description: String(e) }); }
    finally { setRunning(false); }
  };

  const selectStyle = {
    background: 'var(--bg-raised)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--foreground)',
  } as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl shadow-2xl" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', color: 'var(--foreground)' }}>
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            {state?.inProgress ? 'Rebase in Progress' : 'Interactive Rebase'}
          </DialogTitle>
        </DialogHeader>

        {state?.inProgress ? (
          <div className="flex flex-col gap-3 pt-1">
            <p className="text-xs" style={{ color: 'var(--text-soft)' }}>
              The rebase stopped{state.stoppedAt && <> at <span className="font-mono text-amber-500">{state.stoppedAt}</span></>}.
              {state.conflicts.length > 0
                ? ' Resolve the conflicts below, stage the files, then continue.'
                : ' Stage your changes, then continue.'}
            </p>
            {state.conflicts.length > 0 && (
              <div className="rounded-lg p-2 max-h-40 overflow-y-auto" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}>
                {state.conflicts.map(f => (
                  <p key={f} className="text-[11px] font-mono py-0.5 text-rose-500">{f}</p>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => resolveAction('abort')} disabled={running} className="text-xs text-rose-500">Abort rebase</Button>
              <Button variant="ghost" onClick={() => resolveAction('skip')} disabled={running} className="text-xs">Skip commit</Button>
              <Button onClick={() => resolveAction('continue')} disabled={running} className="text-xs bg-blue-600 hover:bg-blue-500 text-white">
                {running ? '…' : 'Continue'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pt-1">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-semibold tracking-widest uppercase flex-shrink-0" style={{ color: 'var(--text-dim)' }}>Rebase {currentBranch && <span className="font-mono normal-case">{currentBranch}</span>} onto</label>
              <select
                value={base}
                onChange={e => selectBase(e.target.value)}
                className="flex-1 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/60"
                style={selectStyle}
              >
                <option value="">Select base branch…</option>
                {branches.filter(b => b !== currentBranch).map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            {loading && <p className="text-xs" style={{ color: 'var(--text-dim)' }}>Loading commits…</p>}
            {!loading && base && rows.length === 0 && (
              <p className="text-xs" style={{ color: 'var(--text-dim)' }}>No commits to rebase — <span className="font-mono">{currentBranch}</span> has nothing on top of <span className="font-mono">{base}</span>.</p>
            )}

            {rows.length > 0 && (
              <div className="rounded-lg overflow-y-auto max-h-80" style={{ border: '1px solid var(--border-subtle)' }}>
                {rows.map((r, i) => (
                  <div key={r.hash} className="px-2 py-1.5" style={{ borderTop: i > 0 ? '1px solid color-mix(in oklch, var(--border-subtle) 60%, transparent)' : undefined, opacity: r.action === 'drop' ? 0.5 : 1 }}>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col flex-shrink-0">
                        <button onClick={() => move(i, -1)} disabled={i === 0} className="text-[9px] leading-none disabled:opacity-20 px-1" style={{ color: 'var(--text-dim)' }} title="Move up">▲</button>
                        <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="text-[9px] leading-none disabled:opacity-20 px-1" style={{ color: 'var(--text-dim)' }} title="Move down">▼</button>
                      </div>
                      <select
                        value={r.action}
                        onChange={e => update(i, { action: e.target.value as RebaseAction })}
                        className="rounded px-1 py-0.5 text-[11px] font-mono flex-shrink-0 focus:outline-none"
                        style={selectStyle}
                        title={ACTIONS.find(a => a.value === r.action)?.hint}
                      >
                        {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                      </select>
                      <span className="text-[11px] font-mono flex-shrink-0 text-amber-500">{r.shortHash}</span>
                      <span className="text-xs truncate flex-1" style={{ textDecoration: r.action === 'drop' ? 'line-through' : undefined }}>{r.subject}</span>
                      <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-dim)' }}>{r.date}</span>
                    </div>
                    {(r.action === 'reword' || r.action === 'squash') && (
                      <textarea
                        value={r.message}
                        onChange={e => update(i, { message: e.target.value })}
                        placeholder={r.action === 'reword' ? 'New commit message (required)' : 'Combined commit message (optional — git combines messages by default)'}
                        rows={2}
                        className="mt-1.5 ml-7 w-[calc(100%-1.75rem)] rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/60 resize-y"
                        style={selectStyle}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {rows.length > 0 && firstKept !== -1 && ['squash', 'fixup'].includes(rows[firstKept].action) && (
              <p className="text-[11px] text-rose-500">The first kept commit cannot be squash/fixup — there is no previous commit to fold into.</p>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-xs">Cancel</Button>
              <Button onClick={run} disabled={invalid || running} className="text-xs bg-blue-600 hover:bg-blue-500 text-white">
                {running ? 'Rebasing…' : `Rebase ${rows.length} commit${rows.length === 1 ? '' : 's'}`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
