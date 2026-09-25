'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getUser, clearSession, AuthUser } from '@/lib/api';
import { ThemeToggle } from './ui';

export function Nav() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setUser(getUser());
  }, [pathname]);

  const logout = () => {
    clearSession();
    setUser(null);
    router.push('/');
  };

  const links: Array<{ href: string; label: string }> = [];
  if (user?.role === 'candidate') {
    links.push(
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/jobs', label: 'Job Search' },
      { href: '/recommendations', label: 'Recommendations' },
      { href: '/saved', label: 'Saved' },
      { href: '/applications', label: 'Applications' },
      { href: '/roadmap', label: 'Roadmap' },
      { href: '/analytics', label: 'Analytics' }
    );
  } else if (user?.role === 'recruiter') {
    links.push(
      { href: '/recruiter', label: 'Dashboard' },
      { href: '/recruiter/post', label: 'Post Job' },
      { href: '/recruiter/candidates', label: 'Candidates' },
      { href: '/analytics', label: 'Analytics' }
    );
  }

  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
        <Link href="/" className="font-bold text-lg whitespace-nowrap">
          🎯 Talent<span style={{ color: 'var(--accent)' }}>Match</span>
        </Link>
        <nav className="hidden md:flex gap-1 flex-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="px-3 py-1.5 rounded-lg text-sm"
              style={
                pathname === l.href
                  ? { background: 'var(--accent)', color: 'white' }
                  : { color: 'var(--muted)' }
              }
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 ml-auto">
          <ThemeToggle />
          {user ? (
            <>
              <span className="text-xs muted hidden sm:inline">{user.name} ({user.role})</span>
              <button className="btn btn-ghost" onClick={logout}>Logout</button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost">Login</Link>
              <Link href="/register" className="btn btn-primary">Register</Link>
            </>
          )}
          {links.length > 0 && (
            <button className="btn btn-ghost md:hidden" aria-label="Menu" onClick={() => setMenuOpen(!menuOpen)}>
              ☰
            </button>
          )}
        </div>
      </div>
      {menuOpen && links.length > 0 && (
        <nav className="md:hidden border-t px-4 py-2 space-y-1" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="block px-3 py-2 rounded-lg text-sm"
              style={pathname === l.href ? { background: 'var(--accent)', color: 'white' } : { color: 'var(--muted)' }}
              onClick={() => setMenuOpen(false)}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
