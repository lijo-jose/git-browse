import { NextRequest, NextResponse } from 'next/server';
import { checkoutBranch } from '@/lib/git';
import { assertGitRepo } from '@/lib/validate';

export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const raw = searchParams.get('repo');
  const branch = searchParams.get('branch');
  if (!raw || !branch) return NextResponse.json({ error: 'repo and branch required' }, { status: 400 });
  try {
    const repo = assertGitRepo(raw);
    await checkoutBranch(repo, branch);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
