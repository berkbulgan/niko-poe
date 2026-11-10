// ABOUTME: Stash page — Browse stash tabs + Snapshot management with config CRUD and history.
// ABOUTME: Requires authentication; Browse shows item table, Snapshots shows config list + snapshot panel.

import { useState, useMemo, type CSSProperties } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/lib/auth-context';
import { useLeague } from '@/lib/league-context';
import { useStashTabs, useStashContents } from '@/lib/hooks/use-stash';
import { useDivinePrice } from '@/lib/hooks/use-prices';
import {
  useSnapshotConfigs,
  useCreateSnapshotConfig,
  useUpdateSnapshotConfig,
  useDeleteSnapshotConfig,
} from '@/lib/hooks/use-snapshots';
import { lookupItemPrices, fetchAllPrices } from '@/lib/ipc';
import { toast } from '@/lib/stores/toast-store';
import { confirmAction } from '@/lib/platform';
import { SnapshotPanel } from '@/components/stash/snapshot-panel';
import { SnapshotConfigModal } from '@/components/stash/snapshot-config-modal';
import { PricedItemTable } from '@/components/ui/priced-item-table';
import type { PricedItem } from '@/components/ui/priced-item-table';
import { RefreshCw, Plus, Settings, Trash2, Camera } from 'lucide-react';
import type { StashTab, StashItem, StashColor } from '@/types/index';
import type { SnapshotConfig } from '@/types/snapshots';

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

// Inline style: Tailwind can't generate arbitrary classes built at runtime.
function colorStyle(colour: StashColor | null): CSSProperties | undefined {
  if (colour === null) return undefined;
  return { backgroundColor: `rgb(${colour.r},${colour.g},${colour.b})` };
}

function parsePrice(note: string | null): { amount: number; currency: string } | null {
  if (!note) return null;
  const match = note.match(/~(?:price|b\/o)\s+([\d.]+)\s+(\S+)/);
  if (!match) return null;
  const amount = parseFloat(match[1]);
  if (Number.isNaN(amount)) return null;
  return { amount, currency: match[2] };
}

function isRareItem(item: StashItem): boolean {
  return item.frameType === 2;
}

// ── Page tabs ────────────────────────────────────────────────────────────────

type StashPageTab = 'browse' | 'snapshots';

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
          className="h-2.5 w-2.5 shrink-0 rounded-sm bg-poe-panel-light"
          style={colorStyle(tab.colour)}
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

interface PriceMapEntry {
  chaosValue: number;
  icon: string;
  category: string;
  listingCount: number | null;
}

function StashItemTable({ items, priceMap, divinePrice }: { items: StashItem[]; priceMap: Record<string, PriceMapEntry>; divinePrice: number }) {
  const processedItems = useMemo((): PricedItem[] => {
    return items
      .filter((item) => !isRareItem(item))
      .map((item) => {
        const displayName = item.name !== '' ? item.name : item.typeLine;
        const quantity = item.stackSize ?? 1;
        const ninjaEntry = priceMap[displayName] ?? priceMap[item.typeLine];
        const notePrice = parsePrice(item.note);
        const unitPrice = ninjaEntry ? ninjaEntry.chaosValue : (notePrice?.amount ?? 0);
        // Only flag real poe.ninja entries with few listings, not unpriced items.
        const lowListings = ninjaEntry?.listingCount != null && ninjaEntry.listingCount < 5;

        return {
          id: item.id,
          name: displayName,
          icon: item.icon,
          quantity,
          unitPrice,
          total: unitPrice * quantity,
          lowListings,
        };
      });
  }, [items, priceMap]);
  const hiddenRares = items.length - processedItems.length;

  if (processedItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-poe-text-dim">No items to display</p>
        <p className="mt-1 text-xs text-poe-text-muted">
          {hiddenRares > 0 ? `This tab only contains rare items (${hiddenRares} hidden)` : 'This tab is empty'}
        </p>
      </div>
    );
  }

  return (
    <>
      {hiddenRares > 0 && (
        <p className="px-4 pt-3 text-xs text-poe-text-muted">
          {hiddenRares} rare item{hiddenRares === 1 ? '' : 's'} hidden — rares can't be priced from poe.ninja
        </p>
      )}
      <PricedItemTable items={processedItems} divinePrice={divinePrice} />
    </>
  );
}

// ── Stash (page) ──────────────────────────────────────────────────────────────

export function Stash() {
  const { isAuthenticated, isLoading: authLoading, login } = useAuth();
  const { currentLeague } = useLeague();
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);
  const [refreshingPrices, setRefreshingPrices] = useState(false);
  // Dashboard links here with ?config=<id> to open that config's snapshots.
  const [searchParams] = useSearchParams();
  const linkedConfigId = searchParams.get('config');
  const [activePageTab, setActivePageTab] = useState<StashPageTab>(linkedConfigId ? 'snapshots' : 'browse');
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(linkedConfigId);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SnapshotConfig | null>(null);
  const queryClient = useQueryClient();

  const divinePrice = useDivinePrice(currentLeague);

  const { data: configs } = useSnapshotConfigs();
  const createConfig = useCreateSnapshotConfig();
  const updateConfig = useUpdateSnapshotConfig();
  const deleteConfig = useDeleteSnapshotConfig();

  const selectedConfig = useMemo(
    () => configs?.find((c) => c.id === selectedConfigId) ?? null,
    [configs, selectedConfigId],
  );

  async function handleRefreshPrices() {
    setRefreshingPrices(true);
    try {
      await fetchAllPrices(currentLeague);
      void queryClient.invalidateQueries({ queryKey: ['item-prices'] });
    } catch (err) {
      toast.error(`Price refresh failed: ${err instanceof Error ? err.message : String(err)}`);
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
    isError: itemsError,
    error: itemsErrorValue,
  } = useStashContents(currentLeague, selectedTabId ?? '');

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

  // ── Access error ──────────────────────────────────────────────────────────

  if (tabsError) {
    const message = tabsErrorValue instanceof Error ? tabsErrorValue.message : 'Unknown error';
    const is403 = message.includes('access denied');
    const needsLogin = message.includes('log in again');

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
              {message}
            </p>
            {needsLogin && (
              <Button variant="primary" onClick={() => { void login(); }}>
                Login again
              </Button>
            )}
          </>
        )}
      </div>
    );
  }

  // ── Main layout ───────────────────────────────────────────────────────────

  const tabList = tabs ?? [];
  const leagueConfigs = (configs ?? []).filter((c) => c.league === currentLeague);

  return (
    <div className="-m-6 flex h-[calc(100%+3rem)] gap-0 overflow-hidden lg:-m-8 lg:h-[calc(100%+4rem)]">
      {/* ── Left panel: Tab list + Snapshot configs ── */}
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
              selectedId={activePageTab === 'browse' ? selectedTabId : null}
              onSelect={(id) => {
                setSelectedTabId(id);
                setActivePageTab('browse');
              }}
            />
          )}
        </div>

        {/* Snapshot Configs section */}
        <div className="border-t border-poe-border/30">
          <div className="flex items-center justify-between px-3 py-2">
            <h3 className="text-xs font-semibold tracking-wider text-poe-text-muted">CONFIGS</h3>
            <button
              type="button"
              onClick={() => { setEditingConfig(null); setConfigModalOpen(true); }}
              className="text-poe-text-muted transition-colors hover:text-poe-gold"
              title="New snapshot config"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="max-h-40 overflow-y-auto">
            {leagueConfigs.length === 0 ? (
              <p className="px-3 pb-2 text-xs text-poe-text-muted/60">No configs yet</p>
            ) : (
              leagueConfigs.map((cfg) => (
                <button
                  key={cfg.id}
                  type="button"
                  onClick={() => {
                    setSelectedConfigId(cfg.id);
                    setActivePageTab('snapshots');
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                    selectedConfigId === cfg.id && activePageTab === 'snapshots'
                      ? 'border-r-2 border-poe-gold bg-poe-gold/8 text-poe-gold'
                      : 'border-r-2 border-transparent text-poe-text-dim hover:bg-poe-panel-light/30'
                  }`}
                >
                  <Camera size={12} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-xs">{cfg.name}</span>
                  <span className="text-[10px] text-poe-text-muted">{cfg.tabIds.length} tabs</span>
                </button>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* ── Right panel ── */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Header with tabs */}
        <div className="flex items-center justify-between border-b border-poe-border/20 px-4 py-0 lg:px-6">
          <div className="flex items-center gap-0">
            <button
              type="button"
              onClick={() => setActivePageTab('browse')}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activePageTab === 'browse'
                  ? 'border-poe-gold text-poe-gold'
                  : 'border-transparent text-poe-text-dim hover:text-poe-text'
              }`}
            >
              Browse
            </button>
            <button
              type="button"
              onClick={() => setActivePageTab('snapshots')}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activePageTab === 'snapshots'
                  ? 'border-poe-gold text-poe-gold'
                  : 'border-transparent text-poe-text-dim hover:text-poe-text'
              }`}
            >
              Snapshots
            </button>
          </div>

          <div className="flex items-center gap-2">
            {activePageTab === 'browse' && (
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
            )}

            {activePageTab === 'snapshots' && selectedConfig && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setEditingConfig(selectedConfig); setConfigModalOpen(true); }}
                  aria-label="Edit snapshot config"
                  title="Edit snapshot config"
                >
                  <Settings size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void confirmAction('Delete this config and all its snapshots?', { confirmLabel: 'Delete', destructive: true })
                      .then((ok) => {
                        if (ok) deleteConfig.mutate(selectedConfig.id, { onSuccess: () => setSelectedConfigId(null) });
                      });
                  }}
                  className="text-red-400 hover:text-red-300"
                  aria-label="Delete snapshot config"
                  title="Delete snapshot config"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          {activePageTab === 'browse' ? (
            // ── Browse tab ──
            selectedTabId === null ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-poe-text-muted">
                  Select a stash tab on the left to view its contents
                </p>
              </div>
            ) : itemsLoading ? (
              <div className="flex h-full items-center justify-center">
                <Spinner size="lg" />
              </div>
            ) : itemsError ? (
              <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
                <p className="text-sm text-poe-text">Failed to load this tab</p>
                <p className="text-xs text-poe-text-muted">{itemsErrorValue?.message ?? 'Unknown error'}</p>
              </div>
            ) : (
              <StashItemTable items={items ?? []} priceMap={priceMap ?? {}} divinePrice={divinePrice} />
            )
          ) : (
            // ── Snapshots tab ──
            selectedConfig ? (
              <SnapshotPanel config={selectedConfig} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <Camera size={32} className="text-poe-text-muted/40" />
                <div className="space-y-1">
                  <p className="text-sm text-poe-text-dim">No config selected</p>
                  <p className="text-xs text-poe-text-muted">
                    Create a snapshot config to start tracking stash value over time
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => { setEditingConfig(null); setConfigModalOpen(true); }}
                >
                  <span className="flex items-center gap-1.5">
                    <Plus size={14} />
                    New Config
                  </span>
                </Button>
              </div>
            )
          )}
        </div>
      </main>

      {/* Snapshot config modal */}
      <SnapshotConfigModal
        open={configModalOpen}
        onClose={() => { setConfigModalOpen(false); setEditingConfig(null); }}
        onSave={async (data) => {
          if (editingConfig) {
            await updateConfig.mutateAsync({
              id: editingConfig.id,
              input: {
                name: data.name,
                tabIds: data.tabIds,
                strategyId: data.strategyId,
              },
            });
          } else {
            const created = await createConfig.mutateAsync({
              name: data.name,
              league: currentLeague,
              tabIds: data.tabIds,
              strategyId: data.strategyId,
            });
            setSelectedConfigId(created.id);
            setActivePageTab('snapshots');
          }
          setConfigModalOpen(false);
          setEditingConfig(null);
        }}
        tabs={tabList}
        existing={editingConfig}
      />
    </div>
  );
}

// ── Tree utilities ───────────────────────────────────────────────────────────

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
