'use client';

import { useEffect, useState, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import FileDiffViewer from '@/components/compare/FileDiffViewer';

interface Refs { branches: string[]; tags: string[]; recent: { hash: string; short: string; subject: string }[] }
interface CompareFile { path: string; insertions: number; deletions: number; }

export default function BranchCompare({ repo }: { repo: string }) {
  const [refs, setRefs] = useState<Refs | null>(null);
  const [refsLoading, setRefsLoading] = useState(false);
  const [base, setBase] = useState('');
  const [customBase, setCustomBase] = useState('');
  const [files, setFiles] = useState<CompareFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [selFile, setSelFile] = useState<string | null>(null);
  const [diff, setDiff] = useState('');
  const [diffLoading, setDiffLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterText, setFilterText] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropFilter, setDropFilter] = useState('');
  const dropRef = useRef<HTMLDivElement>(null);

  const effectiveBase = base === '__custom__' ? customBase.trim() : base;

  useEffect(() => {
    if (!repo) return;
    setRefsLoading(true);
    fetch(`/api/git/compare?repo=${encodeURIComponent(repo)}&mode=refs`)
      .then(r => r.json())
      .then(d => { if (!d.error) setRefs(d); })
      .finally(() => setRefsLoading(false));
  }, [repo]);

  useEffect(() => {
    if (!effectiveBase) { setFiles([]); setSelFile(null); setDiff(''); return; }
    setFilesLoading(true); setError(''); setSelFile(null); setDiff('');
    fetch(`/api/git/compare?repo=${encodeURIComponent(repo)}&mode=files&base=${encodeURIComponent(effectiveBase)}`)
      .then(r => r.json())
      .then(d => { if (d.error) { setError(d.error); setFiles([]); } else setFiles(d.files || []); })
      .catch(e => setError(String(e)))
      .finally(() => setFilesLoading(false));
  }, [repo, effectiveBase]);

  useEffect(() => {
    if (!selFile || !effectiveBase) { setDiff(''); return; }
    setDiffLoading(true);
    fetch(`/api/git/compare?repo=${encodeURIComponent(repo)}&mode=diff&base=${encodeURIComponent(effectiveBase)}&file=${encodeURIComponent(selFile)}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setDiff(d.diff || ''); })
      .finally(() => setDiffLoading(false));
  }, [repo, effectiveBase, selFile]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowDropdown(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  if (!repo) return (
    <div className="flex items-center justify-center h-full text-xs" style={{ color: 'var(--text-dim)' }}>
      Select a repository first
    </div>
  );

  const allRefs: { label: string; group: string; value: string }[] = refs ? [
    ...refs.branches.map(b => ({ label: b, group: 'Branches', value: b })),
    ...refs.tags.map(t => ({ label: t, group: 'Tags', value: t })),
    ...refs.recent.map(r => ({ label: `${r.short} ${r.subject}`, group: 'Recent commits', value: r.hash })),
  ] : [];

  const filteredRefs = dropFilter
    ? allRefs.filter(r => r.label.toLowerCase().includes(dropFilter.toLowerCase()))
    : allRefs;

  const groups = Array.from(new Set(filteredRefs.map(r => r.group)));

  const filteredFiles = filterText
    ? files.filter(f => f.path.toLowerCase().includes(filterText.toLowerCase()))
    : files;

  const added = files.reduce((s, f) => s + f.insertions, 0);
  const removed = files.reduce((s, f) => s + f.deletions, 0);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Base ref picker */}
      <div className="flex-shrink-0 px-3 py-2.5 border-b" style={{ borderColor: 'color-mix(in oklch, var(--border-subtle) 60%, transparent)' }}>
        <div className="text-[10px] font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-dim)' }}>
          Compare HEAD against
        </div>
        <div className="relative" ref={dropRef}>
          <button
            onClick={() => { setShowDropdown(v => !v); setDropFilter(''); }}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-mono transition-colors"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', color: effectiveBase ? 'var(--foreground)' : 'var(--text-dim)' }}
          >
            <span className="truncate">{effectiveBase || 'Select branch / tag / commit…'}</span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className="flex-shrink-0 ml-1">
              <path d="M2 3.5l3 3 3-3"/>
            </svg>
          </button>

          {showDropdown && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg shadow-2xl overflow-hidden"
              style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', maxHeight: 280 }}>
              <div className="p-1.5">
                <input
                  autoFocus
                  value={dropFilter}
                  onChange={e => setDropFilter(e.target.value)}
                  placeholder="Filter refs or type SHA…"
                  className="w-full px-2.5 py-1.5 text-xs rounded-md outline-none"
                  style={{ background: 'var(--bg-raised)', color: 'var(--foreground)', border: '1px solid var(--border-subtle)' }}
                  onKeyDown={e => {
                    if (e.key === 'Escape') setShowDropdown(false);
                    if (e.key === 'Enter' && dropFilter.trim()) {
                      setBase('__custom__'); setCustomBase(dropFilter.trim()); setShowDropdown(false);
                    }
                  }}
                />
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: 220 }}>
                {refsLoading ? (
                  <div className="px-3 py-4 text-xs text-center" style={{ color: 'var(--text-dim)' }}>Loading…</div>
                ) : groups.length === 0 ? (
                  dropFilter ? (
                    <button
                      onClick={() => { setBase('__custom__'); setCustomBase(dropFilter); setShowDropdown(false); }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-raised)] font-mono"
                      style={{ color: 'var(--text-soft)' }}
                    >
                      Use &ldquo;{dropFilter}&rdquo; as ref
                    </button>
                  ) : (
                    <div className="px-3 py-4 text-xs text-center" style={{ color: 'var(--text-dim)' }}>No refs found</div>
                  )
                ) : (
                  groups.map(group => (
                    <div key={group}>
                      <div className="px-3 py-1 text-[10px] font-semibold tracking-widest uppercase sticky top-0"
                        style={{ color: 'var(--text-dim)', background: 'var(--bg-panel)' }}>
                        {group}
                      </div>
                      {filteredRefs.filter(r => r.group === group).map(r => (
                        <button
                          key={r.value}
                          onClick={() => { setBase(r.value); setCustomBase(''); setShowDropdown(false); }}
                          className="w-full text-left px-3 py-1.5 text-xs font-mono flex items-center gap-2 transition-colors hover:bg-[var(--bg-raised)]"
                          style={{ color: r.value === effectiveBase ? 'var(--foreground)' : 'var(--text-soft)' }}
                        >
                          {r.value === effectiveBase && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />}
                          <span className="truncate">{r.label}</span>
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* File list + diff */}
      {effectiveBase ? (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Stats bar */}
          {files.length > 0 && (
            <div className="flex-shrink-0 flex items-center gap-3 px-3 py-1.5 border-b text-[11px]"
              style={{ borderColor: 'color-mix(in oklch, var(--border-subtle) 60%, transparent)', color: 'var(--text-dim)' }}>
              <span>{files.length} file{files.length !== 1 ? 's' : ''} changed</span>
              {added > 0 && <span className="text-emerald-500">+{added}</span>}
              {removed > 0 && <span className="text-red-400">−{removed}</span>}
            </div>
          )}

          {error && (
            <div className="flex-shrink-0 px-3 py-2 text-xs text-red-400 border-b"
              style={{ borderColor: 'color-mix(in oklch, var(--border-subtle) 60%, transparent)' }}>
              {error}
            </div>
          )}

          {filesLoading ? (
            <div className="flex flex-col gap-1.5 p-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-6 w-full rounded" />)}
            </div>
          ) : files.length === 0 && !error ? (
            <div className="flex items-center justify-center flex-1 text-xs" style={{ color: 'var(--text-dim)' }}>
              No differences from <span className="font-mono ml-1">{effectiveBase}</span>
            </div>
          ) : (
            <div className="flex flex-1 min-h-0 overflow-hidden">
              {/* File list */}
              <div className="flex flex-col border-r flex-shrink-0 overflow-hidden"
                style={{ width: 220, borderColor: 'color-mix(in oklch, var(--border-subtle) 60%, transparent)' }}>
                <div className="flex-shrink-0 px-2 py-1.5 border-b"
                  style={{ borderColor: 'color-mix(in oklch, var(--border-subtle) 60%, transparent)' }}>
                  <input
                    value={filterText}
                    onChange={e => setFilterText(e.target.value)}
                    placeholder="Filter files…"
                    className="w-full px-2 py-1 text-[11px] rounded outline-none"
                    style={{ background: 'var(--bg-raised)', color: 'var(--foreground)', border: '1px solid var(--border-subtle)' }}
                  />
                </div>
                <div className="overflow-y-auto flex-1">
                  {filteredFiles.map(f => (
                    <button
                      key={f.path}
                      onClick={() => setSelFile(f.path)}
                      className="w-full text-left px-2.5 py-1.5 flex items-center gap-2 transition-colors"
                      style={{
                        background: selFile === f.path ? 'var(--bg-raised)' : 'transparent',
                        borderLeft: selFile === f.path ? '2px solid var(--primary)' : '2px solid transparent',
                      }}
                    >
                      <span className="text-[11px] font-mono truncate flex-1" style={{ color: 'var(--text-soft)' }}
                        title={f.path}>
                        {f.path.split('/').pop()}
                      </span>
                      <span className="flex-shrink-0 flex gap-1 text-[10px]">
                        {f.insertions > 0 && <span className="text-emerald-500">+{f.insertions}</span>}
                        {f.deletions > 0 && <span className="text-red-400">−{f.deletions}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Diff viewer — reuse the same polished viewer as /compare */}
              <div className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col">
                {diffLoading ? (
                  <div className="flex flex-col gap-1.5 p-4">
                    {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-4 w-full rounded" />)}
                  </div>
                ) : selFile ? (
                  <FileDiffViewer
                    key={`${effectiveBase}::${selFile}`}
                    leftPath=""
                    rightPath=""
                    relativePath={selFile}
                    status="modified"
                    rawDiff={diff}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-xs" style={{ color: 'var(--text-dim)' }}>
                    Select a file to view diff
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center flex-1 gap-3" style={{ color: 'var(--text-dim)' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="opacity-30">
            <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="6" r="3"/>
            <path d="M6 9v6"/><path d="M9 6h6"/><path d="M9 6a9 9 0 019 9"/>
          </svg>
          <p className="text-xs font-medium">Pick a branch or commit to compare</p>
        </div>
      )}
    </div>
  );
}

