'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const LS_KEY = 'git-tree-danger-unlocked';

export interface DangerOp {
  title: string;
  description: string;
}

interface DangerZoneCtx {
  unlocked: boolean;
  unlock: () => void;
  lock: () => void;
  guard: (op: DangerOp, onProceed: () => void) => void;
}

const Ctx = createContext<DangerZoneCtx>({
  unlocked: false,
  unlock: () => {},
  lock: () => {},
  guard: (_op, onProceed) => onProceed(),
});

export function useDangerZone() { return useContext(Ctx); }

export function DangerZoneProvider({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [pending, setPending] = useState<{ op: DangerOp; onProceed: () => void } | null>(null);

  useEffect(() => {
    try { setUnlocked(localStorage.getItem(LS_KEY) === '1'); } catch {}
  }, []);

  const unlock = useCallback(() => {
    setUnlocked(true);
    try { localStorage.setItem(LS_KEY, '1'); } catch {}
  }, []);

  const lock = useCallback(() => {
    setUnlocked(false);
    try { localStorage.removeItem(LS_KEY); } catch {}
  }, []);

  const guard = useCallback((op: DangerOp, onProceed: () => void) => {
    if (unlocked) { onProceed(); return; }
    setPending({ op, onProceed });
  }, [unlocked]);

  const dismiss = () => setPending(null);
  const proceedOnce = () => { pending?.onProceed(); setPending(null); };
  const unlockAndProceed = () => { unlock(); pending?.onProceed(); setPending(null); };

  return (
    <Ctx.Provider value={{ unlocked, unlock, lock, guard }}>
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
            Danger zone is locked. Click <strong>Unlock &amp; proceed</strong> to run this operation and skip this dialog in future, or <strong>Proceed once</strong> to run it just this time.
          </div>
          <DialogFooter className="gap-2 sm:gap-2 flex-row">
            <Button variant="ghost" onClick={dismiss} className="text-xs mr-auto">Cancel</Button>
            <Button variant="ghost" onClick={proceedOnce} className="text-xs" style={{ color: 'oklch(0.62 0.12 70)' }}>
              Proceed once
            </Button>
            <Button onClick={unlockAndProceed} className="text-xs" style={{ background: 'oklch(0.55 0.16 70)', color: 'white' }}>
              Unlock &amp; proceed →
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}
