import { NextRequest, NextResponse } from 'next/server';
import { getGitIdentity, setGitIdentity } from '@/lib/git';
import { assertGitRepo } from '@/lib/validate';

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('repo');
  if (!raw) return NextResponse.json({ error: 'repo required' }, { status: 400 });
  try {
    const repo = assertGitRepo(raw);
    return NextResponse.json(getGitIdentity(repo));
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { repo, key, value, scope } = await req.json();
    if (!repo) return NextResponse.json({ error: 'repo required' }, { status: 400 });
    if (!['user.name', 'user.email'].includes(key)) return NextResponse.json({ error: 'invalid key' }, { status: 400 });
    if (!['local', 'global'].includes(scope)) return NextResponse.json({ error: 'scope must be local or global' }, { status: 400 });
    const repoPath = assertGitRepo(repo);
    setGitIdentity(repoPath, key, value ?? '', scope);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
