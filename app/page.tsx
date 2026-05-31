'use client';

import { useEffect, useCallback, useState } from 'react';
import FolderPanel from '@/components/panels/FolderPanel';
import GitPanel from '@/components/panels/GitPanel';
import DiffPanel from '@/components/panels/DiffPanel';
import TopBar from '@/components/TopBar';
import { Toaster } from '@/components/ui/sonner';

const LAST_REPO_KEY = 'git-browser-last-repo';

export default function Home() {
  const [repo, setRepo] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('log');
  const [selectedFile, setSelectedFile] = useState<string | undefined>();
  const [selectedFileStaged, setSelectedFileStaged] = useState(false);
  const [selectedCommit, setSelectedCommit] = useState<string | undefined>();

  useEffect(() => {
    try {
      const last = localStorage.getItem(LAST_REPO_KEY);
      if (last) setRepo(last);
    } catch {}
  }, []);

  const handleRepoSelect = (path: string) => {
    setRepo(path);
    setSelectedFile(undefined);
    setSelectedCommit(undefined);
    localStorage.setItem(LAST_REPO_KEY, path);
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
    if (e.key.toLowerCase() === 'r' && repo) { const r = repo; setRepo(null); setTimeout(() => setRepo(r), 50); }
    else if (e.key.toLowerCase() === 'b') setActiveTab('branches');
    else if (e.key.toLowerCase() === 'l') setActiveTab('log');
    else if (e.key.toLowerCase() === 'c') setActiveTab('changes');
  }, [repo]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      <TopBar repo={repo} onRepoSelect={handleRepoSelect} />

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left — file explorer */}
        <aside className="w-52 flex-shrink-0 flex flex-col border-r border-zinc-800/60 bg-zinc-900">
          <SectionHeader>Explorer</SectionHeader>
          <FolderPanel onRepoSelect={handleRepoSelect} selectedRepo={repo} />
        </aside>

        {/* Middle — git panel */}
        <section className="w-[320px] flex-shrink-0 flex flex-col border-r border-zinc-800/60 bg-zinc-900 min-h-0">
          <GitPanel
            repo={repo || ''}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onFileSelect={(f, s) => { setSelectedFile(f); setSelectedFileStaged(s); setSelectedCommit(undefined); }}
            onCommitSelect={(h) => { setSelectedCommit(h); setSelectedFile(undefined); }}
            selectedFile={selectedFile}
            selectedCommit={selectedCommit}
          />
        </section>

        {/* Right — diff */}
        <section className="flex-1 flex flex-col min-h-0 min-w-0 bg-zinc-950">
          <SectionHeader>Diff</SectionHeader>
          <DiffPanel repo={repo || ''} file={selectedFile} commit={selectedCommit} staged={selectedFileStaged} />
        </section>
      </div>

      {/* Status bar */}
      <footer className="h-6 flex items-center gap-4 px-4 bg-blue-600 text-blue-50 text-[10px] font-medium tracking-wide flex-shrink-0">
        <span>R — refresh</span>
        <span className="opacity-40">·</span>
        <span>B — branches · L — log · C — changes</span>
        <span className="opacity-40">·</span>
        <span>Right-click folder — pin</span>
      </footer>

      <Toaster theme="dark" position="bottom-right" />
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-9 flex items-center px-4 border-b border-zinc-800/60 flex-shrink-0">
      <span className="text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">{children}</span>
    </div>
  );
}
