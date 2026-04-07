// ABOUTME: Stash page — displays GGG stash tabs and their item contents.
// ABOUTME: Requires authentication; shows a login prompt when user is not signed in.

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/lib/auth-context';
import { useLeague } from '@/lib/league-context';
import { useStashTabs, useStashContents } from '@/lib/hooks/use-stash';
import type { StashTab, StashItem, StashColor } from '@/types/index';

// ── Helpers ──────────────────────────────────────────────────────────────────

function stashTypeIcon(stashType: string): string {
  switch (stashType) {
    case 'CurrencyStash': return '💰';
    case 'MapStash': return '🗺️';
    case 'GemStash': return '💎';
    case 'FragmentStash': return '🧩';
    case 'DivinationCardStash': return '🃏';
    case 'EssenceStash': return '🔮';
    case 'UniqueStash': return '⭐';
    case 'PremiumStash': return '📦';
    case 'QuadStash': return '🗃️';
    default: return '📋';
  }
}

function colorStyle(colour: StashColor | null): string {
  if (colour === null) return 'bg-poe-panel-light';
  return `bg-[rgb(${colour.r},${colour.g},${colour.b})]`;
}

// ── StashTabList ──────────────────────────────────────────────────────────────

interface StashTabListProps {
  tabs: StashTab[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function StashTabList({ tabs, selectedId, onSelect }: StashTabListProps) {
  return (
    <div className="space-y-px p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onSelect(tab.id)}
          className={`
            flex w-full items-center gap-2.5 px-3 py-2 text-left transition-all duration-100
            ${selectedId === tab.id
              ? 'border-r-2 border-poe-gold bg-poe-gold/8 text-poe-gold'
              : 'border-r-2 border-transparent text-poe-text-dim hover:bg-poe-panel-light/30 hover:text-poe-text'
            }
          `}
        >
          {/* Colour indicator */}
          <span
            className={`h-3 w-3 shrink-0 rounded-sm ${colorStyle(tab.colour)}`}
            aria-hidden="true"
          />
          {/* Type icon */}
          <span className="text-xs" aria-hidden="true">
            {stashTypeIcon(tab.stashType)}
          </span>
          {/* Name */}
          <span className="min-w-0 flex-1 truncate text-sm">{tab.name}</span>
          {/* Index */}
          <span className="shrink-0 text-xs text-poe-text-muted">{tab.index}</span>
        </button>
      ))}
    </div>
  );
}

// ── StashItemGrid ─────────────────────────────────────────────────────────────

interface StashItemGridProps {
  items: StashItem[];
}

function StashItemCard({ item }: { item: StashItem }) {
  const displayName = item.name !== '' ? item.name : item.typeLine;

  return (
    <div className="group relative flex flex-col gap-1.5 border border-poe-border/20 bg-poe-panel p-2 transition-colors hover:border-poe-gold/30 hover:bg-poe-panel-light">
      {/* Icon */}
      <div className="flex items-center justify-center">
        {item.icon !== '' ? (
          <img
            src={item.icon}
            alt={displayName}
            className="h-10 w-10 object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center text-xl text-poe-text-muted">
            ?
          </div>
        )}
      </div>

      {/* Stack size badge */}
      {item.stackSize !== null && item.stackSize > 1 && (
        <span className="absolute right-1 top-1 text-xs font-semibold text-poe-currency">
          {item.stackSize}
        </span>
      )}

      {/* Name */}
      <p className="truncate text-center text-xs text-poe-text" title={displayName}>
        {displayName}
      </p>

      {/* Price note */}
      {item.note !== null && item.note !== '' && (
        <p className="truncate text-center text-xs text-poe-currency" title={item.note}>
          {item.note}
        </p>
      )}
    </div>
  );
}

function StashItemGrid({ items }: StashItemGridProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-poe-text-dim">This tab is empty</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-2 p-4">
      {items.map((item) => (
        <StashItemCard key={item.id} item={item} />
      ))}
    </div>
  );
}

// ── Stash (page) ──────────────────────────────────────────────────────────────

export function Stash() {
  const { isAuthenticated, isLoading: authLoading, login } = useAuth();
  const { currentLeague } = useLeague();
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);

  const {
    data: tabs,
    isLoading: tabsLoading,
    isError: tabsError,
    error: tabsErrorValue,
  } = useStashTabs(currentLeague);

  const {
    data: items,
    isLoading: itemsLoading,
  } = useStashContents(currentLeague, selectedTabId ?? '');

  // ── Not authenticated ─────────────────────────────────────────────────────

  if (!isAuthenticated) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
        <div className="space-y-2">
          <p className="text-base text-poe-text">
            Login with your GGG account to view stash tabs
          </p>
          <p className="text-sm text-poe-text-muted">
            Stash access requires a linked Path of Exile account
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => { void login(); }}
          disabled={authLoading}
        >
          {authLoading ? 'Connecting...' : 'Login with GGG'}
        </Button>
      </div>
    );
  }

  // ── Tabs loading ──────────────────────────────────────────────────────────

  if (tabsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // ── Access error (403 / permission denied) ────────────────────────────────

  if (tabsError) {
    const is403 = tabsErrorValue instanceof Error
      && tabsErrorValue.message.toLowerCase().includes('403');

    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        {is403 ? (
          <>
            <p className="text-base text-poe-text">
              Stash access not available for this account type
            </p>
            <p className="text-sm text-poe-text-muted">
              This feature requires a Path of Exile account with stash API access enabled.
            </p>
          </>
        ) : (
          <>
            <p className="text-base text-poe-text">Failed to load stash tabs</p>
            <p className="text-sm text-poe-text-muted">
              {tabsErrorValue instanceof Error ? tabsErrorValue.message : 'Unknown error'}
            </p>
          </>
        )}
      </div>
    );
  }

  // ── Main layout ───────────────────────────────────────────────────────────

  const tabList = tabs ?? [];

  return (
    <div className="flex h-full gap-0 overflow-hidden">
      {/* ── Left panel: Tab list ── */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-poe-border/30 xl:w-64">
        <div className="flex items-center justify-between border-b border-poe-border/20 px-3 py-3">
          <h2 className="text-sm font-semibold text-poe-text-dim">Stash Tabs</h2>
          <span className="text-xs text-poe-text-muted">{tabList.length}</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {tabList.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-sm text-poe-text-dim">No tabs found</p>
              <p className="mt-1 text-xs text-poe-text-muted">
                Switch league or check your GGG account.
              </p>
            </div>
          ) : (
            <StashTabList
              tabs={tabList}
              selectedId={selectedTabId}
              onSelect={setSelectedTabId}
            />
          )}
        </div>
      </aside>

      {/* ── Right panel: Tab contents ── */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center border-b border-poe-border/20 px-4 py-3 lg:px-6">
          <h3 className="text-sm font-semibold tracking-wide text-poe-text-dim">
            {selectedTabId !== null
              ? (tabList.find((t) => t.id === selectedTabId)?.name ?? 'Tab Contents')
              : 'Select a tab'}
          </h3>
          {itemsLoading && (
            <Spinner size="sm" className="ml-3" />
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {selectedTabId === null ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-poe-text-muted">
                Select a stash tab on the left to view its contents
              </p>
            </div>
          ) : itemsLoading ? (
            <div className="flex h-full items-center justify-center">
              <Spinner size="lg" />
            </div>
          ) : (
            <StashItemGrid items={items ?? []} />
          )}
        </div>
      </main>
    </div>
  );
}
