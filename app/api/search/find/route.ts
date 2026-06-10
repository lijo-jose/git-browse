import { NextRequest, NextResponse } from 'next/server';
import { assertSafePath } from '@/lib/validate';
import { findFiles, searchSupported } from '@/lib/search';

export async function GET(req: NextRequest) {
  if (!searchSupported) {
    return NextResponse.json({ error: 'Search is not available on Windows' }, { status: 501 });
  }
  const params = req.nextUrl.searchParams;
  const dir = params.get('dir') || '';
  const pattern = params.get('pattern') || '';
  if (!pattern) return NextResponse.json({ error: 'Missing pattern' }, { status: 400 });

  try {
    const safe = assertSafePath(dir);
    const result = findFiles(safe, pattern);
    return NextResponse.json({ dir: safe, ...result });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
