// ABOUTME: Stash page — displays GGG stash tabs with expandable folders and sortable item table.
// ABOUTME: Requires authentication; filters out rare items; shows Name, Quantity, Price, Total columns.

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/lib/auth-context';
import { useLeague } from '@/lib/league-context';
import { useStashTabs, useStashContents } from '@/lib/hooks/use-stash';
import { useDivinePrice } from '@/lib/hooks/use-prices';
import { lookupItemPrices, fetchAllPrices } from '@/lib/ipc';
import { PoeIcon } from '@/components/ui/poe-icon';
import { AlertTriangle, RefreshCw } from 'lucide-react';
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
    case 'Folder': return '📁';
    default: return '📋';
  }
}

function colorStyle(colour: StashColor | null): string {
  if (colour === null) return 'bg-poe-panel-light';
  return `bg-[rgb(${colour.r},${colour.g},${colour.b})]`;
}

/** Parse price from note like "~price 1 chaos" or "~b/o 5 divine" */
function parsePrice(note: string | null): { amount: number; currency: string } | null {
  if (!note) return null;
  const match = note.match(/~(?:price|b\/o)\s+([\d.]+)\s+(\S+)/);
  if (!match) return null;
  const amount = parseFloat(match[1]);
  if (Number.isNaN(amount)) return null;
  return { amount, currency: match[2] };
}

/** Is this a rare item? frameType 2 = Rare */
function isRareItem(item: StashItem): boolean {
  return item.frameType === 2;
}

/** Round to 1 decimal place */
function normalizePrice(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Format a normalized price to 1 decimal */
function formatPrice(value: number): string {
  if (value === 0) return '—';
  return normalizePrice(value).toFixed(1);
}

// ── Sort types ───────────────────────────────────────────────────────────────

type SortColumn = 'name' | 'quantity' | 'price' | 'total';
type SortDirection = 'asc' | 'desc';

interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

// ── StashTabList (with expandable folders) ───────────────────────────────────

interface StashTabListProps {
  tabs: StashTab[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function StashTabItem({
  tab,
  depth,
  selectedId,
  onSelect,
}: {
  tab: StashTab;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = tab.children.length > 0;
  const isFolder = tab.stashType === 'Folder' || hasChildren;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (isFolder) {
            setExpanded((prev) => !prev);
          } else {
            onSelect(tab.id);
          }
        }}
        className={`
          flex w-full items-center gap-2 px-3 py-1.5 text-left transition-all duration-100
          ${selectedId === tab.id && !isFolder
            ? 'border-r-2 border-poe-gold bg-poe-gold/8 text-poe-gold'
            : 'border-r-2 border-transparent text-poe-text-dim hover:bg-poe-panel-light/30 hover:text-poe-text'
          }
        `}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {isFolder && (
          <span className="shrink-0 text-xs text-poe-text-muted">
            {expanded ? '▾' : '▸'}
          </span>
        )}
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-sm ${colorStyle(tab.colour)}`}
          aria-hidden="true"
        />
        <span className="text-xs" aria-hidden="true">
          {stashTypeIcon(tab.stashType)}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">{tab.name}</span>
      </button>
      {isFolder && expanded && tab.children.map((child) => (
        <StashTabItem
          key={child.id}
          tab={child}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

function StashTabList({ tabs, selectedId, onSelect }: StashTabListProps) {
  return (
    <div className="space-y-px p-1">
      {tabs.map((tab) => (
        <StashTabItem
          key={tab.id}
          tab={tab}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

// ── StashItemTable (sortable, no rares) ──────────────────────────────────────

function SortHeader({
  label,
  column,
  sort,
  onSort,
  align,
}: {
  label: string;
  column: SortColumn;
  sort: SortState;
  onSort: (col: SortColumn) => void;
  align?: 'left' | 'right';
}) {
  const active = sort.column === column;
  const arrow = active ? (sort.direction === 'desc' ? ' ▾' : ' ▴') : '';

  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={`text-xs font-medium ${active ? 'text-poe-gold' : 'text-poe-text-dim hover:text-poe-text'} ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      {label}{arrow}
    </button>
  );
}

interface ProcessedItem {
  id: string;
  name: string;
  icon: string;
  quantity: number;
  priceAmount: number;
  priceCurrency: string;
  total: number;
  lowConfidence: boolean;
}

interface PriceMapEntry {
  mean: number;
  lowConfidence: boolean;
}

function StashItemTable({ items, priceMap, divinePrice }: { items: StashItem[]; priceMap: Record<string, PriceMapEntry>; divinePrice: number }) {
  const [sort, setSort] = useState<SortState>({ column: 'total', direction: 'desc' });

  const processedItems = useMemo(() => {
    return items
      .filter((item) => !isRareItem(item))
      .map((item): ProcessedItem => {
        const displayName = item.name !== '' ? item.name : item.typeLine;
        const quantity = item.stackSize ?? 1;
        // Try poe.watch price first (by name or typeLine), fall back to player note
        const watchEntry = priceMap[displayName] ?? priceMap[item.typeLine];
        const notePrice = parsePrice(item.note);
        const priceAmount = watchEntry ? watchEntry.mean : (notePrice?.amount ?? 0);
        const priceCurrency = watchEntry ? 'chaos' : (notePrice?.currency ?? '');
        const lowConfidence = watchEntry?.lowConfidence ?? false;
        const total = priceAmount * quantity;

        return {
          id: item.id,
          name: displayName,
          icon: item.icon,
          quantity,
          priceAmount,
          priceCurrency,
          total,
          lowConfidence,
        };
      });
  }, [items, priceMap]);

  const sortedItems = useMemo(() => {
    const sorted = [...processedItems];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sort.column) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'quantity':
          cmp = a.quantity - b.quantity;
          break;
        case 'price':
          cmp = a.priceAmount - b.priceAmount;
          break;
        case 'total':
          cmp = a.total - b.total;
          break;
      }
      return sort.direction === 'desc' ? -cmp : cmp;
    });
    return sorted;
  }, [processedItems, sort]);

  function handleSort(column: SortColumn) {
    setSort((prev) => ({
      column,
      direction: prev.column === column && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  }

  if (processedItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-poe-text-dim">No items to display</p>
        <p className="mt-1 text-xs text-poe-text-muted">This tab is empty or contains only rare items</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      {/* Divine rate indicator */}
      <div className="flex items-center gap-1.5 border-b border-poe-border/20 px-4 py-2 text-xs text-poe-text-muted">
        <span>1</span>
        <PoeIcon name="divine" size={14} />
        <span>=</span>
        <span className="text-poe-currency">{formatPrice(divinePrice)}</span>
        <PoeIcon name="chaos" size={14} />
      </div>

      <table className="w-full">
        <thead>
          <tr className="border-b border-poe-border/30">
            <th className="px-4 py-2 text-left">
              <SortHeader label="Item" column="name" sort={sort} onSort={handleSort} />
            </th>
            <th className="w-24 px-4 py-2 text-right">
              <SortHeader label="Qty" column="quantity" sort={sort} onSort={handleSort} align="right" />
            </th>
            <th className="w-36 px-4 py-2 text-right">
              <SortHeader label="Price" column="price" sort={sort} onSort={handleSort} align="right" />
            </th>
            <th className="w-44 px-4 py-2 text-right">
              <SortHeader label="Total" column="total" sort={sort} onSort={handleSort} align="right" />
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedItems.map((item) => {
            const normalizedTotal = normalizePrice(item.total);
            const showDivine = divinePrice > 0 && normalizedTotal >= divinePrice;
            const divineAmount = showDivine ? normalizePrice(normalizedTotal / divinePrice) : 0;

            return (
              <tr
                key={item.id}
                className="border-b border-poe-border/10 transition-colors hover:bg-poe-panel-light/20"
              >
                <td className="px-4 py-1.5">
                  <div className="flex items-center gap-2">
                    {item.icon !== '' && (
                      <img src={item.icon} alt="" className="h-6 w-6 object-contain" loading="lazy" />
                    )}
                    <span className="truncate text-sm text-poe-text">{item.name}</span>
                  </div>
                </td>
                <td className="px-4 py-1.5 text-right text-sm tabular-nums text-poe-text-dim">
                  {item.quantity}
                </td>
                <td className="px-4 py-1.5">
                  <div className="flex items-center justify-end gap-1 text-sm tabular-nums text-poe-text-dim">
                    {item.lowConfidence && (
                      <AlertTriangle size={12} className="shrink-0 text-red-500" title="Low confidence — unreliable price" />
                    )}
                    {item.priceAmount > 0 ? (
                      <>
                        <span className={item.lowConfidence ? 'text-poe-text-muted' : ''}>{formatPrice(item.priceAmount)}</span>
                        <PoeIcon name="chaos" size={14} />
                      </>
                    ) : (
                      <span className="text-poe-text-muted">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-1.5">
                  <div className="flex flex-col items-end gap-0.5">
                    <div className="flex items-center gap-1 text-sm font-medium tabular-nums text-poe-currency">
                      {normalizedTotal > 0 ? (
                        <>
                          <span>{formatPrice(normalizedTotal)}</span>
                          <PoeIcon name="chaos" size={14} />
                        </>
                      ) : (
                        <span className="text-poe-text-muted">—</span>
                      )}
                    </div>
                    {showDivine && (
                      <div className="flex items-center gap-1 text-xs tabular-nums text-poe-text-muted">
                        <span>{formatPrice(divineAmount)}</span>
                        <PoeIcon name="divine" size={12} />
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Stash (page) ──────────────────────────────────────────────────────────────

export function Stash() {
  const { isAuthenticated, isLoading: authLoading, login } = useAuth();
  const { currentLeague } = useLeague();
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);
  const [refreshingPrices, setRefreshingPrices] = useState(false);
  const queryClient = useQueryClient();

  const divinePrice = useDivinePrice(currentLeague);

  async function handleRefreshPrices() {
    setRefreshingPrices(true);
    try {
      await fetchAllPrices(currentLeague);
      // Invalidate all item-price queries so stash re-fetches from new cache
      void queryClient.invalidateQueries({ queryKey: ['item-prices'] });
    } finally {
      setRefreshingPrices(false);
    }
  }

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

  // Collect unique item names from non-rare items and look up poe.watch prices
  const itemNames = useMemo(() => {
    if (!items) return [];
    const names = new Set<string>();
    for (const item of items) {
      if (isRareItem(item)) continue;
      const name = item.name !== '' ? item.name : item.typeLine;
      if (name) names.add(name);
    }
    return Array.from(names);
  }, [items]);

  const { data: priceMap } = useQuery({
    queryKey: ['item-prices', currentLeague, itemNames],
    queryFn: () => lookupItemPrices(itemNames, currentLeague),
    enabled: itemNames.length > 0,
    staleTime: 15 * 60 * 1000,
  });

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
  const selectedTab = findTab(tabList, selectedTabId);

  return (
    <div className="flex h-full gap-0 overflow-hidden">
      {/* ── Left panel: Tab list ── */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-poe-border/30 xl:w-64">
        <div className="flex items-center justify-between border-b border-poe-border/20 px-3 py-3">
          <h2 className="text-sm font-semibold text-poe-text-dim">Stash Tabs</h2>
          <span className="text-xs text-poe-text-muted">{countLeafTabs(tabList)}</span>
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
        <div className="flex items-center justify-between border-b border-poe-border/20 px-4 py-3 lg:px-6">
          <div className="flex items-center">
            <h3 className="text-sm font-semibold tracking-wide text-poe-text-dim">
              {selectedTab ? selectedTab.name : 'Select a tab'}
            </h3>
            {itemsLoading && (
              <Spinner size="sm" className="ml-3" />
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { void handleRefreshPrices(); }}
            disabled={refreshingPrices}
          >
            <span className="flex items-center gap-1.5">
              <RefreshCw size={14} className={refreshingPrices ? 'animate-spin' : ''} />
              {refreshingPrices ? 'Refreshing...' : 'Refresh Prices'}
            </span>
          </Button>
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
            <StashItemTable items={items ?? []} priceMap={priceMap ?? {}} divinePrice={divinePrice} />
          )}
        </div>
      </main>
    </div>
  );
}

// ── Tree utilities ───────────────────────────────────────────────────────────

function findTab(tabs: StashTab[], id: string | null): StashTab | undefined {
  if (!id) return undefined;
  for (const tab of tabs) {
    if (tab.id === id) return tab;
    const found = findTab(tab.children, id);
    if (found) return found;
  }
  return undefined;
}

function countLeafTabs(tabs: StashTab[]): number {
  let count = 0;
  for (const tab of tabs) {
    if (tab.children.length > 0) {
      count += countLeafTabs(tab.children);
    } else {
      count += 1;
    }
  }
  return count;
}
