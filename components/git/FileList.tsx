'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface GitFile { path: string; status: string; staged: boolean; }
interface Props { repo: string; onFileSelect: (f: string, s: boolean) => void; selectedFile?: string; }

const S: Record<string, { cls: string; label: string }> = {
  M: { cls: 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/25', label: 'M' },
  A: { cls: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25', label: 'A' },
  D: { cls: 'bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/25', label: 'D' },
  '?': { cls: 'bg-zinc-800 text-zinc-500', label: '?' },
  R: { cls: 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/25', label: 'R' },
  U: { cls: 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/25', label: 'U' },
};

export default function FileList({ repo, onFileSelect, selectedFile }: Props) {
  const [files, setFiles] = useState<GitFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [staging, setStaging] = useState(false);
  const [commitOpen, setCommitOpen] = useState(false);
  const [pushOpen, setPushOpen] = useState(false);
  const [commitMsg, setCommitMsg] = useState('');
  const [commitAll, setCommitAll] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushSetUpstream, setPushSetUpstream] = useState(false);
  const [pushBranchName, setPushBranchName] = useState('');
  const msgRef = useRef<HTMLTextAreaElement>(null);

  const load = () => {
    if (!repo) return;
    setLoading(true); setError('');
    fetch(`/api/git/status?repo=${encodeURIComponent(repo)}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setFiles(d.files || []); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [repo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch current branch name for push upstream default
  useEffect(() => {
    if (!repo) return;
    fetch(`/api/git/branches?repo=${encodeURIComponent(repo)}`)
      .then(r => r.json())
      .then(d => {
        const cur = (d.branches || []).find((b: { current: boolean; name: string }) => b.current);
        if (cur) setPushBranchName(cur.name);
      }).catch(() => {});
  }, [repo]);

  const toggleSelect = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const stageSelected = async () => {
    const filePaths = [...selected];
    if (!filePaths.length) return;
    setStaging(true);
    try {
      const res = await fetch('/api/git/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo, files: filePaths }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success('Staged', { description: `${filePaths.length} file(s) staged` });
      setSelected(new Set());
      load();
    } catch (e) {
      toast.error('Stage failed', { description: String(e) });
    } finally { setStaging(false); }
  };

  const doCommit = async () => {
    if (!commitMsg.trim()) { msgRef.current?.focus(); return; }
    setCommitting(true);
    try {
      const res = await fetch('/api/git/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo, message: commitMsg, all: commitAll }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success('Committed', { description: data.result });
      setCommitOpen(false);
      setCommitMsg('');
      setCommitAll(false);
      load();
    } catch (e) {
      toast.error('Commit failed', { description: String(e) });
    } finally { setCommitting(false); }
  };

  const doPush = async () => {
    setPushing(true);
    try {
      const res = await fetch('/api/git/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo, setUpstream: pushSetUpstream, branch: pushBranchName }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success('Pushed', { description: data.result });
      setPushOpen(false);
      setPushSetUpstream(false);
    } catch (e) {
      toast.error('Push failed', { description: String(e) });
    } finally { setPushing(false); }
  };

  if (loading) return (
    <div className="p-3 space-y-1">
      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 rounded-lg bg-zinc-800/50" />)}
    </div>
  );
  if (error) return <p className="p-4 text-rose-400 text-xs">{error}</p>;

  const staged = files.filter(f => f.staged);
  const unstaged = files.filter(f => !f.staged);
  const hasFiles = files.length > 0;
  const allKeys = files.map(f => f.path);
  const allSelected = allKeys.length > 0 && allKeys.every(k => selected.has(k));
  const someSelected = allKeys.some(k => selected.has(k)) && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allKeys));
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* File list */}
      <div className="flex-1 overflow-y-auto py-2 min-h-0">
        {!hasFiles && <Empty label="Working tree clean" />}
        {staged.length > 0 && (
          <Section label="Staged" files={staged} selected={selected} selectedFile={selectedFile}
            onFileSelect={onFileSelect} onToggle={toggleSelect}
            onToggleAll={keys => {
              const allIn = keys.every(k => selected.has(k));
              setSelected(prev => {
                const next = new Set(prev);
                if (allIn) keys.forEach(k => next.delete(k)); else keys.forEach(k => next.add(k));
                return next;
              });
            }}
          />
        )}
        {unstaged.length > 0 && (
          <Section label="Unstaged" files={unstaged} selected={selected} selectedFile={selectedFile}
            onFileSelect={onFileSelect} onToggle={toggleSelect}
            onToggleAll={keys => {
              const allIn = keys.every(k => selected.has(k));
              setSelected(prev => {
                const next = new Set(prev);
                if (allIn) keys.forEach(k => next.delete(k)); else keys.forEach(k => next.add(k));
                return next;
              });
            }}
          />
        )}
      </div>

      {/* Action bar */}
      {hasFiles && (
        <div className="flex-shrink-0 border-t border-zinc-800/60 px-3 py-2 flex items-center gap-2">
          {/* Select all checkbox */}
          <label className="flex items-center gap-1.5 cursor-pointer mr-1" title="Select / deselect all">
            <input
              type="checkbox"
              checked={allSelected}
              ref={el => { if (el) el.indeterminate = someSelected; }}
              onChange={toggleAll}
              className="w-3 h-3 accent-blue-500 cursor-pointer"
            />
            <span className="text-[10px] text-zinc-600 font-medium select-none">All</span>
          </label>
          <button
            disabled={selected.size === 0 || staging}
            onClick={stageSelected}
            className="h-7 px-3 rounded-md text-xs font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {staging ? '…' : `Stage${selected.size > 0 ? ` (${selected.size})` : ''}`}
          </button>
          <button
            onClick={() => setCommitOpen(true)}
            className="h-7 px-3 rounded-md text-xs font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            Commit…
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setPushOpen(true)}
            className="h-7 px-3 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors"
          >
            Push…
          </button>
        </div>
      )}

      {/* Commit modal */}
      <Dialog open={commitOpen} onOpenChange={setCommitOpen}>
        <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Commit changes</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-1">
            <textarea
              ref={msgRef}
              value={commitMsg}
              onChange={e => setCommitMsg(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) doCommit(); }}
              placeholder="Commit message…"
              rows={4}
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/60"
            />
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={commitAll}
                onChange={e => setCommitAll(e.target.checked)}
                className="w-3.5 h-3.5 accent-blue-500"
              />
              <span className="text-xs text-zinc-400"><code className="text-zinc-300">-a</code> — stage all tracked modified files</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommitOpen(false)} className="text-xs h-8">
              Cancel
            </Button>
            <Button
              onClick={doCommit}
              disabled={!commitMsg.trim() || committing}
              className="text-xs h-8 bg-blue-600 hover:bg-blue-500 text-white"
            >
              {committing ? 'Committing…' : 'Commit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Push modal */}
      <Dialog open={pushOpen} onOpenChange={setPushOpen}>
        <DialogContent className="sm:max-w-sm bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Push</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={pushSetUpstream}
                onChange={e => setPushSetUpstream(e.target.checked)}
                className="w-3.5 h-3.5 accent-blue-500"
              />
              <span className="text-xs text-zinc-400">Create branch in origin (<code className="text-zinc-300">--set-upstream</code>)</span>
            </label>
            {pushSetUpstream && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">Branch name</label>
                <input
                  type="text"
                  value={pushBranchName}
                  onChange={e => setPushBranchName(e.target.value)}
                  className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500/60"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPushOpen(false)} className="text-xs h-8">
              Cancel
            </Button>
            <Button
              onClick={doPush}
              disabled={pushing || (pushSetUpstream && !pushBranchName.trim())}
              className="text-xs h-8 bg-blue-600 hover:bg-blue-500 text-white"
            >
              {pushing ? 'Pushing…' : pushSetUpstream ? `Push & set upstream` : 'Push'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ label, files, selected, selectedFile, onFileSelect, onToggle, onToggleAll }: {
  label: string;
  files: GitFile[];
  selected: Set<string>;
  selectedFile?: string;
  onFileSelect: (f: string, s: boolean) => void;
  onToggle: (key: string) => void;
  onToggleAll: (keys: string[]) => void;
}) {
  const keys = files.map(f => f.path);
  const allIn = keys.length > 0 && keys.every(k => selected.has(k));
  const someIn = keys.some(k => selected.has(k)) && !allIn;
  return (
    <div className="mb-1">
      <div className="flex items-center gap-2 px-4 py-1">
        <input
          type="checkbox"
          checked={allIn}
          ref={el => { if (el) el.indeterminate = someIn; }}
          onChange={() => onToggleAll(keys)}
          className="w-3 h-3 accent-blue-500 cursor-pointer"
        />
        <p className="text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">{label}</p>
      </div>
      {files.map(f => {
        const style = S[f.status] || S['M'];
        const isSelected = selectedFile === f.path;
        const key = f.path;
        const checked = selected.has(key);
        return (
          <div key={`${f.path}-${f.staged}`}
            className={`flex items-center gap-2 mx-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
              isSelected ? 'bg-blue-500/10 ring-1 ring-blue-500/20' : 'hover:bg-zinc-800/50'
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(key)}
              onClick={e => e.stopPropagation()}
              className="w-3 h-3 accent-blue-500 flex-shrink-0 cursor-pointer"
            />
            <span className={`text-[10px] font-bold w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${style.cls}`}>
              {style.label}
            </span>
            <span
              className={`text-xs truncate font-medium flex-1 min-w-0 ${isSelected ? 'text-zinc-100' : 'text-zinc-400'}`}
              onClick={() => onFileSelect(f.path, f.staged)}
            >
              {f.path.split('/').pop()}
            </span>
            <span
              className={`text-[10px] truncate hidden sm:block min-w-0 ${isSelected ? 'text-zinc-500' : 'text-zinc-600'}`}
              onClick={() => onFileSelect(f.path, f.staged)}
            >
              {f.path.includes('/') ? f.path.split('/').slice(0, -1).join('/') : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-xs text-zinc-700 font-medium">{label}</p>
    </div>
  );
}
