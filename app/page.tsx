'use client';

import { useEffect, useCallback, useState } from 'react';
import FolderPanel from '@/components/panels/FolderPanel';
import GitPanel from '@/components/panels/GitPanel';
import DiffPanel from '@/components/panels/DiffPanel';
import InlineCompare from '@/components/git/InlineCompare';
import TopBar from '@/components/TopBar';
import UserGuideModal, { useUserGuide } from '@/components/UserGuideModal';
import { COMMAND_EVENT } from '@/components/CommandPalette';

const LAST_REPO_KEY = 'git-browser-last-repo';

export default function Home() {
  const [repo, setRepo] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAST_REPO_KEY);
      if (saved) setRepo(saved);
    } catch {}
  }, []);
  const [activeTab, setActiveTab] = useState('log');
  const [selectedFile, setSelectedFile] = useState<string | undefined>();
  const [selectedFileStaged, setSelectedFileStaged] = useState(false);
  const [selectedCommit, setSelectedCommit] = useState<string | undefined>();
  const [showDiff, setShowDiff] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const { guideOpen, openGuide, closeGuide } = useUserGuide();
  const [clonedRepo, setClonedRepo] = useState<string | null>(null);
  const [compareBase, setCompareBase] = useState<string | null>(null); // null = off, string = compare mode

  const handleRepoSelect = (path: string) => {
    setRepo(path);
    setSelectedFile(undefined);
    setSelectedCommit(undefined);
    localStorage.setItem(LAST_REPO_KEY, path);
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return; // don't hijack browser shortcuts like ⌘P
    if (e.key.toLowerCase() === 'r' && repo) { const r = repo; setRepo(null); setTimeout(() => setRepo(r), 50); }
    else if (e.key.toLowerCase() === 'b') setActiveTab('branches');
    else if (e.key.toLowerCase() === 'l') setActiveTab('log');
    else if (e.key.toLowerCase() === 'c') setActiveTab('changes');
    else if (e.key.toLowerCase() === 'd') setShowDiff(v => !v);
    else if (e.key.toLowerCase() === 'e') setShowSidebar(v => !v);
    else if (e.key.toLowerCase() === 'p' && repo) window.dispatchEvent(new CustomEvent(COMMAND_EVENT, { detail: 'sync:push' }));
    else if (e.key.toLowerCase() === 'u' && repo) window.dispatchEvent(new CustomEvent(COMMAND_EVENT, { detail: 'sync:pull' }));
    else if (e.key.toLowerCase() === 't' && repo) window.dispatchEvent(new CustomEvent(COMMAND_EVENT, { detail: 'tag:new' }));
  }, [repo]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Commands from the global palette (⌘K)
  useEffect(() => {
    const fn = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (id.startsWith('tab:')) setActiveTab(id.slice(4));
      else if (id === 'tag:new') {
        // Branches tab must mount before BranchList can receive the dialog-open event
        setActiveTab('branches');
        setTimeout(() => window.dispatchEvent(new CustomEvent(COMMAND_EVENT, { detail: 'tag:open-dialog' })), 200);
      }
      else if (id === 'toggle:diff') setShowDiff(v => !v);
      else if (id === 'toggle:explorer') setShowSidebar(v => !v);
      else if (id === 'guide') openGuide();
      else if (id === 'refresh' && repo) { const r = repo; setRepo(null); setTimeout(() => setRepo(r), 50); }
      else if (id.startsWith('repo:')) handleRepoSelect(id.slice(5));
    };
    window.addEventListener(COMMAND_EVENT, fn);
    return () => window.removeEventListener(COMMAND_EVENT, fn);
  }, [repo, openGuide]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden">
      <TopBar repo={repo} onRepoSelect={handleRepoSelect} onCloned={setClonedRepo} onOpenGuide={openGuide} />

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left — file explorer (collapsible) */}
        <aside className={`flex-shrink-0 flex flex-col border-r border-[var(--border-subtle)]/60 bg-[var(--bg-panel)] transition-all duration-200 overflow-hidden ${showSidebar ? 'w-52' : 'w-0 border-r-0'}`}>
          <div className="w-52 flex flex-col h-full">
            <SectionHeader onToggle={() => setShowSidebar(false)} />
            <FolderPanel onRepoSelect={handleRepoSelect} selectedRepo={repo} navigateTo={clonedRepo} />
          </div>
        </aside>

        {compareBase !== null ? (
          /* ── Compare mode: replaces both Repository and Diff panels ── */
          <section className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
            <InlineCompare
              repo={repo || ''}
              initialBase={compareBase}
              onClose={() => setCompareBase(null)}
            />
          </section>
        ) : (
          <>
            {/* Middle — git panel */}
            <section className={`flex flex-col border-r border-[var(--border-subtle)]/60 bg-[var(--bg-panel)] min-h-0 transition-all duration-200 ${showDiff ? 'w-[320px] flex-shrink-0' : 'flex-1'}`}>
              <div className="h-9 flex items-center justify-between px-2 border-b border-[var(--border-subtle)]/60 flex-shrink-0 gap-1">
                <div className="flex items-center gap-1">
                  {!showSidebar && (
                    <button
                      onClick={() => setShowSidebar(true)}
                      title="Show explorer (E)"
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[var(--text-dim)] hover:text-foreground hover:bg-[var(--bg-raised)] transition-colors"
                    >
                      <SidebarIcon open={false} />
                      <span className="text-[10px] font-medium">Explorer</span>
                    </button>
                  )}
                  {showSidebar && (
                    <span className="text-[10px] font-semibold tracking-widest text-[var(--text-dim)] uppercase px-2">Repository</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {/* Git Compare shortcut */}
                  {repo && (
                    <button
                      onClick={() => setCompareBase('')}
                      title="Compare branches / commits"
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-[var(--text-dim)] hover:text-foreground hover:bg-[var(--bg-raised)] transition-colors"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="4" cy="3" r="1.5"/><circle cx="4" cy="13" r="1.5"/><circle cx="12" cy="3" r="1.5"/>
                        <line x1="4" y1="4.5" x2="4" y2="11.5"/><path d="M4 7a4 4 0 004 4h3"/>
                      </svg>
                      <span className="text-[10px] font-medium">Compare</span>
                    </button>
                  )}
                  {/* Toggle diff panel */}
                  <button
                    onClick={() => setShowDiff(v => !v)}
                    title={showDiff ? 'Hide diff panel (D)' : 'Show diff panel (D)'}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[var(--text-dim)] hover:text-foreground hover:bg-[var(--bg-raised)] transition-colors"
                  >
                    <PanelIcon open={showDiff} />
                    <span className="text-[10px] font-medium">{showDiff ? 'Hide diff' : 'Show diff'}</span>
                  </button>
                </div>
              </div>
              <GitPanel
                repo={repo || ''}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onFileSelect={(f, s) => { setSelectedFile(f); setSelectedFileStaged(s); setSelectedCommit(undefined); if (!showDiff) setShowDiff(true); }}
                onCommitSelect={(h) => { setSelectedCommit(h); setSelectedFile(undefined); if (!showDiff) setShowDiff(true); }}
                onCommitFileSelect={(h, f) => { setSelectedCommit(h); setSelectedFile(f); if (!showDiff) setShowDiff(true); }}
                selectedFile={selectedFile}
                selectedCommit={selectedCommit}
                onCompare={(branch) => { setCompareBase(branch); }}
              />
            </section>

            {/* Right — diff (collapsible) */}
            {showDiff && (
              <section className="flex-1 flex flex-col min-h-0 min-w-0 bg-background">
                <div className="h-9 flex items-center justify-between px-4 border-b border-[var(--border-subtle)]/60 flex-shrink-0">
                  <span className="text-[10px] font-semibold tracking-widest text-[var(--text-dim)] uppercase">Diff</span>
                  <button
                    onClick={() => setShowDiff(false)}
                    title="Hide diff panel (D)"
                    className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--text-dim)] hover:text-foreground hover:bg-[var(--bg-raised)] transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M9 3L3 9M3 3l6 6"/>
                    </svg>
                  </button>
                </div>
                <DiffPanel repo={repo || ''} file={selectedFile} commit={selectedCommit} staged={selectedFileStaged} />
              </section>
            )}
          </>
        )}
      </div>

      {/* Status bar */}
      <footer className="h-6 flex items-center gap-4 px-4 text-[10px] font-medium tracking-wide flex-shrink-0" style={{ background: 'var(--statusbar-bg)', color: 'oklch(0.97 0 0)' }}>
        <span className="font-semibold">⌘K — all commands</span>
        <span className="opacity-40">·</span>
        <span>R refresh · E explorer · D diff · B/L/C tabs · U pull · P push · T tag</span>
        <div className="ml-auto flex items-center gap-3">
          <a href="https://github.com/lijo-jose" target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-100 transition-opacity flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
            lijo-jose
          </a>
          <span className="opacity-40">·</span>
          <a href="https://ai.lijojose.com" target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-100 transition-opacity">
            ai.lijojose.com
          </a>
        </div>
      </footer>

      <UserGuideModal open={guideOpen} onClose={closeGuide} />
    </div>
  );
}

function SectionHeader({ onToggle }: { onToggle: () => void }) {
  return (
    <div className="h-9 flex items-center justify-between px-4 border-b border-[var(--border-subtle)]/60 flex-shrink-0">
      <span className="text-[10px] font-semibold tracking-widest text-[var(--text-dim)] uppercase">Explorer</span>
      <button
        onClick={onToggle}
        title="Hide explorer (E)"
        className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--text-dim)] hover:text-foreground hover:bg-[var(--bg-raised)] transition-colors"
      >
        <SidebarIcon open={true} />
      </button>
    </div>
  );
}

function SidebarIcon({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1" width="14" height="14" rx="2"/>
      <line x1="5" y1="1" x2="5" y2="15"/>
      {open
        ? <path d="M3 5.5L0.5 8 3 10.5" transform="translate(0.5,0)"/>
        : <path d="M7 5.5L9.5 8 7 10.5" transform="translate(0.5,0)"/>
      }
    </svg>
  );
}

function PanelIcon({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1" width="14" height="14" rx="2"/>
      <line x1="9" y1="1" x2="9" y2="15"/>
      {open
        ? <path d="M12 5.5l2.5 2.5-2.5 2.5"/>
        : <path d="M11 5.5L8.5 8 11 10.5"/>
      }
    </svg>
  );
}
