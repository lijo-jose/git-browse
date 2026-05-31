'use client';

import DiffViewer from '@/components/git/DiffViewer';

interface DiffPanelProps {
  repo: string;
  file?: string;
  commit?: string;
  staged?: boolean;
}

export default function DiffPanel({ repo, file, commit, staged }: DiffPanelProps) {
  return (
    <div className="flex flex-col h-full bg-[#181825]">
      <DiffViewer repo={repo} file={file} commit={commit} staged={staged} />
    </div>
  );
}
