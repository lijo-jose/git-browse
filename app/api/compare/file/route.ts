import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { createTwoFilesPatch } from 'diff';
import { assertSafePath } from '@/lib/validate';

export async function GET(req: NextRequest) {
  const left = req.nextUrl.searchParams.get('left');
  const right = req.nextUrl.searchParams.get('right');
  if (!left || !right) return NextResponse.json({ error: 'left and right required' }, { status: 400 });

  try {
    const leftPath = assertSafePath(left);
    const rightPath = assertSafePath(right);

    const leftContent = fs.existsSync(leftPath) ? fs.readFileSync(leftPath, 'utf8') : '';
    const rightContent = fs.existsSync(rightPath) ? fs.readFileSync(rightPath, 'utf8') : '';

    const patch = createTwoFilesPatch(leftPath, rightPath, leftContent, rightContent, '', '', { context: 3 });

    return NextResponse.json({ diff: patch, leftContent, rightContent });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
