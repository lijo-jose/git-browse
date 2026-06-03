'use client';

import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface RemoteInfo { name: string; fetchUrl: string; pushUrl: string; }
interface RepoInfo {
  headBranch: string;
  headCommit: string;
  remotes: RemoteInfo[];
  totalCommits: number;
  repoPath: string;
}

export default function RepoInfo({ repo }: { repo: string }) {
  const [info, setInfo] = useState<RepoInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!repo) return;
    setLoading(true); setError('');
    fetch(`/api/git/info?repo=${encodeURIComponent(repo)}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setInfo(d); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [repo]);

  if (loading) return (
    <div className="p-4 space-y-3">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 rounded-lg" style={{ background: 'color-mix(in oklch, var(--bg-raised) 60%, transparent)' }} />)}
    </div>
  );
  if (error) return <p className="p-4 text-rose-500 text-xs">{error}</p>;
  if (!info) return null;

  const repoName = info.repoPath.split('/').filter(Boolean).pop() ?? info.repoPath;

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
      {/* Repo name */}
      <Section label="Repository">
        <Row label="Name" value={repoName} mono />
        <Row label="Path" value={info.repoPath} mono dim />
      </Section>

      {/* HEAD */}
      <Section label="Current state">
        <Row label="Branch" value={info.headBranch} mono accent="green" />
        <Row label="HEAD" value={info.headCommit} mono accent="blue" />
        <Row label="Commits" value={String(info.totalCommits)} />
      </Section>

      {/* Remotes */}
      <Section label={`Remotes (${info.remotes.length})`}>
        {info.remotes.length === 0 ? (
          <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-dim)' }}>No remotes configured</p>
        ) : info.remotes.map(r => (
          <div key={r.name} className="px-3 py-2 rounded-lg mb-0.5" style={{ background: 'color-mix(in oklch, var(--bg-raised) 40%, transparent)' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'oklch(0.78 0.14 80 / 0.6)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{r.name}</span>
            </div>
            {r.fetchUrl && (
              <p className="text-[10px] font-mono truncate pl-3.5" style={{ color: 'var(--text-dim)' }} title={r.fetchUrl}>{r.fetchUrl}</p>
            )}
            {r.pushUrl && r.pushUrl !== r.fetchUrl && (
              <p className="text-[10px] font-mono truncate pl-3.5 mt-0.5" style={{ color: 'var(--text-dim)' }} title={r.pushUrl}>push: {r.pushUrl}</p>
            )}
          </div>
        ))}
      </Section>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-1 pb-1 text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--text-dim)' }}>{label}</p>
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid color-mix(in oklch, var(--border-subtle) 60%, transparent)' }}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, mono, dim, accent }: { label: string; value: string; mono?: boolean; dim?: boolean; accent?: 'green' | 'blue' }) {
  const color = accent === 'green' ? 'oklch(0.74 0.17 150)' : accent === 'blue' ? 'oklch(0.65 0.18 250)' : dim ? 'var(--text-dim)' : 'var(--foreground)';
  return (
    <div className="flex items-center px-3 py-2" style={{ borderBottom: '1px solid color-mix(in oklch, var(--border-subtle) 40%, transparent)' }}>
      <span className="text-[10px] w-16 flex-shrink-0 font-medium" style={{ color: 'var(--text-dim)' }}>{label}</span>
      <span className={`text-xs truncate flex-1 ${mono ? 'font-mono' : ''}`} style={{ color }} title={value}>{value || '—'}</span>
    </div>
  );
}
