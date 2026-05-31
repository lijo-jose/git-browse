import { NextRequest, NextResponse } from 'next/server';
import { applyStash, dropStash } from '@/lib/git';
import { assertGitRepo } from '@/lib/validate';

export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const raw = searchParams.get('repo');
  const index = parseInt(searchParams.get('index') || '0');
  const action = searchParams.get('action') || 'apply';
  if (!raw) return NextResponse.json({ error: 'repo required' }, { status: 400 });
  try {
    const repo = assertGitRepo(raw);
    if (action === 'drop') await dropStash(repo, index);
    else await applyStash(repo, index);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
