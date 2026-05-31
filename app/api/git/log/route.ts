import { NextRequest, NextResponse } from 'next/server';
import { getLog } from '@/lib/git';

export async function GET(req: NextRequest) {
  const repo = req.nextUrl.searchParams.get('repo');
  const page = parseInt(req.nextUrl.searchParams.get('page') || '0');
  if (!repo) return NextResponse.json({ error: 'repo required' }, { status: 400 });
  try {
    const lines = getLog(repo, page);
    return NextResponse.json({ lines });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
