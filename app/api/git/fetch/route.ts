import { NextRequest, NextResponse } from 'next/server';
import { fetchRepo } from '@/lib/git';

export async function POST(req: NextRequest) {
  const repo = req.nextUrl.searchParams.get('repo');
  if (!repo) return NextResponse.json({ error: 'repo required' }, { status: 400 });
  try {
    const result = await fetchRepo(repo);
    return NextResponse.json({ ok: true, result });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
