'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FileList from '@/components/git/FileList';
import CommitGraph from '@/components/git/CommitGraph';
import BranchList from '@/components/git/BranchList';
import StashList from '@/components/git/StashList';

interface Props {
  repo: string; activeTab: string; onTabChange: (t: string) => void;
  onFileSelect: (f: string, s: boolean) => void; onCommitSelect: (h: string) => void;
  selectedFile?: string; selectedCommit?: string;
}

const TABS = [
  { value: 'log', label: 'Log' },
  { value: 'changes', label: 'Changes' },
  { value: 'branches', label: 'Branches' },
  { value: 'stash', label: 'Stash' },
];

export default function GitPanel({ repo, activeTab, onTabChange, onFileSelect, onCommitSelect, selectedFile, selectedCommit }: Props) {
  if (!repo) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-700">
      <svg width="32" height="32" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="opacity-40">
        <circle cx="5" cy="3.5" r="1.5"/><circle cx="5" cy="12.5" r="1.5"/>
        <circle cx="11" cy="3.5" r="1.5"/><line x1="5" y1="5" x2="5" y2="11"/>
        <path d="M5 6a3 3 0 003 3h2"/>
      </svg>
      <p className="text-xs font-medium">Select a repository</p>
    </div>
  );

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="flex flex-col h-full min-h-0">
      <TabsList className="h-9 flex-shrink-0 bg-transparent rounded-none border-b border-zinc-800/60 px-1 justify-start gap-0 w-full overflow-x-auto">
        {TABS.map(t => (
          <TabsTrigger key={t.value} value={t.value}
            className="relative h-9 px-3.5 text-[11px] font-medium rounded-none bg-transparent shrink-0
              text-zinc-600 hover:text-zinc-300 data-[state=active]:text-zinc-100 data-[state=active]:bg-transparent
              transition-colors shadow-none
              after:absolute after:bottom-0 after:left-2 after:right-2 after:h-[2px] after:rounded-full
              after:bg-transparent data-[state=active]:after:bg-blue-500">
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="log"      className="flex-1 overflow-hidden m-0 data-[state=active]:flex flex-col min-h-0">
        <CommitGraph repo={repo} onCommitSelect={onCommitSelect} selectedCommit={selectedCommit} />
      </TabsContent>
      <TabsContent value="changes"  className="flex-1 overflow-hidden m-0 data-[state=active]:flex flex-col min-h-0">
        <FileList repo={repo} onFileSelect={onFileSelect} selectedFile={selectedFile} />
      </TabsContent>
      <TabsContent value="branches" className="flex-1 overflow-hidden m-0 data-[state=active]:flex flex-col min-h-0">
        <BranchList repo={repo} />
      </TabsContent>
      <TabsContent value="stash"    className="flex-1 overflow-hidden m-0 data-[state=active]:flex flex-col min-h-0">
        <StashList repo={repo} />
      </TabsContent>
    </Tabs>
  );
}
