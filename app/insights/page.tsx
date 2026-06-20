'use client';

import { useEffect, useState, useMemo } from 'react';
import type { InsightsData } from '@/app/api/git/insights/route';
import type { NetworkCommit } from '@/app/api/git/network/route';

const COMMIT_TYPE_COLORS: Record<string, string> = {
  feat:     'oklch(0.74 0.17 150)',
  fix:      'oklch(0.65 0.18 25)',
  docs:     'oklch(0.65 0.18 250)',
  refactor: 'oklch(0.65 0.15 290)',
  chore:    'oklch(0.60 0.05 220)',
  test:     'oklch(0.74 0.15 80)',
  style:    'oklch(0.70 0.15 330)',
  perf:     'oklch(0.74 0.15 50)',
  ci:       'oklch(0.65 0.15 200)',
  build:    'oklch(0.70 0.12 60)',
  other:    'oklch(0.55 0.04 220)',
};

export default function InsightsPage() {
  const [repo, setRepo] = useState<string | null>(null);
  const [repoName, setRepoName] = useState('');
  const [branch, setBranch] = useState('');
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const repoParam = params.get('repo');
    const resolved = repoParam || (() => {
      try { return localStorage.getItem('git-browser-last-repo'); } catch { return null; }
    })();
    if (resolved) {
      setRepo(resolved);
      setRepoName(resolved.split('/').filter(Boolean).pop() ?? resolved);
    }
  }, []);

  useEffect(() => {
    if (!repo) return;
    fetch(`/api/git/branches?repo=${encodeURIComponent(repo)}`)
      .then(r => r.json())
      .then(d => {
        const cur = (d.branches || []).find((b: { current: boolean; name: string }) => b.current);
        setBranch(cur?.name || '');
      })
      .catch(() => {});
    setLoading(true);
    setError('');
    fetch(`/api/git/insights?repo=${encodeURIComponent(repo)}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [repo]);

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="h-11 flex items-center gap-3 px-4 flex-shrink-0 border-b border-[var(--border-subtle)]/60"
        style={{ background: 'var(--bg-panel)' }}>
        <span className="text-sm font-medium text-foreground whitespace-nowrap">
          git <span style={{ color: '#f97316' }}>browse</span>
        </span>
        <span className="w-px h-4 bg-[var(--border-subtle)]" />
        <a
          href="/"
          className="flex items-center gap-1.5 text-xs text-[var(--text-dim)] hover:text-foreground transition-colors flex-shrink-0"
          title="Back to repository"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2L4 6l4 4"/>
          </svg>
          Back
        </a>
        <span className="w-px h-4 bg-[var(--border-subtle)]" />
        {repoName ? (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium text-foreground truncate">{repoName}</span>
            {branch && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
                style={{ background: 'var(--bg-raised)', border: '1px solid color-mix(in oklch, var(--border-subtle) 50%, transparent)', color: 'var(--text-soft)' }}>
                <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--primary)' }}>
                  <circle cx="3" cy="3" r="2"/><circle cx="9" cy="9" r="2"/><path d="M3 5v1a3 3 0 003 3h.5"/>
                </svg>
                {branch}
              </span>
            )}
          </div>
        ) : (
          <span className="text-sm text-[var(--text-dim)]">No repository selected</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] font-semibold tracking-widest uppercase text-[var(--text-dim)]">Insights</span>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {!repo ? (
          <EmptyState text="Open a repository from the main page to view its insights." />
        ) : loading ? (
          <LoadingState />
        ) : error ? (
          <EmptyState text={error} isError />
        ) : data ? (
          <InsightsContent data={data} repo={repo} />
        ) : null}
      </div>
    </div>
  );
}

// ── Content ──────────────────────────────────────────────────────────────────

function InsightsContent({ data, repo }: { data: InsightsData; repo: string }) {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Headline cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Commits" value={data.totalCommits.toLocaleString()} icon={<CommitIcon />} />
        <StatCard label="Contributors" value={data.totalContributors.toLocaleString()} icon={<PeopleIcon />} />
        <StatCard label="Files Tracked" value={data.totalFiles.toLocaleString()} icon={<FileIcon />} />
        <StatCard label="Local Branches" value={data.totalBranches.toLocaleString()} icon={<BranchIcon />} />
      </div>

      {/* Commit heatmap */}
      <Section title="Commit Activity" subtitle="Last 52 weeks">
        <CommitHeatmap data={data.heatmap} />
      </Section>

      {/* Branch network */}
      <BranchNetwork repo={repo} />

      {/* Two-column: contributors + hotspots */}
      <div className="grid grid-cols-2 gap-4">
        <Section title="Top Contributors" subtitle="All time · by commit count">
          <ContributorList contributors={data.contributors} />
        </Section>
        <Section title="Hotspot Files" subtitle="Last 2000 commits · most changed">
          <HotspotList hotspots={data.hotspots} repo={repo} />
        </Section>
      </div>

      {/* Commit types */}
      {data.commitTypes.length > 0 && (
        <Section title="Commit Types" subtitle="Last 500 commits · conventional commit breakdown">
          <CommitTypes types={data.commitTypes} />
        </Section>
      )}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4 flex items-center gap-4"
      style={{ background: 'var(--bg-panel)', border: '1px solid color-mix(in oklch, var(--border-subtle) 60%, transparent)' }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: 'color-mix(in oklch, var(--bg-raised) 80%, transparent)', color: 'var(--text-soft)' }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xl font-semibold tabular-nums text-foreground">{value}</p>
        <p className="text-[11px] text-[var(--text-dim)] mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: 'var(--bg-panel)', border: '1px solid color-mix(in oklch, var(--border-subtle) 60%, transparent)' }}>
      <div className="px-5 py-3.5 flex items-baseline gap-3"
        style={{ borderBottom: '1px solid color-mix(in oklch, var(--border-subtle) 40%, transparent)' }}>
        <h2 className="text-xs font-semibold text-foreground">{title}</h2>
        {subtitle && <span className="text-[10px] text-[var(--text-dim)]">{subtitle}</span>}
      </div>
      <div className="px-5 py-4">
        {children}
      </div>
    </div>
  );
}

// ── Commit heatmap ────────────────────────────────────────────────────────────

function CommitHeatmap({ data }: { data: { date: string; count: number }[] }) {
  const { weeks, monthLabels, maxCount } = useMemo(() => {
    const dateMap = new Map(data.map(d => [d.date, d.count]));
    const today = new Date();
    const maxCount = Math.max(...data.map(d => d.count), 1);

    // Align to the Sunday 52 weeks back
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 52 * 7);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const weeks: Array<Array<{ date: string; count: number; isFuture: boolean }>> = [];
    const monthLabels: Array<{ weekIndex: number; label: string }> = [];
    let currentMonth = -1;
    const curr = new Date(startDate);

    while (curr <= today || (weeks.length > 0 && weeks[weeks.length - 1].length < 7)) {
      if (weeks.length === 0 || weeks[weeks.length - 1].length === 7) {
        weeks.push([]);
      }
      const weekIndex = weeks.length - 1;
      const isFuture = curr > today;
      const dateStr = curr.toISOString().slice(0, 10);

      if (!isFuture && curr.getMonth() !== currentMonth) {
        currentMonth = curr.getMonth();
        monthLabels.push({
          weekIndex,
          label: curr.toLocaleString('default', { month: 'short' }),
        });
      }

      weeks[weeks.length - 1].push({
        date: dateStr,
        count: isFuture ? 0 : (dateMap.get(dateStr) ?? 0),
        isFuture,
      });

      curr.setDate(curr.getDate() + 1);
    }

    return { weeks, monthLabels, maxCount };
  }, [data]);

  const cellColor = (count: number, isFuture: boolean) => {
    if (isFuture || count === 0) return 'color-mix(in oklch, var(--bg-raised) 80%, transparent)';
    const intensity = Math.min(count / maxCount, 1);
    if (intensity < 0.2)  return 'oklch(0.65 0.15 150 / 0.30)';
    if (intensity < 0.4)  return 'oklch(0.65 0.15 150 / 0.50)';
    if (intensity < 0.65) return 'oklch(0.65 0.15 150 / 0.70)';
    if (intensity < 0.85) return 'oklch(0.65 0.15 150 / 0.85)';
    return 'oklch(0.65 0.15 150)';
  };

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const showDays = [1, 3, 5]; // Mon, Wed, Fri indices

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex gap-2 min-w-0">
        {/* Day-of-week labels */}
        <div className="flex flex-col gap-0.5 pt-5 pr-1">
          {dayLabels.map((label, i) => (
            <div key={i} className="h-2.5 flex items-center">
              {showDays.includes(i) && (
                <span className="text-[9px] leading-none select-none" style={{ color: 'var(--text-dim)' }}>{label}</span>
              )}
            </div>
          ))}
        </div>

        {/* Week columns */}
        <div>
          {/* Month labels */}
          <div className="flex gap-0.5 mb-1 h-4">
            {weeks.map((_, wi) => {
              const label = monthLabels.find(m => m.weekIndex === wi);
              return (
                <div key={wi} className="w-2.5 flex-shrink-0">
                  {label && (
                    <span className="text-[9px] leading-none select-none whitespace-nowrap" style={{ color: 'var(--text-dim)' }}>
                      {label.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Cell grid */}
          <div className="flex gap-0.5">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-0.5">
                {week.map((cell, di) => (
                  <div
                    key={di}
                    title={cell.isFuture ? '' : `${cell.date}: ${cell.count} commit${cell.count !== 1 ? 's' : ''}`}
                    className="w-2.5 h-2.5 rounded-[2px] flex-shrink-0"
                    style={{ background: cellColor(cell.count, cell.isFuture) }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-3 justify-end">
        <span className="text-[9px]" style={{ color: 'var(--text-dim)' }}>Less</span>
        {[0, 0.2, 0.45, 0.7, 1].map((intensity, i) => (
          <div key={i} className="w-2.5 h-2.5 rounded-[2px]"
            style={{ background: intensity === 0 ? 'color-mix(in oklch, var(--bg-raised) 80%, transparent)' : `oklch(0.65 0.15 150 / ${intensity})` }}
          />
        ))}
        <span className="text-[9px]" style={{ color: 'var(--text-dim)' }}>More</span>
      </div>
    </div>
  );
}

// ── Contributors ──────────────────────────────────────────────────────────────

function ContributorList({ contributors }: { contributors: { author: string; commits: number }[] }) {
  if (!contributors.length) return <EmptyRow text="No contributor data" />;
  const max = contributors[0].commits;

  return (
    <div className="space-y-2">
      {contributors.map((c, i) => (
        <div key={c.author} className="flex items-center gap-3">
          <span className="w-4 text-[10px] text-right tabular-nums flex-shrink-0" style={{ color: 'var(--text-dim)' }}>{i + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-foreground truncate">{c.author}</span>
              <span className="text-[10px] tabular-nums flex-shrink-0 ml-2" style={{ color: 'var(--text-dim)' }}>{c.commits.toLocaleString()}</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-raised)' }}>
              <div className="h-full rounded-full" style={{ width: `${(c.commits / max) * 100}%`, background: 'oklch(0.65 0.15 150 / 0.6)' }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Hotspot files ──────────────────────────────────────────────────────────────

function HotspotList({ hotspots, repo }: { hotspots: { path: string; changes: number }[]; repo: string }) {
  if (!hotspots.length) return <EmptyRow text="No hotspot data" />;
  const max = hotspots[0].changes;

  return (
    <div className="space-y-2">
      {hotspots.map((h, i) => {
        const fileName = h.path.split('/').pop() ?? h.path;
        const dir = h.path.includes('/') ? h.path.slice(0, h.path.lastIndexOf('/') + 1) : '';
        const href = `/?repo=${encodeURIComponent(repo)}`;
        return (
          <div key={h.path} className="flex items-center gap-3">
            <span className="w-4 text-[10px] text-right tabular-nums flex-shrink-0" style={{ color: 'var(--text-dim)' }}>{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <a
                  href={href}
                  title={h.path}
                  className="text-xs font-medium font-mono truncate hover:text-primary transition-colors"
                  style={{ color: 'var(--foreground)', maxWidth: '75%' }}
                >
                  <span style={{ color: 'var(--text-dim)' }}>{dir}</span>{fileName}
                </a>
                <span className="text-[10px] tabular-nums flex-shrink-0 ml-2" style={{ color: 'var(--text-dim)' }}>
                  {h.changes}×
                </span>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-raised)' }}>
                <div className="h-full rounded-full" style={{ width: `${(h.changes / max) * 100}%`, background: 'oklch(0.65 0.18 25 / 0.6)' }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Commit types ──────────────────────────────────────────────────────────────

function CommitTypes({ types }: { types: { type: string; count: number }[] }) {
  const total = types.reduce((s, t) => s + t.count, 0);
  return (
    <div className="space-y-3">
      {/* Bar chart */}
      <div className="flex h-3 rounded-full overflow-hidden gap-px">
        {types.map(t => (
          <div
            key={t.type}
            title={`${t.type}: ${t.count}`}
            style={{ width: `${(t.count / total) * 100}%`, background: COMMIT_TYPE_COLORS[t.type] ?? COMMIT_TYPE_COLORS.other }}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {types.map(t => (
          <div key={t.type} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-[2px]" style={{ background: COMMIT_TYPE_COLORS[t.type] ?? COMMIT_TYPE_COLORS.other }} />
            <span className="text-[11px]" style={{ color: 'var(--text-soft)' }}>
              <span className="font-medium">{t.type}</span>
              <span className="ml-1" style={{ color: 'var(--text-dim)' }}>{t.count}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function EmptyState({ text, isError }: { text: string; isError?: boolean }) {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-sm" style={{ color: isError ? 'oklch(0.65 0.18 25)' : 'var(--text-dim)' }}>{text}</p>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="text-xs py-2" style={{ color: 'var(--text-dim)' }}>{text}</p>;
}

function LoadingState() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl p-4 h-20 animate-pulse"
            style={{ background: 'color-mix(in oklch, var(--bg-raised) 60%, transparent)' }} />
        ))}
      </div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-xl h-48 animate-pulse"
          style={{ background: 'color-mix(in oklch, var(--bg-raised) 60%, transparent)' }} />
      ))}
    </div>
  );
}

// ── Branch network ────────────────────────────────────────────────────────────

const LANE_COLORS = [
  '#f97316', '#3b82f6', '#22c55e', '#a855f7',
  '#ec4899', '#14b8a6', '#f59e0b', '#6366f1',
  '#ef4444', '#8b5cf6',
];
const laneColor = (lane: number) => LANE_COLORS[lane % LANE_COLORS.length];

interface PlacedNode extends NetworkCommit {
  col: number;
  lane: number;
  parentEdges: Array<{ toCol: number; toLane: number }>;
}

function computeNetwork(commits: NetworkCommit[]): PlacedNode[] {
  const hashToCol = new Map(commits.map((c, i) => [c.hash, i]));
  const lanes: (string | null)[] = [];
  const hashToLane = new Map<string, number>();

  const placed: Omit<PlacedNode, 'parentEdges'>[] = [];

  for (let col = 0; col < commits.length; col++) {
    const c = commits[col];

    let lane = lanes.indexOf(c.hash);
    if (lane === -1) {
      lane = lanes.indexOf(null);
      if (lane === -1) { lane = lanes.length; lanes.push(null); }
    }
    hashToLane.set(c.hash, lane);

    if (c.parents.length === 0) {
      lanes[lane] = null;
    } else {
      const p0 = c.parents[0];
      const existing0 = lanes.indexOf(p0);
      if (existing0 !== -1 && existing0 !== lane) {
        lanes[lane] = null; // converge — two lanes meet at p0
      } else {
        lanes[lane] = p0;
      }
      for (let p = 1; p < c.parents.length; p++) {
        const ph = c.parents[p];
        if (!lanes.includes(ph)) {
          let nl = lanes.indexOf(null);
          if (nl === -1) { nl = lanes.length; lanes.push(null); }
          lanes[nl] = ph;
        }
      }
    }

    placed.push({ ...c, col, lane });
  }

  return placed.map(node => ({
    ...node,
    parentEdges: node.parents
      .map(ph => {
        const toCol = hashToCol.get(ph);
        const toLane = hashToLane.get(ph);
        return (toCol !== undefined && toLane !== undefined)
          ? { toCol, toLane }
          : null;
      })
      .filter((e): e is { toCol: number; toLane: number } => e !== null),
  }));
}

function edgePath(x1: number, y1: number, x2: number, y2: number): string {
  if (y1 === y2) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const cpx1 = x1 + (x2 - x1) * 0.45;
  const cpx2 = x1 + (x2 - x1) * 0.55;
  return `M ${x1} ${y1} C ${cpx1} ${y1} ${cpx2} ${y2} ${x2} ${y2}`;
}

function NetworkSVG({ nodes, laneCount }: { nodes: PlacedNode[]; laneCount: number }) {
  const N = nodes.length;
  const COL = 26;
  const ROW = 28;
  const R = 4;
  const PAD = { top: 12, right: 16, bottom: 12, left: 12 };

  const nx = (col: number) => PAD.left + col * COL;
  const ny = (lane: number) => PAD.top + lane * ROW;

  const svgW = PAD.left + Math.max(N - 1, 0) * COL + PAD.right;
  const svgH = PAD.top + laneCount * ROW + PAD.bottom;

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={svgW} height={svgH} style={{ display: 'block', minWidth: svgW }}>

        {/* Lane tracks */}
        {Array.from({ length: laneCount }, (_, lane) => {
          const cols = nodes.filter(n => n.lane === lane).map(n => n.col);
          if (!cols.length) return null;
          return (
            <line
              key={`track-${lane}`}
              x1={nx(Math.min(...cols))} y1={ny(lane)}
              x2={nx(Math.max(...cols))} y2={ny(lane)}
              stroke={laneColor(lane)}
              strokeWidth={1}
              opacity={0.15}
            />
          );
        })}

        {/* Edges */}
        {nodes.map(node =>
          node.parentEdges.map((edge, ei) => (
            <path
              key={`${node.hash}-e${ei}`}
              d={edgePath(nx(node.col), ny(node.lane), nx(edge.toCol), ny(edge.toLane))}
              stroke={laneColor(node.lane)}
              strokeWidth={1.5}
              fill="none"
              opacity={0.65}
            />
          ))
        )}

        {/* Commit dots — branch tips are slightly larger; tooltip shows full context */}
        {nodes.map(node => {
          const branchRefs = node.refs.filter(r => r !== 'HEAD' && !r.startsWith('tag:'));
          const tagRefs    = node.refs.filter(r => r.startsWith('tag:'));
          const isTip      = branchRefs.length > 0;
          const tooltip    = [
            `${node.shortHash}  ${node.subject}`,
            `${node.author} · ${node.date}`,
            branchRefs.length ? `\n${branchRefs.map(r => r.replace(/^HEAD -> /, '')).join('\n')}` : '',
            tagRefs.length    ? tagRefs.map(r => r.replace(/^tag: /, '🏷 ')).join('  ') : '',
          ].filter(Boolean).join('\n').trim();

          return (
            <g key={node.hash} style={{ cursor: 'default' }}>
              {/* Outer ring for branch tips */}
              {isTip && (
                <circle
                  cx={nx(node.col)} cy={ny(node.lane)}
                  r={R + 3}
                  fill="none"
                  stroke={laneColor(node.lane)}
                  strokeWidth={1.5}
                  opacity={0.4}
                />
              )}
              <circle
                cx={nx(node.col)} cy={ny(node.lane)}
                r={isTip ? R + 1 : R}
                fill={laneColor(node.lane)}
                stroke="var(--bg-panel, #1e293b)"
                strokeWidth={1.5}
              />
              {/* Tag diamond */}
              {tagRefs.length > 0 && (
                <rect
                  x={nx(node.col) - 3.5} y={ny(node.lane) - 3.5}
                  width={7} height={7}
                  fill={laneColor(node.lane)}
                  stroke="var(--bg-panel, #1e293b)"
                  strokeWidth={1}
                  transform={`rotate(45 ${nx(node.col)} ${ny(node.lane)})`}
                />
              )}
              <title>{tooltip}</title>
              {/* Wide invisible hit area for comfortable hover */}
              <circle cx={nx(node.col)} cy={ny(node.lane)} r={R + 6} fill="transparent" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function BranchNetwork({ repo }: { repo: string }) {
  const [commits, setCommits] = useState<NetworkCommit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setLoading(true); setError('');
    fetch(`/api/git/network?repo=${encodeURIComponent(repo)}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setCommits(d.commits); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [repo]);

  if (loading) return (
    <div className="rounded-xl h-24 animate-pulse"
      style={{ background: 'color-mix(in oklch, var(--bg-raised) 60%, transparent)' }} />
  );
  if (error || !commits.length) return null;

  const nodes = computeNetwork(commits);
  const laneCount = Math.max(...nodes.map(n => n.lane), 0) + 1;
  const subtitle = `Last ${commits.length} commits across ${laneCount} lane${laneCount !== 1 ? 's' : ''}`;

  return (
    <Section title="Branch Network" subtitle={subtitle}>
      <NetworkSVG nodes={nodes} laneCount={laneCount} />
    </Section>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function CommitIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="8" r="2.5"/>
      <line x1="1" y1="8" x2="5.5" y2="8"/>
      <line x1="10.5" y1="8" x2="15" y2="8"/>
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="5" r="2.5"/>
      <path d="M1 13c0-2.8 2.2-4 5-4s5 1.2 5 4"/>
      <circle cx="12" cy="5" r="2"/>
      <path d="M14 12c.7.3 1 .8 1 1.5"/>
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6z"/>
      <path d="M9 2v4h4"/>
    </svg>
  );
}

function BranchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="5" cy="3.5" r="1.5"/>
      <circle cx="5" cy="12.5" r="1.5"/>
      <circle cx="11" cy="3.5" r="1.5"/>
      <line x1="5" y1="5" x2="5" y2="11"/>
      <path d="M5 6.5a3 3 0 003 3h2"/>
    </svg>
  );
}
