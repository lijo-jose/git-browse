import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { assertGitRepo } from '@/lib/validate';
import { getBranches } from '@/lib/git';

function exec(cmd: string, cwd: string, maxBuffer = 20 * 1024 * 1024): string {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', maxBuffer });
  } catch {
    return '';
  }
}

export interface InsightsData {
  totalCommits: number;
  totalContributors: number;
  totalFiles: number;
  totalBranches: number;
  heatmap: { date: string; count: number }[];
  contributors: { author: string; commits: number }[];
  hotspots: { path: string; changes: number }[];
  commitTypes: { type: string; count: number }[];
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('repo');
  if (!raw) return NextResponse.json({ error: 'repo required' }, { status: 400 });

  try {
    const repo = assertGitRepo(raw);

    const [branches] = await Promise.all([getBranches(repo)]);

    // Commit heatmap — last 52 weeks
    const heatmapRaw = exec('git log --pretty=format:"%ad" --date=short --since="52 weeks ago"', repo);
    const heatmapMap = new Map<string, number>();
    for (const date of heatmapRaw.split('\n').filter(Boolean)) {
      heatmapMap.set(date, (heatmapMap.get(date) ?? 0) + 1);
    }
    const heatmap = Array.from(heatmapMap.entries()).map(([date, count]) => ({ date, count }));

    // Contributors via git shortlog (honours .mailmap automatically)
    const shortlogRaw = exec('git shortlog -sn --no-merges HEAD', repo);
    const allContributorLines = shortlogRaw.split('\n').filter(Boolean);
    const totalContributors = allContributorLines.length;
    const contributors = allContributorLines
      .slice(0, 10)
      .map(line => {
        const m = line.match(/^\s*(\d+)\s+(.+)$/);
        return m ? { author: m[2].trim(), commits: parseInt(m[1]) } : null;
      })
      .filter((x): x is { author: string; commits: number } => x !== null);

    // Total commits
    const totalCommits = parseInt(exec('git rev-list --count HEAD', repo).trim()) || 0;

    // File count
    const filesRaw = exec('git ls-files', repo, 5 * 1024 * 1024);
    const totalFiles = filesRaw.split('\n').filter(Boolean).length;

    // Hotspot files — most frequently touched in last 2000 non-merge commits
    const changedFilesRaw = exec('git log --pretty=format: --name-only --no-merges -n 2000', repo);
    const fileFreq = new Map<string, number>();
    for (const line of changedFilesRaw.split('\n').filter(Boolean)) {
      fileFreq.set(line, (fileFreq.get(line) ?? 0) + 1);
    }
    const hotspots = Array.from(fileFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([path, changes]) => ({ path, changes }));

    // Conventional commit type breakdown (last 500 non-merge commits)
    const subjectsRaw = exec('git log --pretty=format:"%s" --no-merges -n 500', repo);
    const typeRegex = /^(feat|fix|docs|style|refactor|perf|test|chore|ci|build)(\(.*?\))?!?:/i;
    const typeCounts = new Map<string, number>();
    let conventionalCount = 0;
    for (const subject of subjectsRaw.split('\n').filter(Boolean)) {
      const m = subject.match(typeRegex);
      if (m) {
        const type = m[1].toLowerCase();
        typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
        conventionalCount++;
      }
    }
    const totalSubjects = subjectsRaw.split('\n').filter(Boolean).length;
    if (totalSubjects > 0 && totalSubjects - conventionalCount > 0) {
      typeCounts.set('other', totalSubjects - conventionalCount);
    }
    const commitTypes = Array.from(typeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }));

    const data: InsightsData = {
      totalCommits,
      totalContributors,
      totalFiles,
      totalBranches: branches.filter(b => !b.remote).length,
      heatmap,
      contributors,
      hotspots,
      commitTypes,
    };

    return NextResponse.json(data);
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
