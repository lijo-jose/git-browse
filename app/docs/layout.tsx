import Link from 'next/link';
import path from 'path';
import fs from 'fs';

const NAV = [
  { slug: 'index',              label: 'Overview' },
  { slug: 'explorer',           label: 'Explorer' },
  { slug: 'commit-log',         label: 'Commit Log' },
  { slug: 'changes',            label: 'Changes' },
  { slug: 'branches',           label: 'Branches & Tags' },
  { slug: 'compare',            label: 'Compare' },
  { slug: 'search',             label: 'Search' },
  { slug: 'insights',           label: 'Insights' },
  { slug: 'settings',           label: 'Repository Settings' },
  { slug: 'keyboard-shortcuts', label: 'Keyboard Shortcuts' },
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Sidebar */}
      <aside
        className="w-56 flex-shrink-0 flex flex-col border-r overflow-y-auto"
        style={{ background: 'var(--bg-panel)', borderColor: 'color-mix(in oklch, var(--border-subtle) 60%, transparent)' }}
      >
        <div className="px-4 pt-5 pb-3">
          <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--text-dim)' }}>
            User Guide
          </p>
        </div>
        <nav className="flex-1 px-2 pb-4 space-y-0.5">
          {NAV.map(item => (
            <NavLink key={item.slug} slug={item.slug} label={item.label} />
          ))}
        </nav>
        <div className="px-4 py-4 border-t space-y-2" style={{ borderColor: 'color-mix(in oklch, var(--border-subtle) 40%, transparent)' }}>
          <a
            href="https://github.com/lijo-jose/git-browse"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-xs transition-colors"
            style={{ color: 'var(--text-dim)' }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            GitHub
          </a>
          <a
            href="https://www.lijojose.com/open-source/git-browse"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-xs transition-colors"
            style={{ color: 'var(--text-dim)' }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1z"/>
              <path d="M1 8h14M8 1c-1.5 2-2.5 4.5-2.5 7S6.5 13 8 15M8 1c1.5 2 2.5 4.5 2.5 7S9.5 13 8 15"/>
            </svg>
            Product page
          </a>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto min-w-0">
        {children}
      </main>
    </div>
  );
}

function NavLink({ slug, label }: { slug: string; label: string }) {
  const href = slug === 'index' ? '/docs' : `/docs/${slug}`;
  return (
    <Link
      href={href}
      className="flex items-center px-3 py-1.5 rounded-lg text-sm transition-colors"
      style={{ color: 'var(--text-soft)' }}
    >
      {label}
    </Link>
  );
}
