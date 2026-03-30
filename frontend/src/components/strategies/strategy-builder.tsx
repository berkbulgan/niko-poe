// ABOUTME: Strategy cost calculator with item picker, quantity editor, and cost summary.
// ABOUTME: Links to filter presets for trade search. Uses poe.watch prices for cost calculation.

'use client';

import {
  useState,
  useMemo,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { PoeIcon } from '@/components/ui/poe-icon';
import { useLeague } from '@/lib/league-context';
import {
  usePrices,
  useDivinePrice,
  type PriceCategory,
  type PoeWatchItem,
} from '@/lib/hooks/use-prices';
import type { StrategyConfig, StrategyItem } from '@/lib/hooks/use-strategies';
import { useFilterPresets, type FilterPreset } from '@/lib/hooks/use-filter-presets';
import { api } from '@/lib/api';

// ── Types ──

interface SelectedItem {
  itemId: number;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  icon: string;
}

export interface StrategyBuilderRef {
  getConfig: () => StrategyConfig;
  loadConfig: (config: StrategyConfig) => void;
}

// ── Constants ──

const CATEGORY_OPTIONS: Array<{ value: PriceCategory; label: string }> = [
  { value: 'scarab', label: 'Scarab' },
  { value: 'deliriumOrb', label: 'Delirium Orb' },
  { value: 'chisel', label: 'Chisels' },
];

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
  items: PoeWatchItem[];
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelect: (item: PoeWatchItem) => void;
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
  const lineTotal = item.quantity * item.unitPrice;

  return (
    <div className="flex items-center gap-2 border-b border-poe-border/15 px-3 py-1.5">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {item.icon && (
          <img src={item.icon} alt="" width={20} height={20} className="shrink-0" />
        )}
        <span className="truncate text-sm text-poe-text">{item.name}</span>
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
        {lineTotal.toFixed(1)} <PoeIcon name="chaos" size={12} />
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

interface TradeProxyResponse {
  id: string;
  total: number;
  url: string;
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

  async function handleOpenTrade() {
    if (!selectedPreset) return;
    setSearching(true);
    try {
      const config = selectedPreset.config;
      const result = await api.post<TradeProxyResponse>('/trade/search-by-mods', {
        league: currentLeague,
        preferMods: [] as string[],
        avoidMods: [] as string[],
        filters: {
          quantity: config.quantity || undefined,
          packSize: config.packSize || undefined,
          rarity: config.rarity || undefined,
          mapTier: config.mapTier || undefined,
          quality: config.quality || undefined,
          qualityType: config.qualityType || undefined,
          corrupted: config.corrupted === 'natural' ? undefined : config.corrupted,
        },
      });
      window.open(result.url, '_blank', 'noopener');
    } catch {
      window.open(`https://www.pathofexile.com/trade/search/${encodeURIComponent(currentLeague)}`, '_blank', 'noopener');
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

// ── Main component ──

export const StrategyBuilder = forwardRef<StrategyBuilderRef>(function StrategyBuilder(_props, ref) {
  const { currentLeague } = useLeague();
  const [category, setCategory] = useState<PriceCategory>('scarab');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [averageMapCost, setAverageMapCost] = useState(0);
  const [mapCount, setMapCount] = useState(100);
  const [showPicker, setShowPicker] = useState(false);
  const [filterPresetId, setFilterPresetId] = useState<string | null>(null);

  const { data: priceData, isLoading: pricesLoading } = usePrices(category, currentLeague);
  const { data: filterPresets } = useFilterPresets();
  const divinePrice = useDivinePrice(currentLeague);

  const items = priceData ?? [];
  const presets = filterPresets ?? [];

  // ── Calculations ──

  const itemsCostPerMap = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  }, [selectedItems]);

  const costPerMap = itemsCostPerMap + averageMapCost;
  const totalCost = costPerMap * mapCount;
  const totalDivine = divinePrice > 0 ? totalCost / divinePrice : 0;

  // ── Handlers ──

  const handleAddItem = useCallback((poeItem: PoeWatchItem) => {
    setSelectedItems((prev) => {
      const existing = prev.find((i) => i.itemId === poeItem.id && i.category === category);
      if (existing) {
        return prev.map((i) =>
          i.itemId === poeItem.id && i.category === category
            ? { ...i, quantity: i.quantity + 1 }
            : i,
        );
      }
      return [
        ...prev,
        {
          itemId: poeItem.id,
          name: poeItem.name,
          category,
          quantity: 1,
          unitPrice: poeItem.mean,
          icon: poeItem.icon,
        },
      ];
    });
    setShowPicker(false);
    setSearchQuery('');
  }, [category]);

  const handleQuantityChange = useCallback((itemId: number, itemCategory: string, qty: number) => {
    setSelectedItems((prev) =>
      prev.map((i) =>
        i.itemId === itemId && i.category === itemCategory ? { ...i, quantity: qty } : i,
      ),
    );
  }, []);

  const handleRemove = useCallback((itemId: number, itemCategory: string) => {
    setSelectedItems((prev) =>
      prev.filter((i) => !(i.itemId === itemId && i.category === itemCategory)),
    );
  }, []);

  // ── Imperative handle ──

  useImperativeHandle(ref, () => ({
    getConfig: (): StrategyConfig => ({
      items: selectedItems.map((si): StrategyItem => ({
        itemId: si.itemId,
        name: si.name,
        category: si.category,
        quantity: si.quantity,
        unitPrice: si.unitPrice,
        icon: si.icon,
      })),
      averageMapCost,
      mapCount,
      filterPresetId,
    }),
    loadConfig: (config: StrategyConfig) => {
      setSelectedItems(
        config.items.map((item) => ({
          itemId: item.itemId,
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          icon: item.icon,
        })),
      );
      setAverageMapCost(config.averageMapCost);
      setMapCount(config.mapCount);
      setFilterPresetId(config.filterPresetId ?? null);
    },
  }));

  // ── Render ──

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold tracking-wide text-poe-text-dim">
        Strategy Cost Calculator
      </h3>

      {/* ── Linked Filter Preset ── */}
      <LinkedPresetSection
        presets={presets}
        selectedPresetId={filterPresetId}
        onSelect={setFilterPresetId}
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
});
