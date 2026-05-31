import { NextRequest, NextResponse } from 'next/server';
import { commitChanges } from '@/lib/git';
import { assertGitRepo } from '@/lib/validate';

export async function POST(req: NextRequest) {
  try {
    const { repo, message, all } = await req.json();
    if (!repo) return NextResponse.json({ error: 'repo required' }, { status: 400 });
    if (!message?.trim()) return NextResponse.json({ error: 'message required' }, { status: 400 });
    const repoPath = assertGitRepo(repo);
    const result = await commitChanges(repoPath, message.trim(), !!all);
    return NextResponse.json({ ok: true, result });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
