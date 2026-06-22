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
    const isPermission = err instanceof Error && (err as NodeJS.ErrnoException).code === 'EPERM' ||
                         err instanceof Error && (err as NodeJS.ErrnoException).code === 'EACCES';
    return NextResponse.json({ error: String(err), code: isPermission ? 'EPERM' : 'ERR' }, { status: 400 });
  }
}
