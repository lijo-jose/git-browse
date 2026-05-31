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
  const [activeTab, setActiveTab] = useState('changes');
  const [selectedFile, setSelectedFile] = useState<string | undefined>();
  const [selectedFileStaged, setSelectedFileStaged] = useState<boolean>(false);
  const [selectedCommit, setSelectedCommit] = useState<string | undefined>();
  const [focusedPanel, setFocusedPanel] = useState<'left' | 'middle' | 'right'>('left');

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

  const handleFileSelect = (file: string, staged: boolean) => {
    setSelectedFile(file);
    setSelectedFileStaged(staged);
    setSelectedCommit(undefined);
  };

  const handleCommitSelect = (hash: string) => {
    setSelectedCommit(hash);
    setSelectedFile(undefined);
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
    if (e.key === 'Tab') {
      e.preventDefault();
      setFocusedPanel((p) => p === 'left' ? 'middle' : p === 'middle' ? 'right' : 'left');
    } else if (e.key.toLowerCase() === 'r') {
      if (repo) { const r = repo; setRepo(null); setTimeout(() => setRepo(r), 50); }
    } else if (e.key.toLowerCase() === 'b') { setActiveTab('branches'); }
    else if (e.key.toLowerCase() === 'l') { setActiveTab('log'); }
    else if (e.key.toLowerCase() === 'c') { setActiveTab('changes'); }
  }, [repo]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const panelRing = (p: string) =>
    focusedPanel === p ? 'ring-1 ring-[#4d9de0]/25' : '';

  return (
    <div className="flex flex-col h-screen bg-[#141414] text-[#dcdcdc] overflow-hidden">
      <TopBar repo={repo} onRepoSelect={handleRepoSelect} />

      <div className="flex flex-1 overflow-hidden">
        {/* Left — Explorer */}
        <div
          className={`w-56 flex-shrink-0 flex flex-col overflow-hidden bg-[#1a1a1a] border-r border-[#2e2e2e] ${panelRing('left')}`}
          onClick={() => setFocusedPanel('left')}
        >
          <PanelHeader label="Explorer" />
          <FolderPanel onRepoSelect={handleRepoSelect} selectedRepo={repo} />
        </div>

        {/* Middle — Git overview */}
        <div
          className={`w-[300px] flex-shrink-0 flex flex-col overflow-hidden bg-[#1a1a1a] border-r border-[#2e2e2e] ${panelRing('middle')}`}
          onClick={() => setFocusedPanel('middle')}
        >
          <GitPanel
            repo={repo || ''}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onFileSelect={handleFileSelect}
            onCommitSelect={handleCommitSelect}
            selectedFile={selectedFile}
            selectedCommit={selectedCommit}
          />
        </div>

        {/* Right — Diff */}
        <div
          className={`flex-1 flex flex-col overflow-hidden bg-[#141414] ${panelRing('right')}`}
          onClick={() => setFocusedPanel('right')}
        >
          <PanelHeader label="Diff" />
          <DiffPanel repo={repo || ''} file={selectedFile} commit={selectedCommit} staged={selectedFileStaged} />
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-4 px-4 h-[22px] bg-[#0e639c] text-white/80 text-[10px] font-medium tracking-wide flex-shrink-0">
        <span>Tab — switch panel</span>
        <span className="opacity-40">|</span>
        <span>R — refresh</span>
        <span className="opacity-40">|</span>
        <span>B / L / C — branches · log · changes</span>
        <span className="opacity-40">|</span>
        <span>Right-click folder — pin to favorites</span>
      </div>

      <Toaster theme="dark" position="bottom-right" />
    </div>
  );
}

function PanelHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 h-9 bg-[#1a1a1a] border-b border-[#2e2e2e] flex-shrink-0">
      <span className="text-[10px] font-semibold tracking-widest text-[#505050] uppercase">{label}</span>
    </div>
  );
}
