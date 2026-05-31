import { NextRequest, NextResponse } from 'next/server';
import { getLog } from '@/lib/git';
import { assertGitRepo } from '@/lib/validate';

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('repo');
  const page = parseInt(req.nextUrl.searchParams.get('page') || '0');
  if (!raw) return NextResponse.json({ error: 'repo required' }, { status: 400 });
  try {
    const repo = assertGitRepo(raw);
    const lines = getLog(repo, page);
    return NextResponse.json({ lines });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
