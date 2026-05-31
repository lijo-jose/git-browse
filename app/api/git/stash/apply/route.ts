import { NextRequest, NextResponse } from 'next/server';
import { applyStash, dropStash } from '@/lib/git';

export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const repo = searchParams.get('repo');
  const index = parseInt(searchParams.get('index') || '0');
  const action = searchParams.get('action') || 'apply';
  if (!repo) return NextResponse.json({ error: 'repo required' }, { status: 400 });
  try {
    if (action === 'drop') {
      await dropStash(repo, index);
    } else {
      await applyStash(repo, index);
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
