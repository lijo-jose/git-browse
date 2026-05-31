import { NextRequest, NextResponse } from 'next/server';
import { getCommitFiles } from '@/lib/git';
import { assertGitRepo } from '@/lib/validate';

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('repo');
  const commit = req.nextUrl.searchParams.get('commit');
  if (!raw || !commit) return NextResponse.json({ error: 'repo and commit required' }, { status: 400 });
  try {
    const repo = assertGitRepo(raw);
    const files = getCommitFiles(repo, commit);
    return NextResponse.json({ files });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
