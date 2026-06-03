import { NextRequest, NextResponse } from 'next/server';
import { mergeBranch } from '@/lib/git';
import { assertGitRepo } from '@/lib/validate';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const repo = assertGitRepo(body.repo);
    if (!body.branch) return NextResponse.json({ error: 'branch required' }, { status: 400 });
    const result = await mergeBranch(repo, body.branch);
    return NextResponse.json({ ok: true, result });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
