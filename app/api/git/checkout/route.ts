import { NextRequest, NextResponse } from 'next/server';
import { checkoutBranch } from '@/lib/git';

export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const repo = searchParams.get('repo');
  const branch = searchParams.get('branch');
  if (!repo || !branch) return NextResponse.json({ error: 'repo and branch required' }, { status: 400 });
  try {
    await checkoutBranch(repo, branch);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
