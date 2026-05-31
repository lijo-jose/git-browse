import { NextRequest, NextResponse } from 'next/server';
import { listDirectory } from '@/lib/fs';
import { assertSafePath } from '@/lib/validate';

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('path') || '~';
  try {
    const safe = assertSafePath(raw);
    const entries = listDirectory(safe);
    return NextResponse.json({ path: safe, entries });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
