// ABOUTME: Strategy cost calculator with item picker, quantity editor, and cost summary.
// ABOUTME: Links to filter presets for trade search. Uses poe.watch prices for cost calculation.

import {
  useState,
  useMemo,
  useCallback,
} from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { PoeIcon } from '@/components/ui/poe-icon';
import { useLeague } from '@/lib/league-context';
import { usePrices, useDivinePrice } from '@/lib/hooks/use-prices';
import type { PriceCategory } from '@/types/strategies';
import type { PriceItem } from '@/types/index';
import { useFilterPresets, type FilterPreset } from '@/lib/hooks/use-filter-presets';
import { useAtlasTrees, type AtlasTreeParsed } from '@/lib/hooks/use-atlas-trees';
import { openExternal } from '@/lib/platform';
import { useStrategiesStore, type SelectedItem } from '@/lib/stores/strategies-store';
import rawTreeData from '@/data/atlas-tree-data.json';
import type { AtlasTreeRawData } from '@/types/atlas-tree';

const treeData = rawTreeData as unknown as AtlasTreeRawData;

// ── Constants ──

const CATEGORY_OPTIONS: Array<{ value: PriceCategory; label: string }> = [
  { value: 'scarab', label: 'Scarab' },
  { value: 'deliriumOrb', label: 'Delirium Orb' },
  { value: 'chisel', label: 'Chisels' },
  { value: 'astrolabe', label: 'Astrolabe' },
];

// Categories where 1 unit covers multiple maps
const MAPS_PER_USE: Partial<Record<PriceCategory, number>> = {
  astrolabe: 5,
};

// ── Sub-components ──

function CategorySelect({
  value,
  onChange,
}: {
  value: PriceCategory;
  onChange: (v: PriceCategory) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as PriceCategory)}
      className="border border-poe-border/30 bg-poe-panel/40 px-2 py-1.5 text-sm text-poe-text focus:border-poe-gold/40 focus:outline-none"
      aria-label="Item category"
    >
      {CATEGORY_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

function ItemDropdown({
  items,
  isLoading,
  searchQuery,
  onSearchChange,
  onSelect,
}: {
  items: PriceItem[];
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelect: (item: PriceItem) => void;
}) {
  const filtered = useMemo(() => {
    if (searchQuery.length < 1) return items.slice(0, 50);
    const lower = searchQuery.toLowerCase();
    return items.filter((item) => item.name.toLowerCase().includes(lower)).slice(0, 50);
  }, [items, searchQuery]);

  return (
    <div className="space-y-2">
      <Input
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search items..."
        className="text-xs"
        aria-label="Search items"
      />
      {isLoading ? (
        <div className="flex justify-center py-4"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <p className="py-2 text-center text-xs text-poe-text-muted">No items found</p>
      ) : (
        <div className="max-h-48 overflow-y-auto border border-poe-border/20">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className="flex w-full items-center justify-between border-b border-poe-border/10 px-3 py-1.5 text-left transition-colors hover:bg-poe-panel-light/30"
            >
              <span className="flex items-center gap-2">
                {item.icon && (
                  <img src={item.icon} alt="" width={20} height={20} className="inline-block" />
                )}
                <span className="text-sm text-poe-text">{item.name}</span>
              </span>
              <span className="flex items-center gap-1 text-xs text-poe-currency">
                {item.mean.toFixed(1)}
                <PoeIcon name="chaos" size={12} />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SelectedItemRow({
  item,
  onQuantityChange,
  onRemove,
}: {
  item: SelectedItem;
  onQuantityChange: (qty: number) => void;
  onRemove: () => void;
}) {
  const perMapCost = (item.quantity * item.unitPrice) / item.mapsPerUse;

  return (
    <div className="flex items-center gap-2 border-b border-poe-border/15 px-3 py-1.5">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {item.icon && (
          <img src={item.icon} alt="" width={20} height={20} className="shrink-0" />
        )}
        <span className="truncate text-sm text-poe-text">{item.name}</span>
        {item.mapsPerUse > 1 && (
          <span className="shrink-0 text-[10px] text-poe-text-muted">/{item.mapsPerUse} maps</span>
        )}
      </div>
      <input
        type="number"
        min="1"
        max="999"
        value={item.quantity}
        onChange={(e) => {
          const val = parseInt(e.target.value, 10);
          if (!Number.isNaN(val) && val > 0) onQuantityChange(val);
        }}
        className="w-16 border border-poe-border/30 bg-poe-panel/40 px-2 py-1 text-center text-sm tabular-nums text-poe-currency focus:border-poe-gold/40 focus:outline-none"
        aria-label={`Quantity for ${item.name}`}
      />
      <span className="flex w-20 items-center justify-end gap-1 text-xs text-poe-text-muted">
        {item.unitPrice.toFixed(1)} <PoeIcon name="chaos" size={12} />
      </span>
      <span className="flex w-20 items-center justify-end gap-1 text-sm font-medium text-poe-currency">
        {perMapCost.toFixed(1)} <PoeIcon name="chaos" size={12} />
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 px-1 text-xs text-poe-text-dim hover:text-poe-error"
        aria-label={`Remove ${item.name}`}
      >
        x
      </button>
    </div>
  );
}

function LinkedPresetSection({
  presets,
  selectedPresetId,
  onSelect,
}: {
  presets: FilterPreset[];
  selectedPresetId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { currentLeague } = useLeague();
  const selectedPreset = presets.find((p) => p.id === selectedPresetId);
  const [searching, setSearching] = useState(false);

  function buildPresetTradeQuery(config: FilterPreset['config']) {
    type StatFilter = { id: string; value?: { min?: number }; disabled: boolean };
    const statFilters: StatFilter[] = [];

    const moreDropsMap: Record<string, string> = {
      moreCurrency: 'pseudo.pseudo_map_more_currency_drops',
      moreMaps: 'pseudo.pseudo_map_more_map_drops',
      moreScarabs: 'pseudo.pseudo_map_more_scarab_drops',
      moreDivination: 'pseudo.pseudo_map_more_card_drops',
    };

    const qualityTypeMap: Record<string, string> = {
      pack_size: 'pseudo.pseudo_map_quality_pack_size',
      rarity: 'pseudo.pseudo_map_quality_rarity',
      currency: 'pseudo.pseudo_map_quality_currency',
      scarabs: 'pseudo.pseudo_map_quality_scarabs',
      cards: 'pseudo.pseudo_map_quality_cards',
    };

    for (const [key, pseudoId] of Object.entries(moreDropsMap)) {
      const val = config[key as keyof typeof config] as string | undefined;
      if (!val) continue;
      const num = parseInt(val, 10);
      if (!Number.isNaN(num) && num > 0) {
        statFilters.push({ id: pseudoId, value: { min: num }, disabled: false });
      }
    }

    if (config.quality && config.qualityType) {
      const qId = qualityTypeMap[config.qualityType];
      const qNum = parseInt(config.quality, 10);
      if (qId && !Number.isNaN(qNum) && qNum > 0) {
        statFilters.push({ id: qId, value: { min: qNum }, disabled: false });
      }
    }

    const stats = statFilters.length > 0
      ? [{ type: 'and', filters: statFilters }]
      : [{ type: 'and', filters: [] as StatFilter[] }];

    const safeInt = (val: string): number | undefined => {
      if (!val) return undefined;
      const n = parseInt(val, 10);
      return Number.isNaN(n) ? undefined : n;
    };

    const mapFilters: Record<string, { min?: number; max?: number }> = {};
    const iiq = safeInt(config.quantity);
    const packsize = safeInt(config.packSize);
    const iir = safeInt(config.rarity);
    const tier = safeInt(config.mapTier);
    if (iiq !== undefined) mapFilters['map_iiq'] = { min: iiq };
    if (packsize !== undefined) mapFilters['map_packsize'] = { min: packsize };
    if (iir !== undefined) mapFilters['map_iir'] = { min: iir };
    if (tier !== undefined) mapFilters['map_tier'] = { min: tier, max: tier };

    const miscFilters: Record<string, unknown> = {};
    if (config.quality) {
      const qVal = parseInt(config.quality, 10);
      if (!Number.isNaN(qVal) && qVal > 0) miscFilters['quality'] = { min: qVal };
    }
    if (config.corrupted === 'prefer') miscFilters['corrupted'] = { option: 'true' };
    if (config.corrupted === 'avoid') miscFilters['corrupted'] = { option: 'false' };

    const queryFilters: Record<string, { filters: Record<string, unknown> }> = {};
    if (Object.keys(mapFilters).length > 0) queryFilters['map_filters'] = { filters: mapFilters };
    if (Object.keys(miscFilters).length > 0) queryFilters['misc_filters'] = { filters: miscFilters };

    const mapType: string | { option: string; discriminator: string } = config.isNightmareMap
      ? 'Nightmare Map'
      : { option: 'Map', discriminator: 'map' };

    return {
      query: {
        status: { option: 'securable' },
        type: mapType,
        stats,
        ...(Object.keys(queryFilters).length > 0 ? { filters: queryFilters } : {}),
      },
      sort: { price: 'asc' },
    };
  }

  // Phase 2: replace stub with ipc.proxyTradeSearch() then openExternal(result.url)
  async function handleOpenTrade() {
    if (!selectedPreset) return;
    setSearching(true);
    try {
      const fallbackUrl = `https://www.pathofexile.com/trade/search/${encodeURIComponent(currentLeague)}`;
      await openExternal(fallbackUrl);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-2 border border-poe-border/20 bg-poe-panel/20 p-4">
      <h4 className="text-xs font-medium tracking-wide text-poe-text-dim">
        Linked Filter Preset
      </h4>

      <select
        value={selectedPresetId ?? ''}
        onChange={(e) => onSelect(e.target.value || null)}
        className="w-full border border-poe-border/30 bg-poe-panel/40 px-2 py-1.5 text-sm text-poe-text focus:border-poe-gold/40 focus:outline-none"
      >
        <option value="">No preset linked</option>
        {presets.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      {selectedPreset && (
        <div className="flex items-center justify-between border border-poe-gold/15 bg-poe-gold/5 px-3 py-2">
          <div className="text-xs text-poe-text-dim">
            <span className="text-poe-text">{selectedPreset.name}</span>
            {selectedPreset.config.mapTier && (
              <span className="ml-2">T{selectedPreset.config.mapTier}</span>
            )}
            {selectedPreset.config.quantity && (
              <span className="ml-2">IIQ≥{selectedPreset.config.quantity}</span>
            )}
            {selectedPreset.config.corrupted !== 'natural' && (
              <span className="ml-2 text-poe-chaos">
                {selectedPreset.config.corrupted === 'prefer' ? 'Corrupted' : 'Not Corrupted'}
              </span>
            )}
            <span className="ml-2 text-poe-text-muted">
              ({selectedPreset.config.avoidModIds.length} avoid, {selectedPreset.config.preferModIds.length} prefer)
            </span>
          </div>
          <Button variant="primary" size="sm" onClick={handleOpenTrade} disabled={searching}>
            {searching ? '...' : 'Open Trade ↗'}
          </Button>
        </div>
      )}
    </div>
  );
}

function LinkedAtlasTreeSection({
  trees,
  selectedTreeId,
  onSelect,
}: {
  trees: AtlasTreeParsed[];
  selectedTreeId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const selectedTree = trees.find((t) => t.id === selectedTreeId);
  const nodeCount = selectedTree?.config?.allocatedNodeIds?.length ?? 0;
  const maxPoints = treeData.points?.totalPoints ?? 138;

  // Resolve keystone and notable data from allocated IDs
  const { keystones, notables } = useMemo(() => {
    if (!selectedTree) return { keystones: [], notables: [] };
    const ks: Array<{ name: string; stats: string[] }> = [];
    const ns: Array<{ name: string; stats: string[] }> = [];
    for (const id of selectedTree.config.allocatedNodeIds) {
      const node = treeData.nodes[String(id)];
      if (!node?.name) continue;
      if (node.isKeystone) ks.push({ name: node.name, stats: node.stats });
      else if (node.isNotable) ns.push({ name: node.name, stats: node.stats });
    }
    return { keystones: ks, notables: ns };
  }, [selectedTree]);


  return (
    <div className="space-y-2 border border-poe-border/20 bg-poe-panel/20 p-4">
      <h4 className="text-xs font-medium tracking-wide text-poe-text-dim">
        Linked Atlas Tree
      </h4>

      <select
        value={selectedTreeId ?? ''}
        onChange={(e) => onSelect(e.target.value || null)}
        className="w-full border border-poe-border/30 bg-poe-panel/40 px-2 py-1.5 text-sm text-poe-text focus:border-poe-gold/40 focus:outline-none"
      >
        <option value="">No atlas tree linked</option>
        {trees.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>

      {selectedTree && (
        <div className="border border-poe-gold/15 bg-poe-gold/5 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className={`text-sm font-semibold tabular-nums ${nodeCount > maxPoints ? 'text-poe-error' : 'text-poe-gold'}`}>
              {nodeCount}/{maxPoints}
            </span>
            <span className="text-xs text-poe-text-muted">Nodes Allocated</span>
          </div>
          {keystones.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {keystones.map((ks) => (
                <span
                  key={ks.name}
                  title={ks.stats.join('\n')}
                  className="cursor-help rounded border border-poe-currency/30 bg-poe-currency/10 px-1.5 py-0.5 text-[10px] font-medium text-poe-currency"
                >
                  {ks.name}
                </span>
              ))}
            </div>
          )}
          {notables.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {notables.map((n) => (
                <span
                  key={n.name}
                  title={n.stats.join('\n')}
                  className="cursor-help rounded border border-poe-gold/25 bg-poe-gold/8 px-1.5 py-0.5 text-[10px] text-poe-gold"
                >
                  {n.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ──

export function StrategyBuilder() {
  const { currentLeague } = useLeague();
  const store = useStrategiesStore();
  const {
    selectedItems, averageMapCost, mapCount, filterPresetId, atlasTreeId,
    category, showPicker, searchQuery,
    setCategory, setShowPicker, setSearchQuery,
    addItem, updateItemQuantity, removeItem,
    setAverageMapCost, setMapCount, setFilterPresetId, setAtlasTreeId,
  } = store;

  const { data: priceData, isLoading: pricesLoading } = usePrices(category, currentLeague);
  const { data: filterPresets } = useFilterPresets();
  const { data: atlasTrees } = useAtlasTrees();
  const divinePrice = useDivinePrice(currentLeague);

  const items = priceData ?? [];
  const presets = filterPresets ?? [];
  const trees = atlasTrees ?? [];

  // ── Calculations ──

  const itemsCostPerMap = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice) / item.mapsPerUse, 0);
  }, [selectedItems]);

  const costPerMap = itemsCostPerMap + averageMapCost;
  const totalCost = costPerMap * mapCount;
  const totalDivine = divinePrice > 0 ? totalCost / divinePrice : 0;

  // ── Handlers ──

  const handleAddItem = useCallback((poeItem: PriceItem) => {
    const mapsPerUse = MAPS_PER_USE[category] ?? 1;
    addItem({
      itemId: poeItem.id,
      name: poeItem.name,
      category,
      quantity: 1,
      unitPrice: poeItem.mean,
      icon: poeItem.icon,
      mapsPerUse,
    });
    setShowPicker(false);
    setSearchQuery('');
  }, [category, addItem, setShowPicker, setSearchQuery]);

  const handleQuantityChange = useCallback((itemId: number, itemCategory: string, qty: number) => {
    updateItemQuantity(itemId, itemCategory, qty);
  }, [updateItemQuantity]);

  const handleRemove = useCallback((itemId: number, itemCategory: string) => {
    removeItem(itemId, itemCategory);
  }, [removeItem]);

  // ── Render ──

  return (
    <div className="space-y-4">
      {/* ── Linked Filter Preset ── */}
      <LinkedPresetSection
        presets={presets}
        selectedPresetId={filterPresetId}
        onSelect={setFilterPresetId}
      />

      {/* ── Linked Atlas Tree ── */}
      <LinkedAtlasTreeSection
        trees={trees}
        selectedTreeId={atlasTreeId}
        onSelect={setAtlasTreeId}
      />

      {/* ── Item Picker ── */}
      <div className="space-y-3 border border-poe-border/20 bg-poe-panel/20 p-4">
        <h4 className="text-xs font-medium tracking-wide text-poe-text-dim">
          Item Picker
        </h4>
        <div className="flex flex-wrap items-center gap-2">
          <CategorySelect value={category} onChange={setCategory} />
          <Button variant="primary" size="sm" onClick={() => setShowPicker((prev) => !prev)}>
            {showPicker ? 'Close' : 'Add Item'}
          </Button>
        </div>

        {showPicker && (
          <ItemDropdown
            items={items}
            isLoading={pricesLoading}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSelect={handleAddItem}
          />
        )}
      </div>

      {/* ── Selected Items Table ── */}
      {selectedItems.length > 0 && (
        <div className="border border-poe-border/20 bg-poe-panel/20">
          <div className="flex items-center gap-2 border-b border-poe-border/30 px-3 py-2">
            <span className="flex-1 text-xs font-medium text-poe-text-dim">Item</span>
            <span className="w-16 text-center text-xs font-medium text-poe-text-dim">Qty/Map</span>
            <span className="w-20 text-right text-xs font-medium text-poe-text-dim">Price</span>
            <span className="w-20 text-right text-xs font-medium text-poe-text-dim">Total</span>
            <span className="w-6" />
          </div>
          {selectedItems.map((item) => (
            <SelectedItemRow
              key={`${item.category}-${item.itemId}`}
              item={item}
              onQuantityChange={(qty) => handleQuantityChange(item.itemId, item.category, qty)}
              onRemove={() => handleRemove(item.itemId, item.category)}
            />
          ))}
        </div>
      )}

      {/* ── Cost Summary ── */}
      <div className="space-y-3 border border-poe-gold/20 bg-poe-panel/20 p-4">
        <h4 className="text-xs font-medium tracking-wide text-poe-gold/70">
          Cost Summary
        </h4>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex flex-col">
            <label className="mb-1 flex items-center gap-1.5 text-xs text-poe-text-muted">
              <PoeIcon name="chaos" size={14} /> Extra Cost/Map
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={averageMapCost || ''}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setAverageMapCost(Number.isNaN(val) ? 0 : val);
              }}
              placeholder="0"
              className="w-full border border-poe-border/30 bg-poe-panel/40 px-2 py-1.5 text-sm tabular-nums text-poe-currency placeholder:text-poe-text-muted focus:border-poe-gold/40 focus:outline-none"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 flex items-center gap-1.5 text-xs text-poe-text-muted">
              <PoeIcon name="map" size={14} /> Maps to Run
            </label>
            <input
              type="number"
              min="1"
              max="10000"
              value={mapCount}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!Number.isNaN(val) && val > 0) setMapCount(val);
              }}
              className="w-full border border-poe-border/30 bg-poe-panel/40 px-2 py-1.5 text-sm tabular-nums text-poe-currency focus:border-poe-gold/40 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-2 space-y-1.5 border-t border-poe-border/20 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-poe-text-muted">Cost per Map</span>
            <span className="flex items-center gap-1 text-sm font-medium text-poe-currency">
              {costPerMap.toFixed(1)} <PoeIcon name="chaos" size={14} />
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-poe-gold">Total Cost</span>
            <div className="text-right">
              <span className="flex items-center gap-1 text-sm font-bold text-poe-gold">
                {totalCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                <PoeIcon name="chaos" size={14} />
              </span>
              {totalDivine > 0 && (
                <span className="flex items-center justify-end gap-1 text-xs text-poe-text-muted">
                  ({totalDivine.toFixed(1)} <PoeIcon name="divine" size={12} />)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
