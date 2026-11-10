// ABOUTME: Authenticated app shell — sidebar navigation, league selector, user section.
// ABOUTME: Rendered as the root layout route; child routes render via <Outlet />.

import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useLeague } from '@/lib/league-context';
import { Toaster } from '@/components/ui/toaster';
import { ConfirmProvider } from '@/components/ui/confirm-dialog';
import { checkForUpdate } from '@/lib/updater';
import { useCommunityServerUrl } from '@/lib/hooks/use-community';
import { Zap, Sword, BarChart3, Globe, TreePine, Archive, LogOut, Menu, Settings, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { SimpleSelect } from '@/components/ui/select';

interface NavItemProps {
  href: string;
  icon: ReactNode;
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
      <span aria-hidden="true">{icon}</span>
      <span className="tracking-wide">{label}</span>
    </Link>
  );
}

export function AppLayout() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();
  const { leagues, currentLeague, setLeague, pricesLoading } = useLeague();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(() => window.innerWidth < 1280);
  // Below lg the sidebar is a drawer with no collapse toggle, so show it expanded
  // when opened — otherwise the league selector is unreachable.
  const collapsed = navCollapsed && !sidebarOpen;

  // Close the mobile drawer after navigating.
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  useEffect(() => { void checkForUpdate(); }, []);

  // Push any saved community server override to Rust before anything talks to the server.
  useCommunityServerUrl();

  const navItems = [
    { href: '/dashboard', icon: <Zap size={18} />, label: 'Dashboard' },
    { href: '/filters', icon: <Sword size={18} />, label: 'Regex Filters' },
    { href: '/strategies', icon: <BarChart3 size={18} />, label: 'Strategies' },
    { href: '/community', icon: <Globe size={18} />, label: 'Community' },
    { href: '/atlas-tree', icon: <TreePine size={18} />, label: 'Atlas Tree' },
    { href: '/stash', icon: <Archive size={18} />, label: 'Stash', requiresAuth: true },
    { href: '/settings', icon: <Settings size={18} />, label: 'Settings' },
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
          fixed inset-y-0 left-0 z-40 flex h-screen flex-col overflow-hidden border-r border-poe-border/40 bg-poe-bg
          transition-all duration-200 lg:static lg:translate-x-0
          ${collapsed ? 'w-14' : 'w-56'}
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo + collapse toggle */}
        <div className="flex h-14 items-center justify-between border-b border-poe-border/30 px-3">
          {!collapsed && (
            <Link to="/dashboard" className="flex items-center gap-2 font-display text-sm tracking-[0.25em] text-poe-gold">
              <img src="/logo.png" alt="" className="h-6 w-6" />
              N.I.K.O.
            </Link>
          )}
          <button
            onClick={() => setNavCollapsed((prev) => !prev)}
            className="hidden rounded p-1 text-poe-text-muted hover:bg-poe-panel-light hover:text-poe-text lg:block"
            title={navCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={navCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="mt-4 flex-1 space-y-0.5 overflow-y-auto" aria-label="Main navigation">
          {navItems.map((item) => (
            collapsed ? (
              <Link
                key={item.href}
                to={item.href}
                title={item.label}
                aria-label={item.label}
                className={`
                  flex items-center justify-center py-2.5 transition-all duration-150
                  ${pathname === item.href
                    ? 'border-r-2 border-poe-gold bg-poe-gold/5 text-poe-gold'
                    : 'requiresAuth' in item && item.requiresAuth && !isAuthenticated
                      ? 'text-poe-text-muted opacity-50 hover:bg-poe-panel-light hover:opacity-70'
                      : 'text-poe-text-dim hover:bg-poe-panel-light hover:text-poe-text'
                  }
                `}
              >
                {item.icon}
              </Link>
            ) : (
              <NavItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                active={pathname === item.href}
                dimmed={'requiresAuth' in item && item.requiresAuth && !isAuthenticated}
              />
            )
          ))}
        </nav>

        {/* League selector */}
        {!collapsed && (
          <div className="mx-4 mt-auto">
            <label className="mb-1 block text-[10px] tracking-wider text-poe-text-muted">
              LEAGUE
            </label>
            <SimpleSelect
              value={currentLeague}
              onValueChange={setLeague}
              options={leagues.map((l) => ({ value: l.id, label: l.text }))}
              size="sm"
              aria-label="League"
            />
            {pricesLoading && (
              <p className="mt-1 text-[10px] text-poe-gold/70 animate-pulse">
                Fetching prices...
              </p>
            )}
          </div>
        )}

        {/* Divider */}
        {!collapsed && <div className="mx-4 mt-3 h-px bg-poe-border/30" aria-hidden="true" />}

        {/* User section */}
        <div className={collapsed ? 'p-2' : 'p-4'}>
          {collapsed ? (
            <div className="flex justify-center">
              {isAuthenticated ? (
                <button
                  onClick={() => { void logout(); }}
                  className="rounded p-1.5 text-poe-text-muted hover:bg-poe-panel-light hover:text-poe-error"
                  title="Logout"
                  aria-label="Logout"
                >
                  <LogOut size={16} />
                </button>
              ) : (
                <button
                  onClick={() => { void login(); }}
                  disabled={isLoading}
                  className="rounded p-1.5 text-poe-text-muted hover:bg-poe-panel-light hover:text-poe-gold disabled:opacity-50"
                  title="Login with GGG"
                  aria-label="Login with GGG"
                >
                  <Zap size={16} />
                </button>
              )}
            </div>
          ) : isAuthenticated && user !== null ? (
            <div className="flex items-center justify-between">
              <p className="min-w-0 truncate text-xs text-poe-text-muted">@<span className="text-poe-text">{user.username}</span></p>
              <button
                onClick={() => { void logout(); }}
                className="shrink-0 rounded p-1.5 text-poe-text-muted transition-colors hover:bg-poe-panel-light hover:text-poe-error"
                title="Logout"
                aria-label="Logout"
              >
                <LogOut size={16} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="min-w-0">
                <p className="truncate text-sm text-poe-text">Exile</p>
                <p className="truncate text-xs text-poe-text-muted">Not connected</p>
              </div>
              <button
                onClick={() => { void login(); }}
                disabled={isLoading}
                className="w-full border border-poe-gold/40 px-3 py-2 text-xs tracking-wider text-poe-gold transition-colors hover:border-poe-gold/70 hover:bg-poe-gold/5 disabled:opacity-50"
              >
                {isLoading ? 'Connecting...' : 'Login with GGG'}
              </button>
            </div>
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
            <Menu size={20} aria-hidden="true" />
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
      <Toaster />
      <ConfirmProvider />
    </div>
  );
}
