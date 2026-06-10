'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';

const LAST_REPO_KEY = 'git-browser-last-repo';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [searchAvailable, setSearchAvailable] = useState(true);
  const [lastRepo, setLastRepo] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/system')
      .then(r => r.json())
      .then(d => setSearchAvailable(d.platform !== 'win32'))
      .catch(() => {});
  }, []);

  useEffect(() => {
    try { setLastRepo(localStorage.getItem(LAST_REPO_KEY)); } catch {}
  }, [pathname]);

  const items: NavItem[] = [
    {
      href: '/',
      label: 'Repository',
      icon: (
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="3" r="1.8"/><circle cx="3.5" cy="12.5" r="1.8"/><circle cx="12.5" cy="12.5" r="1.8"/>
          <path d="M8 5v2.5M8 7.5L4.3 11M8 7.5l3.7 3.5"/>
        </svg>
      ),
    },
    {
      href: '/git-compare',
      label: 'Git Compare',
      icon: (
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="4" cy="3" r="1.5"/><circle cx="4" cy="13" r="1.5"/><circle cx="12" cy="3" r="1.5"/>
          <line x1="4" y1="4.5" x2="4" y2="11.5"/><path d="M4 6a4 4 0 004 4h3"/><path d="M10 7.5l1.5-1.5L10 4.5"/>
        </svg>
      ),
    },
    {
      href: '/compare',
      label: 'Compare files / folders',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 6H5a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-3"/>
          <rect x="11" y="3" width="10" height="10" rx="2"/>
        </svg>
      ),
    },
    ...(searchAvailable ? [{
      href: '/search',
      label: 'Search',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      ),
    }] : []),
  ];

  // Carry the current repo into Git Compare so context follows the user
  const hrefFor = (item: NavItem) => {
    if (item.href !== '/git-compare' || !lastRepo) return item.href;
    return `/git-compare?repo=${encodeURIComponent(lastRepo)}`;
  };

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Activity rail */}
      <nav className="w-12 flex-shrink-0 flex flex-col items-center py-2 gap-1 bg-[var(--bg-panel)] border-r border-[var(--border-subtle)]/60 select-none">
        <Link href="/" title="GitBrowse" className="w-7 h-7 mb-2 rounded-md bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
          G
        </Link>

        {items.map(item => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={hrefFor(item)}
              title={item.label}
              aria-current={active ? 'page' : undefined}
              className={`relative w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
                active
                  ? 'text-primary bg-primary/10'
                  : 'text-[var(--text-dim)] hover:text-foreground hover:bg-[var(--bg-raised)]'
              }`}
            >
              {active && <span className="absolute left-[-6px] top-2 bottom-2 w-[2px] rounded-full bg-primary" />}
              {item.icon}
            </Link>
          );
        })}

        <div className="mt-auto flex flex-col items-center gap-1">
          <ThemeToggle placement="rail" />
        </div>
      </nav>

      {/* Page content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
