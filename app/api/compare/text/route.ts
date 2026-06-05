import { NextRequest, NextResponse } from 'next/server';
import { createTwoFilesPatch } from 'diff';

export async function POST(req: NextRequest) {
  try {
    const { leftContent, rightContent, leftLabel, rightLabel } = await req.json() as {
      leftContent: string; rightContent: string; leftLabel?: string; rightLabel?: string;
    };
    if (leftContent === undefined || rightContent === undefined) {
      return NextResponse.json({ error: 'leftContent and rightContent required' }, { status: 400 });
    }
    const patch = createTwoFilesPatch(
      leftLabel || 'Left', rightLabel || 'Right',
      leftContent, rightContent, '', '', { context: 3 }
    );
    return NextResponse.json({ diff: patch });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
