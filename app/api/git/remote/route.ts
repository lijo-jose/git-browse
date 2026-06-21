import { NextRequest, NextResponse } from 'next/server';
import { addRemote, removeRemote, setRemoteUrl } from '@/lib/git';
import { assertGitRepo } from '@/lib/validate';

export async function POST(req: NextRequest) {
  try {
    const { repo, name, url } = await req.json();
    if (!repo) return NextResponse.json({ error: 'repo required' }, { status: 400 });
    if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });
    if (!url?.trim()) return NextResponse.json({ error: 'url required' }, { status: 400 });
    const repoPath = assertGitRepo(repo);
    addRemote(repoPath, name.trim(), url.trim());
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { repo, name, url, pushUrl } = await req.json();
    if (!repo) return NextResponse.json({ error: 'repo required' }, { status: 400 });
    if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });
    if (!url?.trim()) return NextResponse.json({ error: 'url required' }, { status: 400 });
    const repoPath = assertGitRepo(repo);
    setRemoteUrl(repoPath, name.trim(), url.trim(), !!pushUrl);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { repo, name } = await req.json();
    if (!repo) return NextResponse.json({ error: 'repo required' }, { status: 400 });
    if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });
    const repoPath = assertGitRepo(repo);
    removeRemote(repoPath, name.trim());
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
