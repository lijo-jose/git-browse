'use client';

import { useEffect, useState } from 'react';

const GUIDE_SEEN_KEY = 'git-browser-guide-seen';

interface UserGuideModalProps {
  open: boolean;
  onClose: () => void;
}

const SECTIONS = [
  {
    title: 'Keyboard Shortcuts',
    items: [
      { key: 'R', desc: 'Refresh the current repository' },
      { key: 'L', desc: 'Switch to Log tab' },
      { key: 'B', desc: 'Switch to Branches tab' },
      { key: 'C', desc: 'Switch to Changes tab' },
      { key: 'D', desc: 'Toggle the Diff panel' },
      { key: 'E', desc: 'Toggle the Explorer sidebar' },
    ],
  },
  {
    title: 'Panels',
    items: [
      { key: 'Explorer', desc: 'Left sidebar — browse and pin local git repos' },
      { key: 'Repository', desc: 'Middle panel — Log, Branches, Changes, and Info tabs' },
      { key: 'Diff', desc: 'Right panel — file diffs and commit details' },
    ],
  },
  {
    title: 'Toolbar Actions',
    items: [
      { key: 'Fetch', desc: 'Fetch latest refs from remote' },
      { key: 'Pull', desc: 'Pull latest commits from remote' },
      { key: 'Push', desc: 'Push local commits to remote' },
      { key: 'Tag', desc: 'Create and push a new tag; click ▾ to view existing tags' },
      { key: 'Recent', desc: 'Switch between recently opened repositories' },
      { key: 'Theme', desc: 'Switch between light, dark, and system themes' },
    ],
  },
  {
    title: 'Log Tab',
    items: [
      { key: 'Click commit', desc: 'Expand a commit to see all changed files; click again to collapse' },
      { key: 'Click file', desc: 'Open the file diff for that commit in the Diff panel' },
      { key: 'Graph', desc: 'Commit graph toolbar shows branch topology inline' },
    ],
  },
  {
    title: 'Branches Tab',
    items: [
      { key: 'Switch', desc: 'Click a branch to check it out' },
      { key: 'New branch', desc: 'Create a new branch from the current HEAD' },
      { key: 'Delete', desc: 'Delete a local branch from the branch list' },
    ],
  },
  {
    title: 'Changes Tab',
    items: [
      { key: 'Stage', desc: 'Stage individual files with git add' },
      { key: 'Discard', desc: 'Discard unstaged changes for a file' },
      { key: 'Commit', desc: 'Write a commit message and commit staged changes' },
      { key: 'Push', desc: 'Push the new commit to the remote after committing' },
    ],
  },
  {
    title: 'Info Tab',
    items: [
      { key: 'Remotes', desc: 'View configured remote URLs' },
      { key: 'HEAD', desc: 'Current branch and commit SHA' },
      { key: 'Stashes', desc: 'Count of stashed changes' },
    ],
  },
  {
    title: 'Tips',
    items: [
      { key: 'Pin repo', desc: 'Right-click a folder in Explorer to pin it for quick access' },
      { key: 'Clone', desc: 'Clone a remote repository directly from the Explorer sidebar' },
      { key: 'Last repo', desc: 'GitBrowse remembers the last opened repository across sessions' },
    ],
  },
];

export function useUserGuide() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(GUIDE_SEEN_KEY);
      if (!seen) setOpen(true);
    } catch {}
  }, []);

  const openGuide = () => setOpen(true);

  const closeGuide = () => {
    try { localStorage.setItem(GUIDE_SEEN_KEY, '1'); } catch {}
    setOpen(false);
  };

  return { guideOpen: open, openGuide, closeGuide };
}

export default function UserGuideModal({ open, onClose }: UserGuideModalProps) {
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-[540px] max-h-[80vh] flex flex-col bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                <circle cx="8" cy="8" r="7"/>
                <path d="M8 7v4M8 5v.5"/>
              </svg>
            </div>
            <span className="text-sm font-semibold text-foreground">GitBrowse User Guide</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-foreground hover:bg-[var(--bg-raised)] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 3L3 9M3 3l6 6"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {SECTIONS.map(section => (
            <div key={section.title}>
              <div className="text-[10px] font-semibold tracking-widest text-[var(--text-dim)] uppercase mb-2">
                {section.title}
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)]/60 overflow-hidden">
                {section.items.map((item, i) => (
                  <div
                    key={item.key}
                    className={`flex items-center gap-3 px-4 py-2.5 ${i !== 0 ? 'border-t border-[var(--border-subtle)]/40' : ''} hover:bg-[var(--bg-raised)] transition-colors`}
                  >
                    <kbd className="min-w-[56px] text-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-[var(--bg-raised)] border border-[var(--border-subtle)] text-foreground font-mono flex-shrink-0">
                      {item.key}
                    </kbd>
                    <span className="text-xs text-[var(--text-soft)]">{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border-subtle)]/60 flex items-center justify-between">
          <span className="text-xs text-[var(--text-dim)]">Press <kbd className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg-raised)] border border-[var(--border-subtle)] font-mono">Esc</kbd> to close</span>
          <button
            onClick={onClose}
            className="h-7 px-4 rounded-lg text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
