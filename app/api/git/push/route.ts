import { NextRequest, NextResponse } from 'next/server';
import { pushBranch } from '@/lib/git';
import { assertGitRepo } from '@/lib/validate';

export async function POST(req: NextRequest) {
  try {
    const { repo, setUpstream, branch, remote } = await req.json();
    if (!repo) return NextResponse.json({ error: 'repo required' }, { status: 400 });
    const repoPath = assertGitRepo(repo);
    const result = await pushBranch(repoPath, !!setUpstream, branch || '', remote || undefined);
    return NextResponse.json({ ok: true, result });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
