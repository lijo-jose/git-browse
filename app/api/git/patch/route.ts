import { NextRequest, NextResponse } from 'next/server';
import { getPatch } from '@/lib/git';
import { assertGitRepo } from '@/lib/validate';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const raw = searchParams.get('repo');
  if (!raw) return NextResponse.json({ error: 'repo required' }, { status: 400 });
  try {
    const repo = assertGitRepo(raw);
    const files = searchParams.getAll('file').filter(Boolean);
    const patch = await getPatch(repo, files.length > 0 ? files : undefined);
    return NextResponse.json({ patch });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
