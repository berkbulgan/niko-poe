// ABOUTME: Authenticated app shell — sidebar navigation, league selector, user section.
// ABOUTME: Rendered as the root layout route; child routes render via <Outlet />.

import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useLeague } from '@/lib/league-context';

interface NavItemProps {
  href: string;
  icon: string;
  label: string;
  active: boolean;
  dimmed?: boolean;
}

function NavItem({ href, icon, label, active, dimmed = false }: NavItemProps) {
  return (
    <Link
      to={href}
      className={`
        flex items-center gap-3 px-4 py-2.5 text-sm transition-all duration-150
        ${active
          ? 'border-r-2 border-poe-gold bg-poe-gold/5 text-poe-gold'
          : dimmed
            ? 'text-poe-text-muted opacity-50 hover:bg-poe-panel-light hover:opacity-70'
            : 'text-poe-text-dim hover:bg-poe-panel-light hover:text-poe-text'
        }
      `}
    >
      <span className="text-base" aria-hidden="true">{icon}</span>
      <span className="tracking-wide">{label}</span>
    </Link>
  );
}

export function AppLayout() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();
  const { leagues, currentLeague, setLeague } = useLeague();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { href: '/dashboard', icon: '⚡', label: 'Dashboard' },
    { href: '/filters', icon: '⚔️', label: 'Regex Filters' },
    { href: '/strategies', icon: '📊', label: 'Strategies' },
    { href: '/atlas-tree', icon: '🌳', label: 'Atlas Tree' },
    { href: '/stash', icon: '🗄️', label: 'Stash', requiresAuth: true },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 flex h-screen w-56 flex-col overflow-hidden border-r border-poe-border/40 bg-poe-bg
          transition-transform duration-200 lg:static lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="flex h-14 items-center border-b border-poe-border/30 px-4">
          <Link to="/dashboard" className="font-display text-sm tracking-[0.25em] text-poe-gold">
            N.I.K.O.
          </Link>
        </div>

        {/* Navigation */}
        <nav className="mt-4 flex-1 space-y-0.5 overflow-y-auto" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={pathname === item.href}
              dimmed={'requiresAuth' in item && item.requiresAuth && !isAuthenticated}
            />
          ))}
        </nav>

        {/* League selector */}
        <div className="mx-4 mt-auto">
          <label className="mb-1 block text-[10px] tracking-wider text-poe-text-muted">
            LEAGUE
          </label>
          <select
            value={currentLeague}
            onChange={(e) => setLeague(e.target.value)}
            className="w-full border border-poe-border/40 bg-poe-panel px-2 py-1.5 text-xs text-poe-text focus:border-poe-gold/50 focus:outline-none"
          >
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>{l.text}</option>
            ))}
          </select>
        </div>

        {/* Divider */}
        <div className="mx-4 mt-3 h-px bg-poe-border/30" aria-hidden="true" />

        {/* User section */}
        <div className="p-4">
          {isAuthenticated && user !== null ? (
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm text-poe-text">{user.displayName}</p>
                <p className="truncate text-xs text-poe-text-muted">@{user.username}</p>
              </div>
              <button
                onClick={() => { void logout(); }}
                className="shrink-0 rounded p-1.5 text-poe-text-muted transition-colors hover:bg-poe-panel-light hover:text-poe-error"
                title="Logout"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M11 11l3-3-3-3M5.5 8H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={() => { void login(); }}
              disabled={isLoading}
              className="w-full border border-poe-gold/40 px-3 py-2 text-xs tracking-wider text-poe-gold transition-colors hover:border-poe-gold/70 hover:bg-poe-gold/5 disabled:opacity-50"
            >
              {isLoading ? 'Connecting...' : 'Login with GGG'}
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="flex h-14 items-center border-b border-poe-border/30 px-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded p-1.5 text-poe-text-dim hover:bg-poe-panel-light hover:text-poe-text"
            aria-label="Open menu"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <span className="ml-3 font-display text-xs tracking-[0.2em] text-poe-gold">
            N.I.K.O.
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
