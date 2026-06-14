'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { loadGroups, saveGroups, createGroup, type RepoGroup } from '@/lib/repoGroups';

interface FsEntry { name: string; path: string; isDirectory: boolean; isGitRepo: boolean; branch?: string; isIgnored?: boolean; }
interface Props { onRepoSelect: (p: string) => void; selectedRepo: string | null; navigateTo?: string | null; }

interface RepoStatus { path: string; name: string; branch: string; ahead: number; behind: number; dirty: boolean; error?: boolean; }

const FAV_KEY = 'git-browser-favorites';
const COMPARE_LEFT_KEY = 'git-browser-compare-left';

interface CtxMenu { x: number; y: number; entry: FsEntry; }

export default function FolderPanel({ onRepoSelect, selectedRepo, navigateTo }: Props) {
  const [cur, setCur] = useState('~');
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showIgnored, setShowIgnored] = useState(false);
  const [favs, setFavs] = useState<{ name: string; path: string; isGitRepo?: boolean }[]>([]);
  const [resolved, setResolved] = useState('');
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [compareLeft, setCompareLeft] = useState<{ name: string; path: string } | null>(null);
  const [groups, setGroups] = useState<RepoGroup[]>([]);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupPaths, setNewGroupPaths] = useState<string[]>([]);
  const [addRepoInput, setAddRepoInput] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupPaths, setEditGroupPaths] = useState<string[]>([]);
  const [editAddInput, setEditAddInput] = useState('');
  const [ctxGroupSubmenu, setCtxGroupSubmenu] = useState(false);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [groupStatuses, setGroupStatuses] = useState<Record<string, RepoStatus[]>>({});
  const [groupLoading, setGroupLoading] = useState<string | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const load = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/fs?path=${encodeURIComponent(p)}`);
      const d = await res.json();
      setEntries(d.entries || []);
      setResolved(d.path || p);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const initialDir = selectedRepo
      ? (() => {
          const winPath = /^[A-Za-z]:[/\\]/.test(selectedRepo);
          const parts = selectedRepo.split(/[/\\]/);
          parts.pop();
          return winPath ? (parts.join('\\') + '\\') || selectedRepo : parts.join('/') || '/';
        })()
      : cur;
    load(initialDir);
    try {
      const s = localStorage.getItem(FAV_KEY); if (s) setFavs(JSON.parse(s));
      const cl = localStorage.getItem(COMPARE_LEFT_KEY); if (cl) setCompareLeft(JSON.parse(cl));
      setGroups(loadGroups());
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!navigateTo) return;
    const winNav = /^[A-Za-z]:[/\\]/.test(navigateTo);
    const navParts = navigateTo.split(/[/\\]/);
    navParts.pop();
    const dir = winNav ? (navParts.join('\\') + '\\') || navigateTo : navParts.join('/') || '/';
    setCur(dir);
    load(dir);
  }, [navigateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close context menu on outside click or scroll
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    document.addEventListener('click', close);
    document.addEventListener('contextmenu', close);
    document.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('contextmenu', close);
      document.removeEventListener('scroll', close, true);
    };
  }, [ctxMenu]);

  const go = (e: FsEntry) => {
    if (e.isGitRepo) onRepoSelect(e.path);
    if (e.isDirectory) { setCur(e.path); load(e.path); }
  };

  const isWindows = /^[A-Za-z]:[/\\]/.test(resolved);
  const sep = isWindows ? '\\' : '/';
  const crumbs = resolved.split(/[/\\]/).filter(Boolean);
  const nav = (i: number) => {
    const parts = crumbs.slice(0, i + 1);
    const p = isWindows ? parts.join('\\') + '\\' : '/' + parts.join('/');
    setCur(p); load(p);
  };

  const pin = (e: FsEntry) => {
    const next = [...favs.filter(f => f.path !== e.path), { name: e.name, path: e.path, isGitRepo: e.isGitRepo }];
    setFavs(next); localStorage.setItem(FAV_KEY, JSON.stringify(next));
  };
  const unpin = (path: string) => {
    const next = favs.filter(f => f.path !== path);
    setFavs(next); localStorage.setItem(FAV_KEY, JSON.stringify(next));
  };

  const openCtxMenu = (ev: React.MouseEvent, entry: FsEntry) => {
    ev.preventDefault();
    ev.stopPropagation();
    setCtxMenu({ x: ev.clientX, y: ev.clientY, entry });
    setCtxGroupSubmenu(false);
  };

  const copyPath = (path: string) => {
    navigator.clipboard.writeText(path).then(
      () => toast.success('Copied', { description: path }),
      () => toast.error('Copy failed'),
    );
    setCtxMenu(null);
  };

  const setAsLeft = (entry: FsEntry) => {
    const val = { name: entry.name, path: entry.path };
    setCompareLeft(val);
    localStorage.setItem(COMPARE_LEFT_KEY, JSON.stringify(val));
    toast.success('Set as left folder', { description: entry.path });
    setCtxMenu(null);
  };

  const compareWith = (right: FsEntry) => {
    if (!compareLeft) return;
    localStorage.removeItem(COMPARE_LEFT_KEY);
    setCompareLeft(null);
    setCtxMenu(null);
    router.push(`/compare?left=${encodeURIComponent(compareLeft.path)}&right=${encodeURIComponent(right.path)}`);
  };

  const clearLeft = () => {
    localStorage.removeItem(COMPARE_LEFT_KEY);
    setCompareLeft(null);
    setCtxMenu(null);
  };

  const isPinned = (path: string) => favs.some(f => f.path === path);

  const addCurrentToNewGroup = () => {
    if (selectedRepo && !newGroupPaths.includes(selectedRepo)) {
      setNewGroupPaths(prev => [...prev, selectedRepo]);
    }
  };

  const saveNewGroup = () => {
    const name = newGroupName.trim();
    if (!name || newGroupPaths.length === 0) return;
    const next = [...groups, createGroup(name, newGroupPaths)];
    setGroups(next);
    saveGroups(next);
    setNewGroupOpen(false);
    setNewGroupName('');
    setNewGroupPaths([]);
    setAddRepoInput('');
    toast.success('Group created', { description: name });
  };

  const deleteGroup = (id: string) => {
    const next = groups.filter(g => g.id !== id);
    setGroups(next);
    saveGroups(next);
  };

  const openEditGroup = (g: RepoGroup) => {
    setEditingGroupId(g.id);
    setEditGroupName(g.name);
    setEditGroupPaths([...g.repoPaths]);
    setEditAddInput('');
    setNewGroupOpen(false);
  };

  const saveEditGroup = () => {
    const name = editGroupName.trim();
    if (!name || editGroupPaths.length === 0) return;
    const next = groups.map(g => g.id === editingGroupId ? { ...g, name, repoPaths: editGroupPaths } : g);
    setGroups(next);
    saveGroups(next);
    setEditingGroupId(null);
    toast.success('Group updated', { description: name });
  };

  const fetchGroupStatuses = async (g: RepoGroup) => {
    setGroupLoading(g.id);
    const results = await Promise.all(
      g.repoPaths.map(async (repoPath): Promise<RepoStatus> => {
        const name = repoPath.split('/').pop() || repoPath;
        try {
          const [branchRes, syncRes, statusRes] = await Promise.all([
            fetch(`/api/git/branches?repo=${encodeURIComponent(repoPath)}`).then(r => r.json()),
            fetch(`/api/git/sync-status?repo=${encodeURIComponent(repoPath)}`).then(r => r.json()),
            fetch(`/api/git/status?repo=${encodeURIComponent(repoPath)}`).then(r => r.json()),
          ]);
          const cur = (branchRes.branches || []).find((b: { current: boolean }) => b.current) as { name: string } | undefined;
          return { path: repoPath, name, branch: cur?.name || '—', ahead: syncRes.ahead ?? 0, behind: syncRes.behind ?? 0, dirty: (statusRes.files || []).length > 0 };
        } catch {
          return { path: repoPath, name, branch: '—', ahead: 0, behind: 0, dirty: false, error: true };
        }
      })
    );
    setGroupStatuses(prev => ({ ...prev, [g.id]: results }));
    setGroupLoading(null);
  };

  const toggleGroupExpand = (g: RepoGroup) => {
    if (expandedGroupId === g.id) {
      setExpandedGroupId(null);
    } else {
      setExpandedGroupId(g.id);
      if (!groupStatuses[g.id]) fetchGroupStatuses(g);
    }
  };

  const addRepoToGroup = (groupId: string, repoPath: string) => {
    const next = groups.map(g =>
      g.id === groupId && !g.repoPaths.includes(repoPath)
        ? { ...g, repoPaths: [...g.repoPaths, repoPath] }
        : g
    );
    setGroups(next);
    saveGroups(next);
    const g = next.find(g => g.id === groupId);
    toast.success(`Added to "${g?.name}"`, { description: repoPath.split('/').pop() });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Compare left banner */}
      {compareLeft && (
        <div className="flex items-center gap-2 px-3 py-1.5 text-[11px]"
          style={{ background: 'color-mix(in oklch, oklch(0.6 0.18 140) 10%, transparent)', borderBottom: '1px solid color-mix(in oklch, oklch(0.6 0.18 140) 25%, transparent)' }}>
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ color: 'oklch(0.6 0.18 140)', flexShrink: 0 }}>
            <path d="M2 8h12M8 2l6 6-6 6"/>
          </svg>
          <span className="flex-1 truncate" style={{ color: 'var(--text-soft)' }}>
            Left: <span className="font-medium" style={{ color: 'var(--foreground)' }}>{compareLeft.name}</span>
          </span>
          <button onClick={clearLeft} className="text-[10px] hover:text-rose-400 transition-colors" style={{ color: 'var(--text-dim)' }}>✕</button>
        </div>
      )}

      {/* Pinned */}
      {favs.length > 0 && (
        <div className="py-1.5" style={{ borderBottom: '1px solid color-mix(in oklch, var(--border-subtle) 60%, transparent)' }}>
          <p className="px-4 mb-1 text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--text-dim)' }}>Pinned</p>
          {favs.map(f => (
            <div key={f.path} className="group flex items-center gap-2 mx-2 px-2 py-1 rounded-lg cursor-pointer transition-colors"
              style={{}}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'color-mix(in oklch, var(--bg-raised) 50%, transparent)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
              onClick={() => { onRepoSelect(f.path); setCur(f.path); load(f.path); }}
              onContextMenu={ev => openCtxMenu(ev, { name: f.name, path: f.path, isDirectory: true, isGitRepo: f.isGitRepo ?? false })}
            >
              <FolderIcon className="text-blue-500" />
              <span className="text-xs font-medium truncate flex-1" style={{ color: 'var(--foreground)' }}>{f.name}</span>
              <button onClick={e => { e.stopPropagation(); unpin(f.path); }}
                className="opacity-0 group-hover:opacity-100 hover:text-rose-500 transition-all text-[10px] w-4"
                style={{ color: 'var(--text-dim)' }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Groups */}
      <div className="py-1.5" style={{ borderBottom: '1px solid color-mix(in oklch, var(--border-subtle) 60%, transparent)' }}>
        <div className="flex items-center px-4 mb-1">
          <p className="flex-1 text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--text-dim)' }}>Groups</p>
          <button
            onClick={() => { setNewGroupOpen(v => !v); setNewGroupName(''); setNewGroupPaths(selectedRepo ? [selectedRepo] : []); setAddRepoInput(''); }}
            title="New group"
            className="w-5 h-5 flex items-center justify-center rounded text-[var(--text-dim)] hover:text-foreground hover:bg-[var(--bg-raised)] transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="5" y1="1" x2="5" y2="9"/><line x1="1" y1="5" x2="9" y2="5"/>
            </svg>
          </button>
        </div>

        {/* New group form */}
        {newGroupOpen && (
          <div className="mx-2 mb-1.5 p-2.5 rounded-lg" style={{ background: 'color-mix(in oklch, var(--bg-raised) 50%, transparent)', border: '1px solid color-mix(in oklch, var(--border-subtle) 60%, transparent)' }}>
            <input
              autoFocus
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              placeholder="Group name…"
              className="w-full h-7 px-2.5 rounded-md text-xs bg-[var(--bg-raised)] border border-[var(--border-subtle)] text-foreground placeholder:text-[var(--text-dim)] focus:outline-none focus:border-primary mb-2"
            />
            <p className="text-[10px] mb-1" style={{ color: 'var(--text-dim)' }}>Repos in this group:</p>
            {newGroupPaths.map(p => (
              <div key={p} className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] truncate flex-1 font-medium" style={{ color: 'var(--text-soft)' }}>{p.split('/').pop()}</span>
                <button onClick={() => setNewGroupPaths(prev => prev.filter(x => x !== p))} className="text-[10px] text-[var(--text-dim)] hover:text-rose-400">✕</button>
              </div>
            ))}
            <div className="flex gap-1 mt-1.5">
              <input
                value={addRepoInput}
                onChange={e => setAddRepoInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const v = addRepoInput.trim();
                    if (v && !newGroupPaths.includes(v)) setNewGroupPaths(prev => [...prev, v]);
                    setAddRepoInput('');
                  }
                }}
                placeholder="Add repo path…"
                className="flex-1 h-6 px-2 rounded text-[10px] bg-[var(--bg-raised)] border border-[var(--border-subtle)] text-foreground placeholder:text-[var(--text-dim)] focus:outline-none focus:border-primary"
              />
              {selectedRepo && !newGroupPaths.includes(selectedRepo) && (
                <button
                  onClick={addCurrentToNewGroup}
                  title="Add current repo"
                  className="h-6 px-2 rounded text-[10px] text-[var(--text-dim)] hover:text-foreground hover:bg-[var(--bg-raised)] border border-[var(--border-subtle)] transition-colors"
                >cur</button>
              )}
            </div>
            <div className="flex gap-1 mt-2">
              <button onClick={() => setNewGroupOpen(false)} className="flex-1 h-6 rounded text-[10px] text-[var(--text-dim)] hover:text-foreground hover:bg-[var(--bg-raised)] transition-colors">Cancel</button>
              <button
                onClick={saveNewGroup}
                disabled={!newGroupName.trim() || newGroupPaths.length === 0}
                className="flex-1 h-6 rounded text-[10px] font-medium bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
              >Create</button>
            </div>
          </div>
        )}

        {groups.length === 0 && !newGroupOpen && (
          <p className="px-4 text-[10px]" style={{ color: 'var(--text-dim)' }}>No groups yet</p>
        )}

        {groups.map(g => (
          <div key={g.id}>
            {editingGroupId === g.id ? (
              /* ── Inline edit form ── */
              <div className="mx-2 mb-1.5 p-2.5 rounded-lg" style={{ background: 'color-mix(in oklch, var(--bg-raised) 50%, transparent)', border: '1px solid color-mix(in oklch, var(--border-subtle) 60%, transparent)' }}>
                <input
                  autoFocus
                  value={editGroupName}
                  onChange={e => setEditGroupName(e.target.value)}
                  placeholder="Group name…"
                  className="w-full h-7 px-2.5 rounded-md text-xs bg-[var(--bg-raised)] border border-[var(--border-subtle)] text-foreground placeholder:text-[var(--text-dim)] focus:outline-none focus:border-primary mb-2"
                />
                <p className="text-[10px] mb-1" style={{ color: 'var(--text-dim)' }}>Repos:</p>
                {editGroupPaths.map(p => (
                  <div key={p} className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] truncate flex-1 font-medium" style={{ color: 'var(--text-soft)' }}>{p.split('/').pop()}</span>
                    <button onClick={() => setEditGroupPaths(prev => prev.filter(x => x !== p))} className="text-[10px] text-[var(--text-dim)] hover:text-rose-400 flex-shrink-0">✕</button>
                  </div>
                ))}
                <div className="flex gap-1 mt-1.5">
                  <input
                    value={editAddInput}
                    onChange={e => setEditAddInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const v = editAddInput.trim();
                        if (v && !editGroupPaths.includes(v)) setEditGroupPaths(prev => [...prev, v]);
                        setEditAddInput('');
                      }
                    }}
                    placeholder="Add repo path…"
                    className="flex-1 h-6 px-2 rounded text-[10px] bg-[var(--bg-raised)] border border-[var(--border-subtle)] text-foreground placeholder:text-[var(--text-dim)] focus:outline-none focus:border-primary"
                  />
                  {selectedRepo && !editGroupPaths.includes(selectedRepo) && (
                    <button
                      onClick={() => setEditGroupPaths(prev => [...prev, selectedRepo!])}
                      title="Add current repo"
                      className="h-6 px-2 rounded text-[10px] text-[var(--text-dim)] hover:text-foreground hover:bg-[var(--bg-raised)] border border-[var(--border-subtle)] transition-colors"
                    >cur</button>
                  )}
                </div>
                <div className="flex gap-1 mt-2">
                  <button onClick={() => setEditingGroupId(null)} className="flex-1 h-6 rounded text-[10px] text-[var(--text-dim)] hover:text-foreground hover:bg-[var(--bg-raised)] transition-colors">Cancel</button>
                  <button
                    onClick={saveEditGroup}
                    disabled={!editGroupName.trim() || editGroupPaths.length === 0}
                    className="flex-1 h-6 rounded text-[10px] font-medium bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                  >Save</button>
                </div>
              </div>
            ) : (
              /* ── Group row + accordion ── */
              <>
              <div className="group/row flex items-center gap-2 mx-2 px-2 py-1 rounded-lg cursor-pointer transition-colors"
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'color-mix(in oklch, var(--bg-raised) 50%, transparent)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                onClick={() => toggleGroupExpand(g)}
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0" style={{ color: 'var(--primary)' }}>
                  <rect x="1" y="1" width="5.5" height="5.5" rx="1"/><rect x="9.5" y="1" width="5.5" height="5.5" rx="1"/>
                  <rect x="1" y="9.5" width="5.5" height="5.5" rx="1"/><rect x="9.5" y="9.5" width="5.5" height="5.5" rx="1"/>
                </svg>
                <span className="text-xs font-medium truncate flex-1" style={{ color: 'var(--foreground)' }}>{g.name}</span>
                <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" className="flex-shrink-0 transition-transform duration-150"
                  style={{ color: 'var(--text-dim)', transform: expandedGroupId === g.id ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                  <path d="M2 1l4 3-4 3z"/>
                </svg>
                <button
                  onClick={e => { e.stopPropagation(); openEditGroup(g); }}
                  title="Edit group"
                  className="opacity-0 group-hover/row:opacity-100 transition-all w-4 h-4 flex items-center justify-center rounded hover:text-foreground flex-shrink-0"
                  style={{ color: 'var(--text-dim)' }}
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8.5 1.5l2 2L3 11H1v-2L8.5 1.5z"/>
                  </svg>
                </button>
                <button
                  onClick={e => { e.stopPropagation(); deleteGroup(g.id); }}
                  title="Delete group"
                  className="opacity-0 group-hover/row:opacity-100 hover:text-rose-500 transition-all text-[10px] w-4 flex-shrink-0"
                  style={{ color: 'var(--text-dim)' }}
                >✕</button>
              </div>
              {/* Accordion: repo status rows */}
              {expandedGroupId === g.id && (
                <div className="mx-2 mb-1">
                  {groupLoading === g.id
                    ? g.repoPaths.map(p => (
                      <div key={p} className="h-7 mb-0.5 rounded-lg animate-pulse" style={{ background: 'color-mix(in oklch, var(--bg-raised) 40%, transparent)' }} />
                    ))
                    : (groupStatuses[g.id] || []).map(s => (
                      <div
                        key={s.path}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg cursor-pointer transition-colors"
                        style={{ background: selectedRepo === s.path ? 'color-mix(in oklch, var(--primary) 10%, transparent)' : undefined }}
                        onMouseEnter={e => { if (selectedRepo !== s.path) (e.currentTarget as HTMLElement).style.background = 'color-mix(in oklch, var(--bg-raised) 50%, transparent)'; }}
                        onMouseLeave={e => { if (selectedRepo !== s.path) (e.currentTarget as HTMLElement).style.background = ''; }}
                        onClick={() => onRepoSelect(s.path)}
                      >
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0" style={{ color: 'var(--text-dim)' }}>
                          <circle cx="5" cy="3.5" r="1.5"/><circle cx="5" cy="12.5" r="1.5"/><circle cx="11" cy="3.5" r="1.5"/>
                          <line x1="5" y1="5" x2="5" y2="11"/><path d="M5 6a3 3 0 003 3h2"/>
                        </svg>
                        <span className="text-[11px] font-medium truncate flex-1" style={{ color: selectedRepo === s.path ? 'var(--primary)' : 'var(--foreground)' }}>{s.name}</span>
                        {s.error
                          ? <span className="text-[9px]" style={{ color: 'oklch(0.65 0.2 25)' }}>err</span>
                          : <>
                            {s.dirty && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'oklch(0.75 0.18 80)' }} title="Has uncommitted changes" />}
                            {s.behind > 0 && <span className="text-[9px] font-semibold flex-shrink-0" style={{ color: 'var(--primary)' }}>↓{s.behind}</span>}
                            {s.ahead > 0 && <span className="text-[9px] font-semibold flex-shrink-0" style={{ color: 'oklch(0.74 0.15 80)' }}>↑{s.ahead}</span>}
                            <span className="text-[9px] truncate flex-shrink-0 max-w-[48px]" style={{ color: 'var(--text-dim)' }}>{s.branch}</span>
                          </>
                        }
                      </div>
                    ))
                  }
                  <button
                    onClick={e => { e.stopPropagation(); fetchGroupStatuses(g); }}
                    className="w-full text-center text-[9px] py-0.5 rounded transition-colors mt-0.5"
                    style={{ color: 'var(--text-dim)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--foreground)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'}
                  >↺ refresh</button>
                </div>
              )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-0.5 px-4 py-2" style={{ borderBottom: '1px solid color-mix(in oklch, var(--border-subtle) 60%, transparent)' }}>
        {isWindows ? null : (
          <button onClick={() => { setCur('~'); load('~'); }}
            className="text-[11px] font-medium transition-colors text-blue-500 hover:text-blue-400">~</button>
        )}
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center">
            <span className="mx-0.5 text-[11px]" style={{ color: 'var(--text-dim)' }}>{sep}</span>
            <button onClick={() => nav(i)} className="text-[11px] font-medium transition-colors text-blue-500 hover:text-blue-400 break-all">{c}</button>
          </span>
        ))}
        <label className="ml-auto flex items-center gap-1.5 cursor-pointer select-none flex-shrink-0">
          <input
            type="checkbox"
            checked={showIgnored}
            onChange={e => setShowIgnored(e.target.checked)}
            className="w-3 h-3 accent-blue-500"
          />
          <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>ignored</span>
        </label>
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto py-1.5 px-2">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-7 mb-0.5 rounded-lg" style={{ background: 'color-mix(in oklch, var(--bg-raised) 50%, transparent)' }} />
          ))
          : entries.filter(e => showIgnored || !e.isIgnored).map(e => (
            <div key={e.path}
              className="group flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors"
              style={{
                background: selectedRepo === e.path ? 'color-mix(in oklch, var(--primary) 10%, transparent)' : undefined,
                outline: selectedRepo === e.path ? '1px solid color-mix(in oklch, var(--primary) 20%, transparent)' : undefined,
                opacity: e.isIgnored ? 0.45 : 1,
              }}
              onMouseEnter={ev => { if (selectedRepo !== e.path) (ev.currentTarget as HTMLElement).style.background = 'color-mix(in oklch, var(--bg-raised) 50%, transparent)'; }}
              onMouseLeave={ev => { if (selectedRepo !== e.path) (ev.currentTarget as HTMLElement).style.background = ''; }}
              onClick={() => go(e)}
              onContextMenu={ev => openCtxMenu(ev, e)}
              title={e.path}
            >
              {e.isGitRepo ? <RepoIcon /> : e.isDirectory ? <FolderIcon className="text-[var(--text-soft)]" /> : <FileIcon name={e.name} />}
              <span className="text-xs truncate flex-1 font-medium"
                style={{ color: selectedRepo === e.path ? 'var(--primary)' : e.isDirectory ? 'var(--foreground)' : 'var(--text-dim)' }}>
                {e.name}
              </span>
              {e.isDirectory && (
                <button
                  onClick={ev => { ev.stopPropagation(); if (isPinned(e.path)) unpin(e.path); else pin(e); }}
                  title={isPinned(e.path) ? 'Unpin' : 'Pin to top'}
                  className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-[var(--text-dim)] hover:text-[var(--primary)]"
                >
                  {isPinned(e.path) ? <PinOffIcon /> : <PinIcon />}
                </button>
              )}
              {e.isGitRepo && (
                e.branch && !['main', 'master'].includes(e.branch) ? (
                  <span title={e.branch} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-600 border border-blue-500/20 flex-shrink-0 max-w-[80px] truncate">
                    {e.branch}
                  </span>
                ) : (
                  <span title={e.branch} className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0 max-w-[80px] truncate" style={{ background: 'color-mix(in oklch, var(--text-dim) 10%, transparent)', color: 'var(--text-dim)', border: '1px solid color-mix(in oklch, var(--text-dim) 20%, transparent)' }}>
                    {e.branch ?? 'GIT'}
                  </span>
                )
              )}
              {e.isIgnored && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: 'color-mix(in oklch, var(--text-dim) 10%, transparent)', color: 'var(--text-dim)', border: '1px solid color-mix(in oklch, var(--text-dim) 20%, transparent)' }}>
                  ignored
                </span>
              )}
            </div>
          ))
        }
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <div
          ref={ctxRef}
          className="fixed z-50 py-1 rounded-xl shadow-xl min-w-[190px]"
          style={{
            left: ctxMenu.x,
            top: ctxMenu.y,
            background: 'var(--bg-panel)',
            border: '1px solid color-mix(in oklch, var(--border-subtle) 80%, transparent)',
            boxShadow: '0 8px 32px color-mix(in oklch, black 30%, transparent)',
          }}
          onClick={e => e.stopPropagation()}
        >
          <CtxItem icon={<CopyIcon />} label="Copy Path" onClick={() => copyPath(ctxMenu.entry.path)} />
          <CtxDivider />
          {ctxMenu.entry.isDirectory && (
            <>
              {isPinned(ctxMenu.entry.path)
                ? <CtxItem icon={<PinOffIcon />} label="Unpin" onClick={() => { unpin(ctxMenu.entry.path); setCtxMenu(null); }} />
                : <CtxItem icon={<PinIcon />} label="Pin" onClick={() => { pin(ctxMenu.entry); setCtxMenu(null); }} />
              }
              {ctxMenu.entry.isGitRepo && groups.length > 0 && (
                <div className="relative">
                  <button
                    className="flex items-center gap-2.5 w-full px-3 py-1.5 text-xs text-left transition-colors"
                    style={{ color: 'var(--text-soft)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'color-mix(in oklch, var(--bg-raised) 60%, transparent)'; setCtxGroupSubmenu(true); }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}
                  >
                    <span className="flex-shrink-0 opacity-70">
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="1" y="1" width="5.5" height="5.5" rx="1"/><rect x="9.5" y="1" width="5.5" height="5.5" rx="1"/>
                        <rect x="1" y="9.5" width="5.5" height="5.5" rx="1"/><rect x="9.5" y="9.5" width="5.5" height="5.5" rx="1"/>
                      </svg>
                    </span>
                    <span className="flex-1">Add to group</span>
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" className="opacity-50"><path d="M2 1l4 3-4 3z"/></svg>
                  </button>
                  {ctxGroupSubmenu && (
                    <div
                      className="absolute left-full top-0 z-50 py-1 rounded-xl shadow-xl min-w-[160px]"
                      style={{
                        background: 'var(--bg-panel)',
                        border: '1px solid color-mix(in oklch, var(--border-subtle) 80%, transparent)',
                        boxShadow: '0 8px 32px color-mix(in oklch, black 30%, transparent)',
                      }}
                      onMouseEnter={() => setCtxGroupSubmenu(true)}
                      onMouseLeave={() => setCtxGroupSubmenu(false)}
                    >
                      {groups.map(g => {
                        const already = g.repoPaths.includes(ctxMenu.entry.path);
                        return (
                          <button
                            key={g.id}
                            disabled={already}
                            onClick={() => { addRepoToGroup(g.id, ctxMenu.entry.path); setCtxMenu(null); setCtxGroupSubmenu(false); }}
                            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ color: 'var(--text-soft)' }}
                            onMouseEnter={e => { if (!already) (e.currentTarget as HTMLElement).style.background = 'color-mix(in oklch, var(--bg-raised) 60%, transparent)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}
                          >
                            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 opacity-60">
                              <rect x="1" y="1" width="5.5" height="5.5" rx="1"/><rect x="9.5" y="1" width="5.5" height="5.5" rx="1"/>
                              <rect x="1" y="9.5" width="5.5" height="5.5" rx="1"/><rect x="9.5" y="9.5" width="5.5" height="5.5" rx="1"/>
                            </svg>
                            <span className="truncate flex-1">{g.name}</span>
                            {already && <span className="text-[9px] opacity-50">added</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              <CtxDivider />
              {compareLeft && compareLeft.path !== ctxMenu.entry.path ? (
                <>
                  <CtxItem
                    icon={<CompareIcon />}
                    label={`Compare with "${compareLeft.name}"`}
                    onClick={() => compareWith(ctxMenu.entry)}
                    accent="oklch(0.65 0.18 140)"
                  />
                  <CtxItem icon={<LeftIcon />} label="Set as Left folder" hint="replace current compare target" onClick={() => setAsLeft(ctxMenu.entry)} />
                  <CtxItem icon={<XIcon />} label="Clear left folder" onClick={clearLeft} />
                </>
              ) : (
                <CtxItem icon={<LeftIcon />} label="Set as Left folder" hint="then right-click another folder to compare" onClick={() => setAsLeft(ctxMenu.entry)} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CtxItem({ icon, label, hint, onClick, accent }: { icon: React.ReactNode; label: string; hint?: string; onClick: () => void; accent?: string }) {
  return (
    <button
      className="flex items-center gap-2.5 w-full px-3 py-1.5 text-xs text-left transition-colors"
      style={{ color: accent || 'var(--text-soft)' }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'color-mix(in oklch, var(--bg-raised) 60%, transparent)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
      onClick={onClick}
    >
      <span className="flex-shrink-0 opacity-70">{icon}</span>
      <span className="flex flex-col gap-0">
        <span>{label}</span>
        {hint && <span className="text-[10px] opacity-50 leading-tight">{hint}</span>}
      </span>
    </button>
  );
}

function CtxDivider() {
  return <div className="my-1 mx-2" style={{ borderTop: '1px solid color-mix(in oklch, var(--border-subtle) 60%, transparent)' }} />;
}

function FolderIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className={`flex-shrink-0 ${className}`}>
      <path d="M1 3.5A1.5 1.5 0 012.5 2h3.764c.69 0 1.35.28 1.837.78L9 3.5h4.5A1.5 1.5 0 0115 5v7.5A1.5 1.5 0 0113.5 14h-11A1.5 1.5 0 011 12.5v-9z"/>
    </svg>
  );
}

function RepoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-500 flex-shrink-0">
      <circle cx="5" cy="3.5" r="1.5"/><circle cx="5" cy="12.5" r="1.5"/>
      <circle cx="11" cy="3.5" r="1.5"/>
      <line x1="5" y1="5" x2="5" y2="11"/><path d="M5 6a3 3 0 003 3h2"/>
    </svg>
  );
}

function FileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const colors: Record<string, string> = {
    ts: 'text-blue-500', tsx: 'text-blue-500',
    js: 'text-amber-500', jsx: 'text-amber-500',
    py: 'text-emerald-500', go: 'text-cyan-500',
    rs: 'text-orange-500', css: 'text-pink-500',
    md: 'text-[var(--text-soft)]', json: 'text-yellow-500',
  };
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className={`flex-shrink-0 ${colors[ext] || 'text-[var(--text-dim)]'}`}>
      <path d="M4 0h5.5l4.5 4.5V14a2 2 0 01-2 2H4a2 2 0 01-2-2V2a2 2 0 012-2zm5 0v4.5H14L9 0z"/>
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M3 11H2a1 1 0 01-1-1V2a1 1 0 011-1h8a1 1 0 011 1v1"/>
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 1.5l5 5-3 1-3 3 1 3-6-6 3-1z"/><line x1="1" y1="15" x2="5.5" y2="10.5"/>
    </svg>
  );
}

function PinOffIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 1.5l5 5-3 1-3 3 1 3-6-6 3-1z"/><line x1="1" y1="15" x2="5.5" y2="10.5"/><line x1="1" y1="1" x2="15" y2="15"/>
    </svg>
  );
}

function LeftIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="2" width="14" height="12" rx="1.5"/><line x1="8" y1="2" x2="8" y2="14"/>
    </svg>
  );
}

function CompareIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3L1 8l4 5"/><path d="M11 3l4 5-4 5"/>
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/>
    </svg>
  );
}
