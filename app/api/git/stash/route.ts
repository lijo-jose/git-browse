import { NextRequest, NextResponse } from 'next/server';
import { getStash } from '@/lib/git';

export async function GET(req: NextRequest) {
  const repo = req.nextUrl.searchParams.get('repo');
  if (!repo) return NextResponse.json({ error: 'repo required' }, { status: 400 });
  try {
    const stashes = await getStash(repo);
    return NextResponse.json({ stashes });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
