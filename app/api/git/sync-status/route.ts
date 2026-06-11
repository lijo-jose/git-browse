import { NextRequest, NextResponse } from 'next/server';
import { getSyncStatus } from '@/lib/git';
import { assertGitRepo } from '@/lib/validate';

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('repo');
  if (!raw) return NextResponse.json({ error: 'repo required' }, { status: 400 });
  try {
    const repo = assertGitRepo(raw);
    const status = await getSyncStatus(repo);
    return NextResponse.json(status);
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
