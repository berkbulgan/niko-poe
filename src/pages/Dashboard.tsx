// ABOUTME: Dashboard page — the exile's command center after login.
// ABOUTME: Shows saved presets/strategies count, recent presets, and shortcuts to main features.

import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useFilterPresets } from '@/lib/hooks/use-filter-presets';
import { useStrategies } from '@/lib/hooks/use-strategies';
import { useRecentSnapshots } from '@/lib/hooks/use-snapshots';
import { useLeague } from '@/lib/league-context';
import { useCurrencyDisplay } from '@/lib/stores/currency-display-store';
import { PoeIcon } from '@/components/ui/poe-icon';

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
      to={href}
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

function formatTimeAgo(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export function Dashboard() {
  const { user } = useAuth();
  const { currentLeague } = useLeague();
  const { data: presets } = useFilterPresets();
  const { data: strategies } = useStrategies();

  const { data: recentSnaps } = useRecentSnapshots();
  const { unit } = useCurrencyDisplay();

  const presetCount = presets?.length ?? 0;
  const strategyCount = strategies?.length ?? 0;
  const recentPresets = (presets ?? []).slice(0, 5);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="font-display text-xl tracking-wide text-poe-text">
          Welcome back, <span className="text-poe-gold">{user?.displayName}</span>
        </h1>
        <p className="mt-1 text-sm text-poe-text-muted">
          League: <span className="text-poe-currency">{currentLeague}</span>
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard value={String(presetCount)} label="FILTER PRESETS" icon="⚔️" />
        <StatCard value={String(strategyCount)} label="STRATEGIES" icon="📊" />
        <StatCard value={currentLeague} label="ACTIVE LEAGUE" icon="🌐" />
      </div>

      {/* Recent Snapshots */}
      {(recentSnaps ?? []).length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xs tracking-[0.3em] text-poe-text-muted">
              RECENT SNAPSHOTS
            </h2>
            <Link
              to="/stash"
              className="text-xs text-poe-text-dim transition-colors hover:text-poe-gold"
            >
              View all &rarr;
            </Link>
          </div>
          <div className="space-y-1.5">
            {(recentSnaps ?? []).map((snap, i) => {
              const divineRate = snap.divineRate || 150;
              const displayValue = unit === 'divine' && divineRate > 0
                ? (snap.totalChaos / divineRate).toFixed(1)
                : snap.totalChaos.toFixed(0);
              const currIcon = unit === 'divine' ? 'divine' : 'chaos';
              const prevSnap = (recentSnaps ?? [])[i + 1];
              const delta = prevSnap ? snap.totalChaos - prevSnap.totalChaos : null;
              const deltaDisplay = delta !== null
                ? unit === 'divine' && divineRate > 0
                  ? (delta / divineRate).toFixed(1)
                  : delta.toFixed(0)
                : null;
              const d = new Date(snap.createdAt + 'Z');
              const timeAgo = formatTimeAgo(d);

              return (
                <Link
                  key={snap.id}
                  to="/stash"
                  className="flex items-center justify-between border border-poe-border/20 bg-poe-panel/20 px-4 py-3 transition-colors hover:bg-poe-panel/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-poe-text">{snap.configName}</p>
                    <p className="mt-0.5 text-xs text-poe-text-muted">
                      {snap.totalItems} items · {timeAgo}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-sm font-medium tabular-nums text-poe-currency">
                      {displayValue}
                      <PoeIcon name={currIcon} size={14} />
                    </span>
                    {deltaDisplay !== null && (
                      <span className={`text-xs tabular-nums ${
                        delta! >= 0 ? 'text-poe-success' : 'text-red-400'
                      }`}>
                        {delta! >= 0 ? '+' : ''}{deltaDisplay}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent presets */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xs tracking-[0.3em] text-poe-text-muted">
              RECENT PRESETS
            </h2>
            <Link
              to="/filters"
              className="text-xs text-poe-text-dim transition-colors hover:text-poe-gold"
            >
              View all &rarr;
            </Link>
          </div>

          {recentPresets.length === 0 ? (
            <div className="border border-dashed border-poe-border/30 p-8 text-center">
              <p className="text-sm text-poe-text-dim">No presets saved yet.</p>
              <Link
                to="/filters"
                className="mt-2 inline-block text-xs text-poe-gold hover:underline"
              >
                Create your first preset
              </Link>
            </div>
          ) : (
            <div className="space-y-1.5">
              {recentPresets.map((preset) => (
                <Link
                  key={preset.id}
                  to="/filters"
                  className="flex items-center justify-between border border-poe-border/20 bg-poe-panel/20 px-4 py-3 transition-colors hover:bg-poe-panel/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-poe-text">{preset.name}</p>
                    <p className="mt-0.5 text-xs text-poe-text-muted">
                      {preset.config.avoidModIds.length} avoid · {preset.config.preferModIds.length} prefer
                      {preset.config.mapTier && <span> · T{preset.config.mapTier}</span>}
                      {preset.config.quantity && <span> · IIQ≥{preset.config.quantity}</span>}
                    </p>
                  </div>
                </Link>
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
              title="Map Mod Filters"
              description="Pick avoid/prefer mods, set map stats, get stash regex"
            />
            <QuickAction
              href="/strategies"
              icon="📊"
              title="Strategy Calculator"
              description="Plan your map farming cost with live prices"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
