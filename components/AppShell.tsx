'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';
import CommandPalette from './CommandPalette';
import OperationDrawer from './OperationDrawer';
import { Toaster } from './ui/sonner';

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
      href: '/compare',
      label: 'Compare',
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
    {
      href: '/docs',
      label: 'Documentation',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
        </svg>
      ),
    },
  ];

  // Carry the current repo into Compare (git mode) so context follows the user
  const hrefFor = (item: NavItem) => {
    if (item.href !== '/compare' || !lastRepo) return item.href;
    return `/compare?mode=git&repo=${encodeURIComponent(lastRepo)}`;
  };

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Narrow-viewport gate — shown below md breakpoint (< 768px) */}
      <div className="md:hidden fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-5 px-8 text-center"
        style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--bg-raised)' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-dim)' }}>
            <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
          </svg>
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold">Desktop required</p>
          <p className="text-xs leading-relaxed max-w-[260px]" style={{ color: 'var(--text-dim)' }}>
            git-browse is a desktop tool. Please open it on a wider screen.
          </p>
        </div>
      </div>

      {/* Activity rail */}
      <nav className="w-12 flex-shrink-0 flex flex-col items-center py-2 gap-1 bg-[var(--bg-panel)] border-r border-[var(--border-subtle)]/60 select-none">
        <Link href="/" title="Git Browse" className="w-7 h-7 mb-2 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 56 56" aria-label="Git Browse">
            <rect width="56" height="56" rx="14" fill="#1e293b"/>
            <path d="M18 42 V22 Q18 16 24 16 H30" stroke="#f97316" strokeWidth="4" fill="none" strokeLinecap="round"/>
            <circle cx="18" cy="42" r="4.5" fill="#e2e8f0"/>
            <circle cx="33" cy="30" r="8" fill="none" stroke="#e2e8f0" strokeWidth="3.5"/>
            <circle cx="33" cy="30" r="2.5" fill="#38bdf8"/>
            <line x1="39" y1="36" x2="45" y2="42" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round"/>
          </svg>
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

      {/* Page content + operation drawer */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-hidden">
          {children}
        </div>
        <OperationDrawer />
      </div>

      <CommandPalette />
      <Toaster position="bottom-right" />
    </div>
  );
}
