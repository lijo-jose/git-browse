import { NextRequest, NextResponse } from 'next/server';
import { createAndPushTag, getTags } from '@/lib/git';
import { assertGitRepo } from '@/lib/validate';

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('repo');
  if (!raw) return NextResponse.json({ error: 'repo required' }, { status: 400 });
  try {
    const repoPath = assertGitRepo(raw);
    const tags = await getTags(repoPath);
    return NextResponse.json({ tags });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { repo, tag } = await req.json();
    if (!repo) return NextResponse.json({ error: 'repo required' }, { status: 400 });
    if (!tag) return NextResponse.json({ error: 'tag required' }, { status: 400 });
    const repoPath = assertGitRepo(repo);
    const result = await createAndPushTag(repoPath, tag);
    return NextResponse.json({ ok: true, result });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
