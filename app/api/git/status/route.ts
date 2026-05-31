import { NextRequest, NextResponse } from 'next/server';
import { getStatus } from '@/lib/git';

export async function GET(req: NextRequest) {
  const repo = req.nextUrl.searchParams.get('repo');
  if (!repo) return NextResponse.json({ error: 'repo required' }, { status: 400 });
  try {
    const files = await getStatus(repo);
    return NextResponse.json({ files });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
