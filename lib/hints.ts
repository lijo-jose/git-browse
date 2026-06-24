'use client';

import { useCallback, useEffect, useState } from 'react';

const PREFIX = 'git-tree-hint-';

export function useHint(id: string) {
  // Default false (hidden) until useEffect reads localStorage — avoids SSR flash
  const [show, setShow] = useState(false);

  useEffect(() => {
    try { setShow(localStorage.getItem(`${PREFIX}${id}`) !== '1'); } catch {}
  }, [id]);

  const dismiss = useCallback(() => {
    setShow(false);
    try { localStorage.setItem(`${PREFIX}${id}`, '1'); } catch {}
  }, [id]);

  return { show, dismiss };
}
