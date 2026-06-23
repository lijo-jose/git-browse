'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const LS_PREFIX = 'git-tree-danger-';

// Known op IDs — used for bulk lock/unlock in settings.
const ALL_OP_IDS = ['push', 'pull', 'tag', 'rebase'] as const;
type OpId = typeof ALL_OP_IDS[number];

export interface DangerOp {
  id: OpId;
  title: string;
  description: string;
}

interface DangerZoneCtx {
  /** True if at least one operation is unlocked. Used by the settings UI. */
  unlocked: boolean;
  isUnlocked: (id: string) => boolean;
  /** Unlock all ops (settings toggle). */
  unlock: () => void;
  /** Lock all ops (settings toggle). */
  lock: () => void;
  guard: (op: DangerOp, onProceed: () => void) => void;
}

const Ctx = createContext<DangerZoneCtx>({
  unlocked: false,
  isUnlocked: () => false,
  unlock: () => {},
  lock: () => {},
  guard: (_op, onProceed) => onProceed(),
});

export function useDangerZone() { return useContext(Ctx); }

function lsKey(id: string) { return `${LS_PREFIX}${id}`; }

function loadUnlocked(): Set<string> {
  const out = new Set<string>();
  try {
    for (const id of ALL_OP_IDS) {
      if (localStorage.getItem(lsKey(id)) === '1') out.add(id);
    }
  } catch {}
  return out;
}

export function DangerZoneProvider({ children }: { children: React.ReactNode }) {
  const [unlockedOps, setUnlockedOps] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<{ op: DangerOp; onProceed: () => void } | null>(null);

  useEffect(() => { setUnlockedOps(loadUnlocked()); }, []);

  const isUnlocked = useCallback((id: string) => unlockedOps.has(id), [unlockedOps]);

  const unlockOp = useCallback((id: string) => {
    setUnlockedOps(prev => new Set([...prev, id]));
    try { localStorage.setItem(lsKey(id), '1'); } catch {}
  }, []);

  const lockOp = useCallback((id: string) => {
    setUnlockedOps(prev => { const s = new Set(prev); s.delete(id); return s; });
    try { localStorage.removeItem(lsKey(id)); } catch {}
  }, []);

  const unlock = useCallback(() => {
    setUnlockedOps(new Set(ALL_OP_IDS));
    try { for (const id of ALL_OP_IDS) localStorage.setItem(lsKey(id), '1'); } catch {}
  }, []);

  const lock = useCallback(() => {
    setUnlockedOps(new Set());
    try { for (const id of ALL_OP_IDS) localStorage.removeItem(lsKey(id)); } catch {}
  }, []);

  const guard = useCallback((op: DangerOp, onProceed: () => void) => {
    if (unlockedOps.has(op.id)) { onProceed(); return; }
    setPending({ op, onProceed });
  }, [unlockedOps]);

  const dismiss = () => setPending(null);
  const proceedOnce = () => { pending?.onProceed(); setPending(null); };
  const unlockAndProceed = () => {
    if (pending) { unlockOp(pending.op.id); pending.onProceed(); setPending(null); }
  };

  const unlocked = unlockedOps.size > 0;

  return (
    <Ctx.Provider value={{ unlocked, isUnlocked, unlock, lock, guard }}>
      {children}
      <Dialog open={!!pending} onOpenChange={open => { if (!open) dismiss(); }}>
        <DialogContent className="sm:max-w-sm shadow-2xl" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', color: 'var(--foreground)' }}>
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'oklch(0.72 0.16 70)', flexShrink: 0 }}>
                <path d="M8 2L2 14h12L8 2z"/><line x1="8" y1="7" x2="8" y2="10"/><circle cx="8" cy="12.5" r="0.6" fill="currentColor" stroke="none"/>
              </svg>
              {pending?.op.title}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm" style={{ color: 'var(--text-soft)' }}>{pending?.op.description}</p>
          <div className="rounded-lg px-3 py-2 text-xs leading-relaxed" style={{ background: 'color-mix(in oklch, oklch(0.72 0.16 70) 8%, transparent)', color: 'oklch(0.62 0.12 70)', border: '1px solid color-mix(in oklch, oklch(0.72 0.16 70) 22%, transparent)' }}>
            Click <strong>Always allow</strong> to skip this dialog for <strong>{pending?.op.title}</strong> in future, or <strong>Proceed once</strong> to run it just this time.
          </div>
          <DialogFooter className="gap-2 sm:gap-2 flex-row">
            <Button variant="ghost" onClick={dismiss} className="text-xs mr-auto">Cancel</Button>
            <Button variant="ghost" onClick={proceedOnce} className="text-xs" style={{ color: 'oklch(0.62 0.12 70)' }}>
              Proceed once
            </Button>
            <Button onClick={unlockAndProceed} className="text-xs" style={{ background: 'oklch(0.55 0.16 70)', color: 'white' }}>
              Always allow →
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}
