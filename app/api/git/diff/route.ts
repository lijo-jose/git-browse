import { NextRequest, NextResponse } from 'next/server';
import { getDiff } from '@/lib/git';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const repo = searchParams.get('repo');
  const file = searchParams.get('file') || undefined;
  const commit = searchParams.get('commit') || undefined;
  if (!repo) return NextResponse.json({ error: 'repo required' }, { status: 400 });
  try {
    const diff = await getDiff(repo, file, commit);
    return NextResponse.json({ diff });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
