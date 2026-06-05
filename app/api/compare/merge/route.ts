import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { assertSafePath } from '@/lib/validate';

export async function POST(req: NextRequest) {
  try {
    const { target, content } = await req.json() as { target: string; content: string };
    if (!target || content === undefined) return NextResponse.json({ error: 'target and content required' }, { status: 400 });

    const targetPath = assertSafePath(target);
    fs.writeFileSync(targetPath, content, 'utf8');
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
