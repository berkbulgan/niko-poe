// ABOUTME: Trade Search page — select filters, search pathofexile.com/trade, view results.
// ABOUTME: Shows results with price, mods, and one-click whisper copy.

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { useRegexFilters } from '@/lib/hooks/use-regex-filters';
import { useTradeSearch } from '@/lib/hooks/use-trade';
import { formatPrice, formatTimeAgo, copyToClipboard } from '@/lib/utils';
import type { TradeResult } from '@/types';

function FilterCheckbox({
  name,
  pattern,
  category,
  checked,
  onChange,
}: {
  name: string;
  pattern: string;
  category: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`
        flex cursor-pointer items-start gap-3 border px-3 py-2.5 transition-all duration-150
        ${checked
          ? 'border-poe-gold/40 bg-poe-gold/5'
          : 'border-poe-border/20 hover:border-poe-border/40'
        }
      `}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 accent-amber-600"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm text-poe-text">{name}</span>
          <Badge variant={category as 'stat' | 'modifier' | 'attribute' | 'custom'}>
            {category}
          </Badge>
        </div>
        <p className="mt-0.5 truncate font-mono text-xs text-poe-text-muted">
          {pattern}
        </p>
      </div>
    </label>
  );
}

function TradeResultRow({ result }: { result: TradeResult }) {
  const [copied, setCopied] = useState(false);

  async function handleCopyWhisper() {
    const success = await copyToClipboard(result.whisper);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="border border-poe-border/20 bg-poe-panel/20 transition-colors hover:bg-poe-panel/30">
      {/* Item header */}
      <div className="flex items-center justify-between border-b border-poe-border/10 px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm text-poe-rare">{result.itemName}</p>
          <p className="text-xs text-poe-text-muted">{result.itemType}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-sm text-poe-currency">
            {formatPrice(result.price.amount, result.price.currency)}
          </p>
          <p className="text-xs text-poe-text-muted">
            {formatTimeAgo(result.listingTime)}
          </p>
        </div>
      </div>

      {/* Mods */}
      <div className="px-4 py-2">
        {result.mods.map((mod, idx) => (
          <p key={idx} className="font-mono text-xs leading-relaxed text-poe-magic">
            {mod}
          </p>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-poe-border/10 px-4 py-2">
        <p className="truncate text-xs text-poe-text-muted">
          {result.seller}
        </p>
        <button
          onClick={handleCopyWhisper}
          className={`
            text-xs transition-colors
            ${copied
              ? 'text-poe-success'
              : 'text-poe-text-dim hover:text-poe-gold'
            }
          `}
        >
          {copied ? 'Copied!' : 'Copy whisper'}
        </button>
      </div>
    </div>
  );
}

export default function TradePage() {
  const [selectedFilterIds, setSelectedFilterIds] = useState<Set<string>>(new Set());
  const [league, setLeague] = useState('Settlers');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const { data: filtersData, isLoading: filtersLoading } = useRegexFilters(1, 100);
  const tradeSearch = useTradeSearch();

  const filters = filtersData?.data ?? [];
  const results = tradeSearch.data?.results ?? [];

  function toggleFilter(id: string, checked: boolean) {
    setSelectedFilterIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  function handleSearch() {
    if (selectedFilterIds.size === 0) return;

    tradeSearch.mutate({
      filterIds: Array.from(selectedFilterIds),
      league,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
    });
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="font-display text-xl tracking-wide text-poe-text">
          Trade Search
        </h1>
        <p className="mt-1 text-sm text-poe-text-muted">
          Select filters and search the trade site.
        </p>
      </div>

      <div className="my-6 h-px bg-poe-border/30" />

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left panel: Filter selection + search options */}
        <div className="space-y-5 lg:col-span-2">
          {/* Filter selection */}
          <div>
            <h2 className="mb-2 font-display text-xs tracking-[0.3em] text-poe-text-muted">
              SELECT FILTERS
            </h2>

            {filtersLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : filters.length === 0 ? (
              <div className="border border-dashed border-poe-border/30 p-6 text-center">
                <p className="text-sm text-poe-text-dim">No filters created yet.</p>
                <p className="mt-1 text-xs text-poe-text-muted">
                  Go to Regex Filters to create some.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {filters.map((f) => (
                  <FilterCheckbox
                    key={f.id}
                    name={f.name}
                    pattern={f.pattern}
                    category={f.category}
                    checked={selectedFilterIds.has(f.id)}
                    onChange={(checked) => toggleFilter(f.id, checked)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Search options */}
          <div className="space-y-3">
            <h2 className="font-display text-xs tracking-[0.3em] text-poe-text-muted">
              SEARCH OPTIONS
            </h2>

            <div>
              <label className="mb-1 block text-xs text-poe-text-muted">League</label>
              <Input
                value={league}
                onChange={(e) => setLeague(e.target.value)}
                placeholder="Settlers"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-poe-text-muted">Min price</label>
                <Input
                  type="number"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-poe-text-muted">Max price</label>
                <Input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="999"
                />
              </div>
            </div>

            <Button
              variant="primary"
              className="w-full font-display tracking-widest"
              onClick={handleSearch}
              disabled={selectedFilterIds.size === 0 || tradeSearch.isPending}
            >
              {tradeSearch.isPending ? (
                <span className="flex items-center gap-2">
                  <Spinner size="sm" /> SEARCHING...
                </span>
              ) : (
                `SEARCH TRADE (${selectedFilterIds.size} filter${selectedFilterIds.size !== 1 ? 's' : ''})`
              )}
            </Button>
          </div>
        </div>

        {/* Right panel: Results */}
        <div className="lg:col-span-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-xs tracking-[0.3em] text-poe-text-muted">
              RESULTS
            </h2>
            {results.length > 0 && (
              <span className="text-xs text-poe-text-dim">
                {tradeSearch.data?.total ?? 0} items found
              </span>
            )}
          </div>

          {tradeSearch.isPending ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Spinner size="lg" />
              <p className="mt-4 text-sm text-poe-text-dim">
                Searching the trade market...
              </p>
            </div>
          ) : tradeSearch.isError ? (
            <div className="border border-poe-error/30 bg-poe-error/5 p-6 text-center">
              <p className="text-sm text-poe-error">Search failed</p>
              <p className="mt-1 text-xs text-poe-text-muted">
                The trade API may be rate-limited. Try again in a few seconds.
              </p>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-2">
              {results.map((result) => (
                <TradeResultRow key={result.id} result={result} />
              ))}
            </div>
          ) : tradeSearch.isSuccess ? (
            <div className="py-20 text-center">
              <p className="text-sm text-poe-text-dim">No items matched your filters.</p>
              <p className="mt-1 text-xs text-poe-text-muted">
                Try broadening your regex patterns or price range.
              </p>
            </div>
          ) : (
            <div className="border border-dashed border-poe-border/20 py-20 text-center">
              <p className="font-display text-sm text-poe-text-dim">
                Select filters and hit search
              </p>
              <p className="mt-1 text-xs text-poe-text-muted">
                Results from pathofexile.com/trade will appear here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
