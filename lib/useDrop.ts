'use client';

import { useCallback, useRef, useState } from 'react';

interface UseDropOptions {
  accept?: 'directory' | 'file' | 'any';
  onPath?: (path: string, isDirectory: boolean) => void;
  onContent?: (content: string, name: string) => void;
}


export function useDrop({ accept = 'any', onPath, onContent }: UseDropOptions) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const counterRef = useRef(0);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showError = useCallback((msg: string) => {
    setError(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setError(''), 3000);
  }, []);

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    counterRef.current++;
    setDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    counterRef.current--;
    if (counterRef.current === 0) setDragging(false);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'link';
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    counterRef.current = 0;
    setDragging(false);

    const item = e.dataTransfer.items[0];
    const entry = item?.webkitGetAsEntry?.();
    const isDirectory = entry?.isDirectory ?? false;
    const file = e.dataTransfer.files[0];
    const uriListRaw = e.dataTransfer.getData('text/uri-list');
    const plainRaw   = e.dataTransfer.getData('text/plain');

    if (accept === 'directory' && !isDirectory) { showError('Drop a folder here'); return; }
    if (accept === 'file'      &&  isDirectory) { showError('Drop a file here');   return; }

    // ── Strategy 1: text/uri-list (Linux/Windows Chromium, some macOS) ──
    const uriList = uriListRaw || plainRaw;
    if (uriList) {
      const uri = uriList.trim().split(/\r?\n/).find(l => l.startsWith('file://'));
      if (uri && onPath) {
        const path = decodeURIComponent(uri.replace(/^file:\/\//, ''));
        onPath(path, isDirectory);
        return;
      }
    }

    // ── Strategy 2: file.path (Electron / older Chromium) ──
    if (file) {
      const filePath = (file as File & { path?: string }).path;
      if (filePath && onPath) { onPath(filePath, isDirectory); return; }

      // ── Strategy 3: read content (clipboard panes — files only) ──
      if (!isDirectory && onContent) {
        const reader = new FileReader();
        reader.onload = ev => onContent(ev.target?.result as string ?? '', file.name);
        reader.readAsText(file);
        return;
      }

      // ── Strategy 4: server-side path resolver (browser security fallback) ──
      // We know the name + mtime + size — ask the server to find it in the home dir.
      if (onPath && file.name) {
        fetch('/api/compare/find-path', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: file.name, mtime: file.lastModified, size: file.size, isDirectory }),
        })
          .then(r => r.json())
          .then(d => {
            if (d.path) { onPath(d.path, isDirectory); }
            else { showError(d.error ?? 'Could not resolve path'); }
          })
          .catch(() => showError('Could not resolve path — use the picker instead'));
        return;
      }
    }

    showError('Could not read path — use the picker instead');
  }, [accept, onPath, onContent, showError]);

  return { dragging, error, handlers: { onDragEnter, onDragLeave, onDragOver, onDrop } };
}
