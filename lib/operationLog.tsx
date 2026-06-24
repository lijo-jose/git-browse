'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';

export type OpStatus = 'pending' | 'success' | 'error';

export interface OpEntry {
  id: string;
  label: string;
  cmd: string;
  status: OpStatus;
  result?: string;
  error?: string;
  suggestion?: string;
  startedAt: number;
  duration?: number;
}

export interface OpHandle {
  success: (result?: string) => void;
  error: (err: string, suggestion?: string) => void;
}

interface OpLogCtx {
  entries: OpEntry[];
  logOp: (label: string, cmd: string) => OpHandle;
  clear: () => void;
}

const Ctx = createContext<OpLogCtx>({
  entries: [],
  logOp: () => ({ success: () => {}, error: () => {} }),
  clear: () => {},
});

export function useOperationLog() { return useContext(Ctx); }

const MAX_ENTRIES = 50;
let seq = 0;

export function OperationLogProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<OpEntry[]>([]);
  // Use ref to avoid stale closures in handles
  const entriesRef = useRef<OpEntry[]>([]);

  const set = (next: OpEntry[]) => {
    entriesRef.current = next;
    setEntries(next);
  };

  const logOp = useCallback((label: string, cmd: string): OpHandle => {
    const id = `op-${++seq}`;
    const startedAt = Date.now();
    const entry: OpEntry = { id, label, cmd, status: 'pending', startedAt };
    const next = [entry, ...entriesRef.current].slice(0, MAX_ENTRIES);
    set(next);

    const update = (patch: Partial<OpEntry>) => {
      set(entriesRef.current.map(e => e.id === id ? { ...e, ...patch, duration: Date.now() - startedAt } : e));
    };

    return {
      success: (result?: string) => update({ status: 'success', result }),
      error: (err: string, suggestion?: string) => update({ status: 'error', error: err, suggestion }),
    };
  }, []);

  const clear = useCallback(() => set([]), []);

  return <Ctx.Provider value={{ entries, logOp, clear }}>{children}</Ctx.Provider>;
}
