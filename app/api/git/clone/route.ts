import { NextRequest, NextResponse } from 'next/server';
import { cloneRepo } from '@/lib/git';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { remote, directory, name } = body;
    if (!remote?.trim()) return NextResponse.json({ error: 'remote URL required' }, { status: 400 });
    if (!directory?.trim()) return NextResponse.json({ error: 'directory required' }, { status: 400 });

    const dir = directory.startsWith('~')
      ? path.join(process.env.HOME || '', directory.slice(1))
      : directory;

    const clonedPath = await cloneRepo(remote.trim(), dir, name?.trim() || undefined);
    return NextResponse.json({ ok: true, path: clonedPath });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
