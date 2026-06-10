import { NextRequest, NextResponse } from 'next/server';
import {
  rebaseBranch, getRebaseCommits, getRebaseState, interactiveRebase,
  continueRebase, abortRebase, skipRebase, RebaseTodoEntry,
} from '@/lib/git';
import { assertGitRepo } from '@/lib/validate';

// GET ?repo=&base=  → commits an interactive rebase onto base would replay
// GET ?repo=        → current rebase state (in progress / conflicts)
export async function GET(req: NextRequest) {
  try {
    const repo = assertGitRepo(req.nextUrl.searchParams.get('repo') ?? '');
    const base = req.nextUrl.searchParams.get('base');
    if (base) return NextResponse.json({ ok: true, commits: getRebaseCommits(repo, base), state: getRebaseState(repo) });
    return NextResponse.json({ ok: true, state: getRebaseState(repo) });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

// POST { repo, branch }                  → plain rebase onto branch
// POST { repo, base, todo: [...] }       → interactive rebase
// POST { repo, action: continue|abort|skip }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const repo = assertGitRepo(body.repo);

    if (body.action === 'continue' || body.action === 'skip' || body.action === 'abort') {
      try {
        if (body.action === 'abort') {
          abortRebase(repo);
          return NextResponse.json({ ok: true, result: 'Rebase aborted', state: getRebaseState(repo) });
        }
        const state = body.action === 'continue' ? continueRebase(repo) : skipRebase(repo);
        return NextResponse.json({
          ok: true,
          result: state.inProgress ? 'Stopped again — resolve conflicts to continue' : 'Rebase completed',
          state,
        });
      } catch (err: unknown) {
        return NextResponse.json({ error: String(err), state: getRebaseState(repo) }, { status: 409 });
      }
    }

    if (Array.isArray(body.todo)) {
      if (!body.base) return NextResponse.json({ error: 'base required' }, { status: 400 });
      try {
        const result = interactiveRebase(repo, body.base, body.todo as RebaseTodoEntry[]);
        return NextResponse.json({ ok: true, result, state: getRebaseState(repo) });
      } catch (err: unknown) {
        const state = getRebaseState(repo);
        // A conflict pause is expected flow, not a hard failure.
        return NextResponse.json({ error: String(err), state }, { status: state.inProgress ? 409 : 400 });
      }
    }

    if (!body.branch) return NextResponse.json({ error: 'branch required' }, { status: 400 });
    const result = await rebaseBranch(repo, body.branch);
    return NextResponse.json({ ok: true, result });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
