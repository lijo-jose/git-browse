import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { assertGitRepo } from '@/lib/validate';

export interface NetworkCommit {
  hash: string;
  shortHash: string;
  subject: string;
  author: string;
  date: string;
  parents: string[];  // space-separated parent hashes from %P, split into array
  refs: string[];     // comma-separated refs from %D, split and trimmed
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('repo');
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '120'), 300);
  if (!raw) return NextResponse.json({ error: 'repo required' }, { status: 400 });

  try {
    const repo = assertGitRepo(raw);
    // Use git's %x00 escape so the command string has no NUL bytes;
    // the output will have NUL as field separator, newline as record separator.
    const out = execSync(
      'git log --all --topo-order --pretty=format:"%H%x00%h%x00%P%x00%D%x00%s%x00%an%x00%ar" -n ' + limit,
      { cwd: repo, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    );

    const commits: NetworkCommit[] = out.trim().split('\n').filter(Boolean).map(line => {
      const [hash, shortHash, parentsStr, refsStr, subject, author, date] = line.split('\x00');
      return {
        hash:      hash      ?? '',
        shortHash: shortHash ?? '',
        subject:   subject   ?? '',
        author:    author    ?? '',
        date:      date      ?? '',
        parents:   (parentsStr ?? '').split(' ').filter(Boolean),
        refs:      (refsStr   ?? '').split(',').map(r => r.trim()).filter(Boolean),
      };
    });

    return NextResponse.json({ commits });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
