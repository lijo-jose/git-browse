'use client';

import { useEffect, useCallback, useState } from 'react';
import FolderPanel from '@/components/panels/FolderPanel';
import GitPanel from '@/components/panels/GitPanel';
import DiffPanel from '@/components/panels/DiffPanel';
import InlineCompare from '@/components/git/InlineCompare';
import TopBar from '@/components/TopBar';
import UserGuideModal, { useUserGuide } from '@/components/UserGuideModal';
import DirPicker from '@/components/ui/DirPicker';
import { COMMAND_EVENT, dispatchCommand } from '@/components/CommandPalette';
import HintCallout from '@/components/HintCallout';
import { useHint } from '@/lib/hints';

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
  const cmdPaletteHint = useHint('cmd-palette');
  const [clonedRepo, setClonedRepo] = useState<string | null>(null);
  const [compareBase, setCompareBase] = useState<string | null>(null); // null = off, string = compare mode

  const hasDiff = !!(selectedFile || selectedCommit);
  const diffVisible = showDiff && hasDiff;

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

  // Auto-dismiss cmd-palette hint when the user first opens the palette
  useEffect(() => {
    if (!cmdPaletteHint.show) return;
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') cmdPaletteHint.dismiss();
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [cmdPaletteHint]);

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

      {!repo && (
        <WelcomeScreen onRepoSelect={(path) => { setClonedRepo(path); handleRepoSelect(path); }} />
      )}

      <div className={`flex flex-1 overflow-hidden min-h-0 ${!repo ? 'hidden' : ''}`}>
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
            <section className={`flex flex-col border-r border-[var(--border-subtle)]/60 bg-[var(--bg-panel)] min-h-0 transition-all duration-200 ${diffVisible ? 'w-[320px] flex-shrink-0' : 'flex-1'}`}>
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
                  {/* Insights link */}
                  {repo && (
                    <a
                      href={`/insights?repo=${encodeURIComponent(repo)}`}
                      title="Repository insights"
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-[var(--text-dim)] hover:text-foreground hover:bg-[var(--bg-raised)] transition-colors"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="1" y="9" width="3" height="6" rx="0.5"/>
                        <rect x="6" y="5" width="3" height="10" rx="0.5"/>
                        <rect x="11" y="1" width="3" height="14" rx="0.5"/>
                      </svg>
                      <span className="text-[10px] font-medium">Insights</span>
                    </a>
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
            {diffVisible && (
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

      {/* Command palette hint — shown once after first repo open */}
      {repo && cmdPaletteHint.show && (
        <HintCallout onDismiss={cmdPaletteHint.dismiss}>
          Press <kbd className="px-1 py-0.5 rounded text-[10px] font-mono mx-0.5" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', color: 'var(--foreground)' }}>⌘K</kbd> to open the command palette — push, pull, switch tabs, and more.
        </HintCallout>
      )}

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
          <a href="https://www.lijojose.com" target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-100 transition-opacity">
            www.lijojose.com
          </a>
        </div>
      </footer>

      <UserGuideModal open={guideOpen} onClose={closeGuide} />
    </div>
  );
}

const RECENT_KEY = 'git-browser-recent';

function WelcomeScreen({ onRepoSelect }: { onRepoSelect: (path: string) => void }) {
  const [recent, setRecent] = useState<string[]>([]);
  const [mode, setMode] = useState<'idle' | 'open' | 'recent'>('idle');
  const [dirValue, setDirValue] = useState('~');

  useEffect(() => {
    try { setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')); } catch {}
  }, []);

  const handleDirSelect = (path: string) => {
    setMode('idle');
    onRepoSelect(path);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-0 overflow-auto px-6 py-12" style={{ background: 'var(--bg-base, var(--background))' }}>
      {/* Logo + title */}
      <div className="flex items-center gap-3 mb-10">
        <svg width="36" height="36" viewBox="0 0 56 56" aria-hidden="true">
          <rect width="56" height="56" rx="14" fill="#1e293b"/>
          <path d="M18 42 V22 Q18 16 24 16 H30" stroke="#f97316" strokeWidth="4" fill="none" strokeLinecap="round"/>
          <circle cx="18" cy="42" r="4.5" fill="#e2e8f0"/>
          <circle cx="33" cy="30" r="8" fill="none" stroke="#e2e8f0" strokeWidth="3.5"/>
          <circle cx="33" cy="30" r="2.5" fill="#38bdf8"/>
          <line x1="39" y1="36" x2="45" y2="42" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round"/>
        </svg>
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Git Browse</h1>
          <p className="text-xs" style={{ color: 'var(--text-dim)' }}>Local git workbench</p>
        </div>
      </div>

      {/* Action tiles */}
      <div className="flex gap-3 mb-8 flex-wrap justify-center">
        {/* Open local folder */}
        <div className="relative">
          <button
            onClick={() => setMode(mode === 'open' ? 'idle' : 'open')}
            className="flex flex-col items-center gap-3 w-44 py-6 px-4 rounded-2xl border transition-all"
            style={{
              background: mode === 'open' ? 'color-mix(in oklch, var(--primary) 10%, var(--bg-panel))' : 'var(--bg-panel)',
              borderColor: mode === 'open' ? 'var(--primary)' : 'var(--border-subtle)',
              color: 'var(--foreground)',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)' }}>
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
            </svg>
            <span className="text-sm font-medium">Open folder</span>
            <span className="text-[10px] text-center leading-tight" style={{ color: 'var(--text-dim)' }}>Browse and open a local git repository</span>
          </button>
          {mode === 'open' && (
            <div className="absolute top-full left-0 mt-2 z-50" style={{ width: 320 }}>
              <DirPicker value={dirValue} onChange={handleDirSelect} onClose={() => setMode('idle')} />
            </div>
          )}
        </div>

        {/* Clone */}
        <button
          onClick={() => dispatchCommand('clone')}
          className="flex flex-col items-center gap-3 w-44 py-6 px-4 rounded-2xl border transition-all hover:border-[var(--primary)] hover:bg-[color-mix(in_oklch,var(--primary)_5%,var(--bg-panel))]"
          style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)', color: 'var(--foreground)' }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)' }}>
            <path d="M8 2v8M4.5 6.5L8 10l3.5-3.5M2 13h12"/>
            <circle cx="18" cy="18" r="3"/>
            <circle cx="18" cy="5" r="3"/>
            <circle cx="6" cy="18" r="3"/>
            <line x1="15.41" y1="6.41" x2="9" y2="15"/>
            <line x1="9" y1="15" x2="9" y2="15"/>
          </svg>
          <span className="text-sm font-medium">Clone repo</span>
          <span className="text-[10px] text-center leading-tight" style={{ color: 'var(--text-dim)' }}>Clone a remote repository to your machine</span>
        </button>

        {/* Recent repos */}
        {recent.length > 0 && (
          <button
            onClick={() => setMode(mode === 'recent' ? 'idle' : 'recent')}
            className="flex flex-col items-center gap-3 w-44 py-6 px-4 rounded-2xl border transition-all"
            style={{
              background: mode === 'recent' ? 'color-mix(in oklch, var(--primary) 10%, var(--bg-panel))' : 'var(--bg-panel)',
              borderColor: mode === 'recent' ? 'var(--primary)' : 'var(--border-subtle)',
              color: 'var(--foreground)',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)' }}>
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <span className="text-sm font-medium">Recent repos</span>
            <span className="text-[10px] text-center leading-tight" style={{ color: 'var(--text-dim)' }}>{recent.length} repo{recent.length !== 1 ? 's' : ''} opened before</span>
          </button>
        )}
      </div>

      {/* Recent list inline */}
      {mode === 'recent' && recent.length > 0 && (
        <div className="w-full max-w-md rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' }}>
          <div className="px-4 py-2.5 border-b text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-dim)', borderColor: 'var(--border-subtle)' }}>
            Recent repositories
          </div>
          {recent.map(r => (
            <button
              key={r}
              onClick={() => onRepoSelect(r)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left border-b last:border-b-0 transition-colors hover:bg-[var(--bg-raised)]"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-dim)', flexShrink: 0 }}>
                <circle cx="3" cy="3" r="1.8"/><circle cx="3" cy="13" r="1.8"/><circle cx="13" cy="3" r="1.8"/>
                <line x1="3" y1="4.8" x2="3" y2="11.2"/><path d="M3 7a5 5 0 005 5h2"/>
              </svg>
              <span className="text-sm truncate flex-1" style={{ color: 'var(--foreground)' }}>
                {r.split('/').slice(-2).join('/')}
              </span>
              <span className="text-[10px] truncate max-w-[140px]" style={{ color: 'var(--text-dim)' }}>
                {r}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Keyboard hint */}
      <p className="mt-8 text-[11px]" style={{ color: 'var(--text-dim)' }}>
        Press <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}>⌘K</kbd> to open the command palette
      </p>
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
