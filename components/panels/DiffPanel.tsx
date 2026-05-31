'use client';

import DiffViewer from '@/components/git/DiffViewer';

interface Props { repo: string; file?: string; commit?: string; staged?: boolean; }

export default function DiffPanel({ repo, file, commit, staged }: Props) {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <DiffViewer repo={repo} file={file} commit={commit} staged={staged} />
    </div>
  );
}
