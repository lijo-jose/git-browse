import { NextRequest, NextResponse } from 'next/server';
import { getCompareRefs, getCompareFiles, getCompareDiff } from '@/lib/git';
import { assertGitRepo } from '@/lib/validate';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const raw = searchParams.get('repo');
  const base = searchParams.get('base') || undefined;
  const target = searchParams.get('target') || 'HEAD';
  const file = searchParams.get('file') || undefined;
  const mode = searchParams.get('mode') || 'refs';

  if (!raw) return NextResponse.json({ error: 'repo required' }, { status: 400 });

  try {
    const repo = assertGitRepo(raw);

    if (mode === 'refs') {
      const refs = await getCompareRefs(repo);
      return NextResponse.json(refs);
    }

    if (!base) return NextResponse.json({ error: 'base required' }, { status: 400 });

    if (mode === 'files') {
      const files = await getCompareFiles(repo, base, target);
      return NextResponse.json({ files });
    }

    if (mode === 'diff') {
      const diff = await getCompareDiff(repo, base, file, target);
      return NextResponse.json({ diff });
    }

    return NextResponse.json({ error: 'invalid mode' }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
