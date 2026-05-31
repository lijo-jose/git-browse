import { NextRequest, NextResponse } from 'next/server';
import { stageFiles } from '@/lib/git';
import { assertGitRepo } from '@/lib/validate';

export async function POST(req: NextRequest) {
  try {
    const { repo, files } = await req.json();
    if (!repo) return NextResponse.json({ error: 'repo required' }, { status: 400 });
    if (!Array.isArray(files) || files.length === 0)
      return NextResponse.json({ error: 'files required' }, { status: 400 });
    const repoPath = assertGitRepo(repo);
    await stageFiles(repoPath, files);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
