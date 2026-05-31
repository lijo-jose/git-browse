'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FileList from '@/components/git/FileList';
import CommitGraph from '@/components/git/CommitGraph';
import BranchList from '@/components/git/BranchList';
import StashList from '@/components/git/StashList';

interface GitPanelProps {
  repo: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onFileSelect: (file: string, staged: boolean) => void;
  onCommitSelect: (hash: string) => void;
  selectedFile?: string;
  selectedCommit?: string;
}

export default function GitPanel({
  repo, activeTab, onTabChange, onFileSelect, onCommitSelect, selectedFile, selectedCommit,
}: GitPanelProps) {
  if (!repo) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[#404040] gap-3">
        <span className="text-4xl opacity-20">⎇</span>
        <p className="text-xs font-medium">Select a repository</p>
      </div>
    );
  }

  const tabs = [
    { value: 'changes', label: 'Changes' },
    { value: 'log', label: 'Log' },
    { value: 'branches', label: 'Branches' },
    { value: 'stash', label: 'Stash' },
  ];

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="flex flex-col h-full">
      <TabsList className="flex-shrink-0 bg-transparent rounded-none border-b border-[#2e2e2e] h-9 px-1 justify-start gap-0 w-full">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="relative h-9 px-3 text-[11px] font-medium rounded-none bg-transparent
              text-[#606060] hover:text-[#b0b0b0]
              data-[state=active]:text-[#dcdcdc] data-[state=active]:bg-transparent
              transition-colors
              after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:rounded-t
              after:bg-transparent data-[state=active]:after:bg-[#4d9de0]
              data-[state=active]:shadow-none"
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="changes" className="flex-1 overflow-hidden m-0 data-[state=active]:flex flex-col">
        <FileList repo={repo} onFileSelect={onFileSelect} selectedFile={selectedFile} />
      </TabsContent>
      <TabsContent value="log" className="flex-1 overflow-hidden m-0 data-[state=active]:flex flex-col">
        <CommitGraph repo={repo} onCommitSelect={onCommitSelect} selectedCommit={selectedCommit} />
      </TabsContent>
      <TabsContent value="branches" className="flex-1 overflow-hidden m-0 data-[state=active]:flex flex-col">
        <BranchList repo={repo} />
      </TabsContent>
      <TabsContent value="stash" className="flex-1 overflow-hidden m-0 data-[state=active]:flex flex-col">
        <StashList repo={repo} />
      </TabsContent>
    </Tabs>
  );
}
