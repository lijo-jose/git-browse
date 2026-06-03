import { NextRequest, NextResponse } from 'next/server';
import { createBranch, deleteBranch } from '@/lib/git';
import { assertGitRepo } from '@/lib/validate';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const repo = assertGitRepo(body.repo);
    if (!body.name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    await createBranch(repo, body.name);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const repo = assertGitRepo(body.repo);
    if (!body.name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    await deleteBranch(repo, body.name, body.force ?? false);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
