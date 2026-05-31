import { NextRequest, NextResponse } from 'next/server';
import { listDirectory, resolvePath } from '@/lib/fs';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const p = searchParams.get('path') || '~';
  try {
    const resolved = resolvePath(p);
    const entries = listDirectory(resolved);
    return NextResponse.json({ path: resolved, entries });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
