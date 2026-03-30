// ABOUTME: Dashboard page — the exile's command center after login.
// ABOUTME: Shows quick stats, recent filters, and shortcuts to main features.

'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useRegexFilters } from '@/lib/hooks/use-regex-filters';
import { Badge } from '@/components/ui/badge';

function StatCard({ value, label, icon }: { value: string; label: string; icon: string }) {
  return (
    <div className="border border-poe-border/40 bg-poe-panel/30 p-5">
      <div className="flex items-center justify-between">
        <span className="text-2xl" aria-hidden="true">{icon}</span>
        <span className="font-display text-2xl text-poe-gold">{value}</span>
      </div>
      <p className="mt-2 text-xs tracking-wider text-poe-text-muted">{label}</p>
    </div>
  );
}

function QuickAction({ href, icon, title, description }: {
  href: string;
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-4 border border-poe-border/30 bg-poe-panel/20 p-4 transition-all duration-200 hover:border-poe-gold/30 hover:bg-poe-panel/40"
    >
      <span className="mt-0.5 text-xl" aria-hidden="true">{icon}</span>
      <div>
        <h3 className="text-sm font-medium text-poe-text group-hover:text-poe-gold">
          {title}
        </h3>
        <p className="mt-0.5 text-xs text-poe-text-muted">{description}</p>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: filtersResponse } = useRegexFilters(1, 5);

  const filters = filtersResponse?.data ?? [];
  const totalFilters = filtersResponse?.meta?.total ?? 0;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="font-display text-xl tracking-wide text-poe-text">
          Welcome back, <span className="text-poe-gold">{user?.displayName}</span>
        </h1>
        <p className="mt-1 text-sm text-poe-text-muted">
          Your trading post awaits.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard value={String(totalFilters)} label="ACTIVE FILTERS" icon="⚔️" />
        <StatCard value="—" label="TRADES TODAY" icon="💰" />
        <StatCard value="—" label="PROFIT (CHAOS)" icon="📈" />
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent filters */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xs tracking-[0.3em] text-poe-text-muted">
              RECENT FILTERS
            </h2>
            <Link
              href="/filters"
              className="text-xs text-poe-text-dim transition-colors hover:text-poe-gold"
            >
              View all &rarr;
            </Link>
          </div>

          {filters.length === 0 ? (
            <div className="border border-dashed border-poe-border/30 p-8 text-center">
              <p className="text-sm text-poe-text-dim">No filters yet.</p>
              <Link
                href="/filters"
                className="mt-2 inline-block text-xs text-poe-gold hover:underline"
              >
                Create your first filter
              </Link>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filters.map((filter) => (
                <div
                  key={filter.id}
                  className="flex items-center justify-between border border-poe-border/20 bg-poe-panel/20 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-poe-text">{filter.name}</p>
                    <p className="mt-0.5 truncate font-mono text-xs text-poe-text-muted">
                      {filter.pattern}
                    </p>
                  </div>
                  <Badge variant={filter.category}>{filter.category}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="mb-3 font-display text-xs tracking-[0.3em] text-poe-text-muted">
            QUICK ACTIONS
          </h2>
          <div className="space-y-2">
            <QuickAction
              href="/filters"
              icon="⚔️"
              title="Create a Regex Filter"
              description="Build a pattern to match the stats you want"
            />
            <QuickAction
              href="/trade"
              icon="💰"
              title="Search Trade"
              description="Find items matching your filters on the trade site"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
