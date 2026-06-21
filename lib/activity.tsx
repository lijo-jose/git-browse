'use client';

import { createContext, useCallback, useContext, useState } from 'react';

interface Activity { id: string; label: string; }

interface ActivityCtx {
  activities: Activity[];
  start: (id: string, label: string) => () => void;
}

const Ctx = createContext<ActivityCtx>({ activities: [], start: () => () => {} });

export function useActivity() { return useContext(Ctx); }

export function ActivityProvider({ children }: { children: React.ReactNode }) {
  const [activities, setActivities] = useState<Activity[]>([]);

  const start = useCallback((id: string, label: string) => {
    setActivities(prev => [...prev.filter(a => a.id !== id), { id, label }]);
    return () => setActivities(prev => prev.filter(a => a.id !== id));
  }, []);

  return <Ctx.Provider value={{ activities, start }}>{children}</Ctx.Provider>;
}
