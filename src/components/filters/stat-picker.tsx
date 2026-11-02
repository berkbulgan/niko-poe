// ABOUTME: Scary-inspired two-column mod picker with map stat filters.
// ABOUTME: Quantity/packsize/rarity/quality/bonus filters affect both vendor regex and trade search.

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useLeague } from '@/lib/league-context';
import { openExternal, copyToClipboard } from '@/lib/platform';
import { proxySearch } from '@/lib/ipc';
import { useTradeStats, matchModTexts } from '@/lib/hooks/use-trade-stats';
import { MAP_MODS, type MapMod, NIGHTMARE_THRESHOLD } from '@/data';
import { generateNumberRegex } from '@/lib/generate-number-regex';
import { buildOptimizedVendorRegex } from '@/lib/optimize-regex';
import { PoeIcon, type PoeIconName } from '@/components/ui/poe-icon';
import { useFiltersStore } from '@/lib/stores/filters-store';
import type { MapStatFilters, QualityType } from '@/types/filters';

const QUALITY_TYPE_OPTIONS: Array<{ value: QualityType; label: string }> = [
  { value: 'pack_size', label: 'Pack Size' },
  { value: 'rarity', label: 'Rarity' },
  { value: 'currency', label: 'Currency' },
  { value: 'scarabs', label: 'Scarabs' },
  { value: 'cards', label: 'Divination' },
];

// PoE trade API pseudo stat IDs for "more X drops" and "quality gives X"
const TRADE_PSEUDO_IDS = {
  moreCurrency: 'pseudo.pseudo_map_more_currency_drops',
  moreMaps: 'pseudo.pseudo_map_more_map_drops',
  moreScarabs: 'pseudo.pseudo_map_more_scarab_drops',
  moreDivination: 'pseudo.pseudo_map_more_card_drops',
} as const;

const TRADE_QUALITY_TYPE_IDS: Record<QualityType, string> = {
  pack_size: 'pseudo.pseudo_map_quality_pack_size',
  rarity: 'pseudo.pseudo_map_quality_rarity',
  currency: 'pseudo.pseudo_map_quality_currency',
  scarabs: 'pseudo.pseudo_map_quality_scarabs',
  cards: 'pseudo.pseudo_map_quality_cards',
};

// In-game stash search regex keywords — sourced from poe-vendor-string (OptimizedMapOutput.ts)
const STASH_REGEX_MAP = {
  quantity: 'm q',       // "Ite**m Q**uantity"
  packSize: 'iz',        // "Pack S**iz**e"
  rarity: 'm rar',       // "Ite**m Rar**ity"
  moreCurrency: 'urr',   // "C**urr**ency"
  moreMaps: 're maps',   // "Mo**re Maps**"
  moreScarabs: 'sca',    // "**Sca**rab"
  moreDivination: 'div', // "**Div**ination"
} as const;

// Quality type → stash regex keyword
const QUALITY_REGEX_MAP: Record<QualityType, string> = {
  pack_size: 'ze\\).*',   // "Pack Si**ze)**"
  rarity: 'ty\\).*',      // "Rari**ty)**"
  currency: 'urr.*',      // "C**urr**ency"
  scarabs: 'sca.*',       // "**Sca**rab"
  cards: 'div.*',         // "**Div**ination"
};


// StatPickerRef removed — store handles get/load config directly

function buildStatParts(filters: MapStatFilters): string[] {
  const parts: string[] = [];

  // Basic numeric filters (quantity, packSize, rarity)
  const basicKeys = ['quantity', 'packSize', 'rarity'] as const;
  for (const key of basicKeys) {
    const value = filters[key];
    if (!value) continue;
    const numRegex = generateNumberRegex(value, false);
    if (!numRegex) continue;
    parts.push(`"${STASH_REGEX_MAP[key]}.*${numRegex}%"`);
  }

  // "More X drops" filters
  const moreKeys = ['moreCurrency', 'moreMaps', 'moreScarabs', 'moreDivination'] as const;
  for (const key of moreKeys) {
    const value = filters[key];
    if (!value) continue;
    const numRegex = generateNumberRegex(value, false);
    if (!numRegex) continue;
    parts.push(`"${STASH_REGEX_MAP[key]}.*${numRegex}%"`);
  }

  // Quality filter with type-specific regex
  if (filters.quality) {
    const numRegex = generateNumberRegex(filters.quality, false);
    if (numRegex) {
      const qualityKeyword = QUALITY_REGEX_MAP[filters.qualityType];
      parts.push(`"${qualityKeyword}${numRegex}%"`);
    }
  }

  // Corrupted: "pte" matches "Corrupted", "!pte" matches non-corrupted
  if (filters.corrupted === 'prefer') {
    parts.push('"pte"');
  } else if (filters.corrupted === 'avoid') {
    parts.push('"!pte"');
  }

  return parts;
}

// ── Scary color helpers ──

function getScaryColor(scary: number): string {
  if (scary >= NIGHTMARE_THRESHOLD) return 'text-purple-400';
  if (scary >= 700) return 'text-red-400';
  if (scary >= 500) return 'text-red-300/80';
  if (scary >= 300) return 'text-orange-300/80';
  if (scary >= 100) return 'text-yellow-200/70';
  return 'text-poe-text-dim';
}

function getScaryBg(selected: boolean): string {
  if (selected) return 'bg-poe-gold/10 border-poe-gold/40';
  return 'border-poe-border/15';
}

// ── Sub-components ──

function StatFilterInput({
  label,
  value,
  onChange,
  iconName,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  iconName: PoeIconName;
}) {
  return (
    <div className="flex flex-col">
      <label className="mb-1 flex items-center gap-1.5 text-xs text-poe-text-muted">
        <PoeIcon name={iconName} size={16} /> {label}
      </label>
      <input
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="min"
        className="w-full border border-poe-border/30 bg-poe-panel/40 px-2 py-1.5 text-sm text-poe-currency tabular-nums placeholder:text-poe-text-muted focus:border-poe-gold/40 focus:outline-none"
      />
    </div>
  );
}

function ModRow({
  mod,
  selected,
  onToggle,
}: {
  mod: MapMod;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`
        flex w-full items-center justify-between border px-3 py-1.5 text-left
        transition-all duration-100
        ${getScaryBg(selected)}
        hover:bg-poe-panel-light/50
      `}
    >
      <span className={`text-sm leading-snug ${selected ? 'text-poe-text' : getScaryColor(mod.scary)}`}>
        {mod.text}
      </span>
      <span className="ml-2 shrink-0 font-mono text-xs text-poe-text-muted">
        {mod.scary}
      </span>
    </button>
  );
}

// ── Main component ──

export function StatPicker() {
  const { currentLeague } = useLeague();
  const { data: tradeStats } = useTradeStats();
  const store = useFiltersStore();
  const {
    avoidIds, preferIds, filters, searchQuery, showNightmare, isNightmareMap,
    setSearchQuery, setShowNightmare, setIsNightmareMap,
    toggleAvoid, togglePrefer, updateFilter, clearAll,
  } = store;
  const [copied, setCopied] = useState(false);
  const [searching, setSearching] = useState(false);

  const filteredMods = useMemo(() => {
    let mods = MAP_MODS;
    if (!showNightmare) {
      mods = mods.filter((m) => m.scary < NIGHTMARE_THRESHOLD);
    }
    if (searchQuery.length >= 2) {
      const lower = searchQuery.toLowerCase();
      mods = mods.filter((m) => m.text.toLowerCase().includes(lower));
    }
    return mods;
  }, [searchQuery, showNightmare]);

  const avoidSorted = useMemo(() => [...filteredMods].sort((a, b) => b.scary - a.scary), [filteredMods]);
  const preferSorted = useMemo(() => [...filteredMods].sort((a, b) => a.scary - b.scary), [filteredMods]);

  const avoidMods = MAP_MODS.filter((m) => avoidIds.has(m.id));
  const preferMods = MAP_MODS.filter((m) => preferIds.has(m.id));
  const vendorRegex = useMemo(() => {
    const statParts = buildStatParts(filters);
    return buildOptimizedVendorRegex(avoidMods, preferMods, statParts);
  }, [avoidMods, preferMods, filters]);

  // Only show action bar when something affects regex output (not mapTier — trade-only field)
  const hasAnyFilter = avoidIds.size > 0 || preferIds.size > 0 || filters.corrupted !== 'natural' ||
    filters.quantity !== '' || filters.packSize !== '' || filters.rarity !== '' ||
    filters.quality !== '' ||
    filters.moreCurrency !== '' || filters.moreMaps !== '' ||
    filters.moreScarabs !== '' || filters.moreDivination !== '';

  // useImperativeHandle removed — store.getConfig()/loadConfig() used by parent page directly

  function buildTradeQuery() {
    type StatFilter = { id: string; value?: { min?: number }; disabled: boolean };
    const andFilters: StatFilter[] = [];
    const notFilters: StatFilter[] = [];

    // "More X drops" → pseudo stat IDs
    const moreKeys = ['moreCurrency', 'moreMaps', 'moreScarabs', 'moreDivination'] as const;
    for (const key of moreKeys) {
      const val = filters[key];
      if (!val) continue;
      const num = parseInt(val, 10);
      if (!Number.isNaN(num) && num > 0) {
        andFilters.push({ id: TRADE_PSEUDO_IDS[key], value: { min: num }, disabled: false });
      }
    }

    // Quality type → pseudo stat ID
    if (filters.quality && filters.qualityType) {
      const qualityPseudoId = TRADE_QUALITY_TYPE_IDS[filters.qualityType];
      const qualityNum = parseInt(filters.quality, 10);
      if (qualityPseudoId && !Number.isNaN(qualityNum) && qualityNum > 0) {
        andFilters.push({ id: qualityPseudoId, value: { min: qualityNum }, disabled: false });
      }
    }

    // Mod text → stat ID matching (frontend-side, using cached trade stats)
    if (tradeStats && tradeStats.length > 0) {
      if (preferMods.length > 0) {
        const matches = matchModTexts(tradeStats, preferMods.map((m) => m.text));
        for (const match of matches) {
          if (match.statId) andFilters.push({ id: match.statId, disabled: false });
        }
      }
      if (avoidMods.length > 0) {
        const matches = matchModTexts(tradeStats, avoidMods.map((m) => m.text));
        for (const match of matches) {
          if (match.statId) notFilters.push({ id: match.statId, disabled: false });
        }
      }
    }

    const stats: Array<{ type: string; filters: StatFilter[] }> = [];
    if (andFilters.length > 0) {
      stats.push({ type: 'and', filters: andFilters });
    }
    if (notFilters.length > 0) {
      stats.push({ type: 'not', filters: notFilters });
    }
    if (stats.length === 0) {
      stats.push({ type: 'and', filters: [] });
    }

    // Map filters (IIQ, pack size, IIR, tier)
    const mapFilters: Record<string, { min?: number; max?: number }> = {};
    const safeInt = (val: string): number | undefined => {
      if (!val) return undefined;
      const n = parseInt(val, 10);
      return Number.isNaN(n) ? undefined : n;
    };

    const iiq = safeInt(filters.quantity);
    const packsize = safeInt(filters.packSize);
    const iir = safeInt(filters.rarity);
    const tier = safeInt(filters.mapTier);

    if (iiq !== undefined) mapFilters['map_iiq'] = { min: iiq };
    if (packsize !== undefined) mapFilters['map_packsize'] = { min: packsize };
    if (iir !== undefined) mapFilters['map_iir'] = { min: iir };
    if (tier !== undefined) mapFilters['map_tier'] = { min: tier, max: tier };

    // Misc filters (quality, corrupted)
    const miscFilters: Record<string, unknown> = {};
    if (filters.quality) {
      const qVal = parseInt(filters.quality, 10);
      if (!Number.isNaN(qVal) && qVal > 0) miscFilters['quality'] = { min: qVal };
    }
    if (filters.corrupted === 'prefer') miscFilters['corrupted'] = { option: 'true' };
    if (filters.corrupted === 'avoid') miscFilters['corrupted'] = { option: 'false' };

    // Build query filters object
    const queryFilters: Record<string, { filters: Record<string, unknown> }> = {};
    if (Object.keys(mapFilters).length > 0) queryFilters['map_filters'] = { filters: mapFilters };
    if (Object.keys(miscFilters).length > 0) queryFilters['misc_filters'] = { filters: miscFilters };

    // Map type
    const mapType: string | { option: string; discriminator: string } = isNightmareMap
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

  async function handleOpenTrade() {
    if (!hasAnyFilter) return;
    setSearching(true);
    try {
      const tradeQuery = buildTradeQuery();
      const result = await proxySearch(tradeQuery, currentLeague);
      await openExternal(result.url);
    } catch (err) {
      console.error('[StatPicker] proxySearch failed:', err);
      // Fallback: open empty trade page so the user isn't stuck
      const fallbackUrl = `https://www.pathofexile.com/trade/search/${encodeURIComponent(currentLeague)}`;
      await openExternal(fallbackUrl);
    } finally {
      setSearching(false);
    }
  }

  function handleClear() {
    clearAll();
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Map stat filters — 3 rows ── */}
      <div className="mx-4 mt-4 shrink-0 space-y-3 border border-poe-border/20 bg-poe-panel/20 p-4 lg:mx-6">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-medium tracking-wide text-poe-text-dim">
            Map Stats
          </h4>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs text-poe-text-muted">
              <input
                type="checkbox"
                checked={isNightmareMap}
                onChange={(e) => setIsNightmareMap(e.target.checked)}
                className="accent-purple-500"
              />
              Nightmare Map
            </label>
            <label className="flex items-center gap-1.5 text-xs text-poe-text-muted">
              <input
                type="checkbox"
                checked={showNightmare}
                onChange={(e) => setShowNightmare(e.target.checked)}
                className="accent-purple-500"
              />
              Show NM mods
            </label>
          </div>
        </div>

        {/* Row 1: Base map stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatFilterInput label="Map Tier" value={filters.mapTier} onChange={(v) => updateFilter('mapTier', v)} iconName="tier" />
          <StatFilterInput label="Quantity" value={filters.quantity} onChange={(v) => updateFilter('quantity', v)} iconName="quantity" />
          <StatFilterInput label="Pack Size" value={filters.packSize} onChange={(v) => updateFilter('packSize', v)} iconName="packsize" />
          <StatFilterInput label="Rarity" value={filters.rarity} onChange={(v) => updateFilter('rarity', v)} iconName="rarity" />
        </div>

        {/* Row 2: Quality + type + corrupted */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatFilterInput label="Quality" value={filters.quality} onChange={(v) => updateFilter('quality', v)} iconName="quality" />
          <div className="flex flex-col">
            <label className="mb-1 flex items-center gap-1.5 text-xs text-poe-text-muted">
              <PoeIcon name="chisel" size={16} /> Quality Type
            </label>
            <select
              value={filters.qualityType}
              onChange={(e) => updateFilter('qualityType', e.target.value as QualityType)}
              className="w-full border border-poe-border/30 bg-poe-panel/40 px-2 py-1.5 text-sm text-poe-text focus:border-poe-gold/40 focus:outline-none"
            >
              {QUALITY_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {/* Corrupted: 3-state */}
          <div className="flex flex-col">
            <label className="mb-1 flex items-center gap-1.5 text-xs text-poe-text-muted">
              <PoeIcon name="corrupted" size={16} /> Corrupted
            </label>
            <div className="flex">
              {(['natural', 'prefer', 'avoid'] as const).map((opt) => {
                const labels = { natural: 'Any', prefer: 'Yes', avoid: 'No' } as const;
                const colors = {
                  natural: filters.corrupted === opt ? 'bg-poe-panel-light text-poe-text' : '',
                  prefer: filters.corrupted === opt ? 'bg-poe-chaos/20 text-poe-chaos' : '',
                  avoid: filters.corrupted === opt ? 'bg-poe-success/15 text-poe-success' : '',
                } as const;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => updateFilter('corrupted', opt)}
                    className={`flex-1 border border-poe-border/30 px-2 py-1.5 text-xs transition-all ${colors[opt]} ${filters.corrupted !== opt ? 'text-poe-text-muted hover:bg-poe-panel/40' : ''}`}
                  >
                    {labels[opt]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Row 3: More drops */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatFilterInput label="+ Currency" value={filters.moreCurrency} onChange={(v) => updateFilter('moreCurrency', v)} iconName="currency" />
          <StatFilterInput label="+ Maps" value={filters.moreMaps} onChange={(v) => updateFilter('moreMaps', v)} iconName="map" />
          <StatFilterInput label="+ Scarabs" value={filters.moreScarabs} onChange={(v) => updateFilter('moreScarabs', v)} iconName="scarab" />
          <StatFilterInput label="+ Divination" value={filters.moreDivination} onChange={(v) => updateFilter('moreDivination', v)} iconName="divination" />
        </div>
      </div>

      {/* Mod search */}
      <Input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Filter mods... (e.g. reflect, regen, life)"
        className="mx-4 mt-4 text-xs lg:mx-6"
      />

      {/* ── Two columns: Avoid / Prefer ── */}
      <div className="mt-4 grid min-h-0 flex-1 gap-3 px-4 lg:grid-cols-2 lg:px-6">
        {/* Avoid — high scary first */}
        <div className="flex min-h-0 flex-col">
          <div className="mb-2 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-poe-error" />
            <h4 className="text-sm font-semibold text-poe-error/80">
              AVOID ({avoidIds.size})
            </h4>
          </div>
          <p className="mb-2 text-xs text-poe-text-muted">
            Mods you don&apos;t want — most dangerous first
          </p>
          <div className="flex-1 space-y-px overflow-y-auto">
            {avoidSorted.map((mod) => (
              <ModRow key={mod.id} mod={mod} selected={avoidIds.has(mod.id)} onToggle={() => toggleAvoid(mod.id)} />
            ))}
          </div>
        </div>

        {/* Prefer — low scary first */}
        <div className="flex min-h-0 flex-col">
          <div className="mb-2 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-poe-success" />
            <h4 className="text-sm font-semibold text-poe-success/80">
              PREFER ({preferIds.size})
            </h4>
          </div>
          <p className="mb-2 text-xs text-poe-text-muted">
            Mods you want — safest first
          </p>
          <div className="flex-1 space-y-px overflow-y-auto">
            {preferSorted.map((mod) => (
              <ModRow key={mod.id} mod={mod} selected={preferIds.has(mod.id)} onToggle={() => togglePrefer(mod.id)} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom bar: vendor regex + actions ── */}
      <div className="shrink-0 mt-auto border-t border-poe-border/30 bg-poe-bg px-4 py-3 lg:px-6">
        {hasAnyFilter && vendorRegex.length > 0 && (
          <div className="mb-3 border border-poe-gold/30 bg-poe-panel/40 p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <h4 className="text-xs font-medium tracking-wide text-poe-gold/70">
                Stash Search Regex
              </h4>
              <button
                onClick={async () => {
                  await copyToClipboard(vendorRegex);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className={`text-[11px] ${copied ? 'text-poe-success' : 'text-poe-text-dim hover:text-poe-gold'}`}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="break-all font-mono text-sm text-poe-currency">{vendorRegex}</p>
            <p className={`mt-1.5 text-xs ${vendorRegex.length > 250 ? 'text-poe-error' : 'text-poe-text-muted'}`}>
              {vendorRegex.length}/250 chars{vendorRegex.length > 250 ? ' — too long! Remove some filters' : ' — paste in stash tab search'}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-xs text-poe-text-dim">
            <span className="text-poe-error">{avoidIds.size}</span> avoid
            {' · '}
            <span className="text-poe-success">{preferIds.size}</span> prefer
            {isNightmareMap && <span className="text-purple-400"> · nightmare</span>}
            {Object.values(filters).some((v) => v !== '') && (
              <span className="text-poe-currency"> · stats active</span>
            )}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleClear}>
              Clear All
            </Button>
            <Button variant="primary" size="sm" onClick={handleOpenTrade} disabled={searching || !hasAnyFilter}>
              {searching ? 'Searching...' : 'Open Trade ↗'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
