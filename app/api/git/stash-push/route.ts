import { NextRequest, NextResponse } from 'next/server';
import { pushStash } from '@/lib/git';
import { assertGitRepo } from '@/lib/validate';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const repo = assertGitRepo(body.repo);
    const result = await pushStash(repo, body.message);
    return NextResponse.json({ ok: true, result });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
