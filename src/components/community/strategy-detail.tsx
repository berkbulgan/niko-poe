// ABOUTME: Detail panel for a community strategy: metadata, notes, live-priced items, import/favourite/report.
// ABOUTME: Item prices are re-looked-up from the current poe.ninja data, falling back to the author's prices.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Markdown } from '@/components/ui/markdown';
import { PoeIcon } from '@/components/ui/poe-icon';
import { PricedItemTable, type PricedItem } from '@/components/ui/priced-item-table';
import { Spinner } from '@/components/ui/spinner';
import { useCommunityStrategy, useReportStrategy, useToggleFavourite } from '@/lib/hooks/use-community';
import { useDivinePrice } from '@/lib/hooks/use-prices';
import { useImportEntity } from '@/lib/hooks/use-sharing';
import { isFavourited } from '@/lib/community-storage';
import { useLeague } from '@/lib/league-context';
import { copyToClipboard, openExternal } from '@/lib/platform';
import { toast } from '@/lib/stores/toast-store';
import { strategyCostPerMap } from '@/lib/strategy-cost';
import * as ipc from '@/lib/ipc';
import type { StrategyConfig } from '@/types/strategies';

interface StrategyBundle {
  name: string;
  config: StrategyConfig;
  filterPreset: { name: string } | null;
  atlasTree: { name: string } | null;
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-poe-panel-light/60 px-1.5 py-0.5 text-[11px] capitalize text-poe-text-dim">{children}</span>;
}

export function StrategyDetailPanel({ id }: { id: string }) {
  const { currentLeague } = useLeague();
  const divinePrice = useDivinePrice(currentLeague);
  const { data: detail, isLoading, error } = useCommunityStrategy(id);
  const importEntity = useImportEntity();
  const toggleFavourite = useToggleFavourite();
  const report = useReportStrategy();
  const [reportReason, setReportReason] = useState<string | null>(null);

  const bundle = useQuery({
    queryKey: ['community', 'bundle', detail?.shareCode],
    queryFn: async () => {
      const decoded = await ipc.decodeShareCode(detail!.shareCode);
      return JSON.parse(decoded.payloadJson) as StrategyBundle;
    },
    enabled: !!detail,
    staleTime: Infinity,
  });

  const names = bundle.data?.config.items.map((i) => i.name) ?? [];
  const livePrices = useQuery({
    queryKey: ['item-prices', 'community', currentLeague, names],
    queryFn: () => ipc.lookupItemPrices(names, currentLeague),
    enabled: names.length > 0,
  });

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (error || !detail) {
    return <p className="p-6 text-sm text-poe-error">{error?.message ?? 'Strategy not found'}</p>;
  }

  const config = bundle.data?.config;
  const repriced: StrategyConfig | undefined = config && {
    ...config,
    items: config.items.map((item) => ({ ...item, unitPrice: livePrices.data?.[item.name]?.chaosValue ?? item.unitPrice })),
  };
  const tableItems: PricedItem[] = (repriced?.items ?? []).map((item) => ({
    id: `${item.category}|${item.name}`,
    name: item.name,
    icon: item.icon,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: item.quantity * item.unitPrice,
    lowListings: (livePrices.data?.[item.name]?.listingCount ?? Infinity) < 10,
  }));
  const costPerMap = repriced ? strategyCostPerMap(repriced) : null;
  const favourited = isFavourited(detail.id);

  function handleImport() {
    importEntity.mutate({ code: detail!.shareCode, communityId: detail!.id }, {
      onSuccess: () => toast.success(`Imported "${detail!.name}" into Strategies`),
    });
  }

  function handleReport() {
    if (!reportReason?.trim()) return;
    report.mutate({ id: detail!.id, reason: reportReason }, {
      onSuccess: () => {
        setReportReason(null);
        toast.success('Thanks, the report was sent');
      },
    });
  }

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-poe-text">{detail.name}</h2>
          <p className="mt-0.5 text-xs text-poe-text-muted">
            {detail.authorName ? `by ${detail.authorName} · ` : ''}
            {detail.league}{detail.patch ? ` · ${detail.patch}` : ''} · updated {new Date(detail.updatedAt).toLocaleDateString()}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip>{detail.budget} budget</Chip>
            <Chip>{detail.difficulty}</Chip>
            {detail.tags.map((t) => <Chip key={t}>{t}</Chip>)}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleFavourite.mutate({ id: detail.id, on: !favourited })}
            disabled={toggleFavourite.isPending}
            aria-pressed={favourited}
            title={favourited ? 'Remove favourite' : 'Favourite'}
          >
            <Star size={14} className={favourited ? 'fill-poe-currency text-poe-currency' : ''} />
            <span className="ml-1.5">{detail.favouriteCount}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void copyToClipboard(detail.id).then((ok) => ok && toast.success('ID copied'))}
          >
            Copy ID
          </Button>
          <Button variant="primary" size="sm" onClick={handleImport} disabled={importEntity.isPending}>
            {importEntity.isPending ? 'Importing...' : 'Import'}
          </Button>
        </div>
      </div>

      {importEntity.isError && <p className="text-xs text-poe-error">Import failed: {importEntity.error.message}</p>}

      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="border border-poe-border/30 px-3 py-2">
          <p className="text-poe-text-muted">Cost per map (live prices)</p>
          <p className="mt-1 flex items-center gap-1 text-sm text-poe-currency">
            {costPerMap === null ? '—' : costPerMap.toFixed(1)} <PoeIcon name="chaos" size={14} />
            {costPerMap !== null && divinePrice > 0 && (
              <span className="text-poe-text-muted">≈ {(costPerMap / divinePrice).toFixed(2)} div</span>
            )}
          </p>
        </div>
        <div className="border border-poe-border/30 px-3 py-2">
          <p className="text-poe-text-muted">Filter preset</p>
          <p className="mt-1 truncate text-sm text-poe-text">{bundle.data?.filterPreset?.name ?? '—'}</p>
        </div>
        <div className="border border-poe-border/30 px-3 py-2">
          <p className="text-poe-text-muted">Atlas tree</p>
          <p className="mt-1 truncate text-sm text-poe-text">{bundle.data?.atlasTree?.name ?? '—'}</p>
        </div>
      </div>

      {detail.videoUrl && (
        <button
          type="button"
          onClick={() => void openExternal(detail.videoUrl!)}
          className="text-xs text-poe-gold underline-offset-2 hover:underline"
        >
          Watch video ↗
        </button>
      )}

      {detail.notes && (
        <section className="border-t border-poe-border/20 pt-4">
          <Markdown>{detail.notes}</Markdown>
        </section>
      )}

      <section className="border-t border-poe-border/20 pt-4">
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-poe-text-dim">Items per map</h3>
        {bundle.isError ? (
          <p className="text-xs text-poe-error">This share code could not be read.</p>
        ) : (
          <PricedItemTable items={tableItems} divinePrice={divinePrice} showDivineRate={false} sortable={false} />
        )}
      </section>

      <section className="border-t border-poe-border/20 pt-4">
        {reportReason === null ? (
          <button type="button" onClick={() => setReportReason('')} className="text-xs text-poe-text-muted hover:text-poe-error">
            Report this strategy
          </button>
        ) : (
          <div className="flex gap-2">
            <Input
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="What is wrong with it?"
              maxLength={500}
              autoFocus
            />
            <Button variant="danger" size="sm" className="h-10" onClick={handleReport} disabled={report.isPending || !reportReason.trim()}>
              Send
            </Button>
            <Button variant="ghost" size="sm" className="h-10" onClick={() => setReportReason(null)}>Cancel</Button>
          </div>
        )}
      </section>
    </div>
  );
}
