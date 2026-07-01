import { NextRequest, NextResponse } from 'next/server';
import { applyPatch } from '@/lib/git';
import { assertGitRepo } from '@/lib/validate';

export async function POST(req: NextRequest) {
  try {
    const { repo: raw, patch } = await req.json();
    if (!raw) return NextResponse.json({ error: 'repo required' }, { status: 400 });
    if (!patch || typeof patch !== 'string') return NextResponse.json({ error: 'patch content required' }, { status: 400 });
    const repo = assertGitRepo(raw);
    const result = await applyPatch(repo, patch);
    return NextResponse.json({ result });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
