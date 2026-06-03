import { NextRequest, NextResponse } from 'next/server';
import { checkoutFiles, checkoutAllFiles } from '@/lib/git';
import { assertGitRepo } from '@/lib/validate';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const repo = assertGitRepo(body.repo);
    if (body.all) {
      await checkoutAllFiles(repo);
    } else {
      if (!Array.isArray(body.files) || body.files.length === 0)
        return NextResponse.json({ error: 'files required' }, { status: 400 });
      await checkoutFiles(repo, body.files);
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
