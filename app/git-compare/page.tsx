'use client';

import { useEffect } from 'react';

export default function GitCompareRedirect() {
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    p.set('mode', 'git');
    window.location.replace('/compare?' + p.toString());
  }, []);
  return null;
}
