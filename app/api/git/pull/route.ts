import { NextRequest, NextResponse } from 'next/server';
import { pullRepo } from '@/lib/git';

export async function POST(req: NextRequest) {
  const repo = req.nextUrl.searchParams.get('repo');
  if (!repo) return NextResponse.json({ error: 'repo required' }, { status: 400 });
  try {
    const result = await pullRepo(repo);
    return NextResponse.json({ ok: true, result });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
