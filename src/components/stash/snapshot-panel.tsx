// ABOUTME: Snapshot management panel — take snapshots, view history, line graph, ROI calculation.
// ABOUTME: Shown when "Snapshots" tab is active on the Stash page.

import { useState, useMemo } from 'react';
import { Camera, Trash2, ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { PoeIcon } from '@/components/ui/poe-icon';
import { LineChart } from '@/components/ui/line-chart';
import {
  useSnapshots,
  useSnapshotDetail,
  useTakeSnapshot,
  useDeleteSnapshot,
} from '@/lib/hooks/use-snapshots';
import { useStrategies } from '@/lib/hooks/use-strategies';
import { useCurrencyDisplay } from '@/lib/stores/currency-display-store';
import type { SnapshotConfig } from '@/types/snapshots';
import type { StrategyConfig } from '@/types/strategies';

interface SnapshotPanelProps {
  config: SnapshotConfig;
}

function formatValue(chaos: number, divineRate: number, unit: 'divine' | 'chaos'): string {
  if (unit === 'divine' && divineRate > 0) {
    return (chaos / divineRate).toFixed(1);
  }
  return chaos.toFixed(0);
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'Z');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function shortDate(iso: string): string {
  const d = new Date(iso + 'Z');
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function SnapshotPanel({ config }: SnapshotPanelProps) {
  const { unit, toggleUnit } = useCurrencyDisplay();
  const { data: snapshots, isLoading } = useSnapshots(config.id);
  const takeSnapshotMut = useTakeSnapshot();
  const deleteSnapshotMut = useDeleteSnapshot();
  const { data: strategies } = useStrategies();

  const [label, setLabel] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const hasStrategy = config.strategyId != null;

  // Find linked strategy config for ROI calc (useStrategies returns parsed configs)
  const strategyConfig = useMemo((): StrategyConfig | null => {
    if (!config.strategyId || !strategies) return null;
    const strat = strategies.find((s) => s.id === config.strategyId);
    return strat?.config ?? null;
  }, [config.strategyId, strategies]);

  async function handleTakeSnapshot() {
    await takeSnapshotMut.mutateAsync({
      configId: config.id,
      label: label ?? undefined,
    });
    setLabel(null);
  }

  // Chart data — oldest first for left-to-right time axis
  const chartData = useMemo(() => {
    if (!snapshots) return [];
    return [...snapshots].reverse().map((s) => {
      const divineRate = s.divineRate || 150;
      const val = unit === 'divine' && divineRate > 0
        ? s.totalChaos / divineRate
        : s.totalChaos;
      return {
        label: shortDate(s.createdAt),
        value: val,
        tooltip: `${val.toFixed(1)} ${unit === 'divine' ? 'div' : 'c'}`,
      };
    });
  }, [snapshots, unit]);

  // ROI calculation between before/after snapshots
  const roiInfo = useMemo(() => {
    if (!snapshots || !strategyConfig) return null;

    const before = snapshots.find((s) => s.label === 'before');
    const after = snapshots.find((s) => s.label === 'after');
    if (!before || !after) return null;

    const grossProfit = after.totalChaos - before.totalChaos;
    const strategyCost = strategyConfig.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    ) * strategyConfig.mapCount;
    const netProfit = grossProfit - strategyCost;
    const divineRate = after.divineRate || 150;

    return { grossProfit, strategyCost, netProfit, divineRate };
  }, [snapshots, strategyConfig]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const list = snapshots ?? [];
  const currIcon = unit === 'divine' ? 'divine' : 'chaos';
  const currLabel = unit === 'divine' ? 'div' : 'c';

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Take Snapshot controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          size="sm"
          onClick={() => { void handleTakeSnapshot(); }}
          disabled={takeSnapshotMut.isPending}
        >
          <span className="flex items-center gap-1.5">
            <Camera size={14} />
            {takeSnapshotMut.isPending ? 'Taking...' : 'Take Snapshot'}
          </span>
        </Button>

        {hasStrategy && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-poe-text-muted">Label:</span>
            {(['before', 'after'] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLabel(label === l ? null : l)}
                className={`rounded px-2 py-0.5 text-xs capitalize transition-colors ${
                  label === l
                    ? 'bg-poe-gold/20 text-poe-gold'
                    : 'bg-poe-panel-light/30 text-poe-text-dim hover:text-poe-text'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        )}

        <div className="ml-auto">
          <button
            type="button"
            onClick={toggleUnit}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-poe-text-dim transition-colors hover:bg-poe-panel-light/30 hover:text-poe-text"
          >
            <ArrowUpDown size={12} />
            <PoeIcon name={currIcon} size={14} />
            <span className="uppercase">{currLabel}</span>
          </button>
        </div>
      </div>

      {/* Line Chart */}
      {list.length > 0 && (
        <div className="overflow-x-auto border border-poe-border/20 bg-poe-panel/20 p-3">
          <LineChart
            data={chartData}
            width={Math.max(400, list.length * 80)}
            height={180}
            unit={unit === 'divine' ? ' div' : ' c'}
            emptyMessage="Take your first snapshot to see the chart"
          />
        </div>
      )}

      {/* ROI Banner (strategy-linked only) */}
      {roiInfo && (
        <div className="border border-poe-border/30 bg-poe-panel/30 p-4">
          <h4 className="mb-2 text-xs font-medium tracking-wider text-poe-text-muted">ROI CALCULATION</h4>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-poe-text-muted">Gross Profit</p>
              <p className="flex items-center justify-center gap-1 text-sm font-medium text-poe-currency">
                {formatValue(roiInfo.grossProfit, roiInfo.divineRate, unit)}
                <PoeIcon name={currIcon} size={14} />
              </p>
            </div>
            <div>
              <p className="text-xs text-poe-text-muted">Strategy Cost</p>
              <p className="flex items-center justify-center gap-1 text-sm font-medium text-red-400">
                -{formatValue(roiInfo.strategyCost, roiInfo.divineRate, unit)}
                <PoeIcon name={currIcon} size={14} />
              </p>
            </div>
            <div>
              <p className="text-xs text-poe-text-muted">Net Profit</p>
              <p className={`flex items-center justify-center gap-1 text-sm font-medium ${
                roiInfo.netProfit >= 0 ? 'text-poe-success' : 'text-red-400'
              }`}>
                {roiInfo.netProfit >= 0 ? '+' : ''}{formatValue(roiInfo.netProfit, roiInfo.divineRate, unit)}
                <PoeIcon name={currIcon} size={14} />
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Snapshot list */}
      <div>
        <h4 className="mb-2 text-xs font-medium tracking-wider text-poe-text-muted">
          HISTORY ({list.length})
        </h4>

        {list.length === 0 ? (
          <div className="border border-dashed border-poe-border/30 p-8 text-center">
            <p className="text-sm text-poe-text-dim">No snapshots yet</p>
            <p className="mt-1 text-xs text-poe-text-muted">
              Take your first snapshot to start tracking
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {list.map((snap, i) => {
              const divineRate = snap.divineRate || 150;
              const prevSnap = list[i + 1];
              const delta = prevSnap ? snap.totalChaos - prevSnap.totalChaos : null;
              const isExpanded = expandedId === snap.id;

              return (
                <div key={snap.id} className="border border-poe-border/20 bg-poe-panel/20">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : snap.id)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-poe-panel-light/20"
                  >
                    {snap.label && (
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                        snap.label === 'before'
                          ? 'bg-blue-500/15 text-blue-400'
                          : 'bg-green-500/15 text-green-400'
                      }`}>
                        {snap.label}
                      </span>
                    )}

                    <span className="flex-1 text-xs text-poe-text-dim">
                      {formatDate(snap.createdAt)}
                    </span>

                    <span className="flex items-center gap-1 text-sm font-medium tabular-nums text-poe-currency">
                      {formatValue(snap.totalChaos, divineRate, unit)}
                      <PoeIcon name={currIcon} size={14} />
                    </span>

                    {delta !== null && (
                      <span className={`text-xs tabular-nums ${
                        delta >= 0 ? 'text-poe-success' : 'text-red-400'
                      }`}>
                        {delta >= 0 ? '+' : ''}{formatValue(delta, divineRate, unit)}
                      </span>
                    )}

                    <span className="text-xs text-poe-text-muted">
                      {snap.totalItems} items
                      {snap.unpricedCount > 0 && (
                        <span className="text-poe-text-muted/60"> ({snap.unpricedCount} unpriced)</span>
                      )}
                    </span>

                    {isExpanded ? <ChevronUp size={14} className="text-poe-text-muted" /> : <ChevronDown size={14} className="text-poe-text-muted" />}
                  </button>

                  {isExpanded && (
                    <SnapshotDetail
                      snapshotId={snap.id}
                      unit={unit}
                      divineRate={divineRate}
                      onDelete={() => { void deleteSnapshotMut.mutateAsync(snap.id); }}
                      isDeleting={deleteSnapshotMut.isPending}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Expanded snapshot detail ────────────────────────────────────────────────

function SnapshotDetail({
  snapshotId,
  unit,
  divineRate,
  onDelete,
  isDeleting,
}: {
  snapshotId: string;
  unit: 'divine' | 'chaos';
  divineRate: number;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const { data: snapshot, isLoading } = useSnapshotDetail(snapshotId);

  if (isLoading || !snapshot) {
    return (
      <div className="flex justify-center py-4">
        <Spinner size="sm" />
      </div>
    );
  }

  const pricedItems = snapshot.items.filter((item) => item.chaosValue != null);
  const unpricedItems = snapshot.items.filter((item) => item.chaosValue == null);

  return (
    <div className="border-t border-poe-border/20 px-4 py-3">
      {/* Item table */}
      <table className="mb-3 w-full">
        <thead>
          <tr className="text-xs text-poe-text-muted">
            <th className="py-1 text-left font-medium">Item</th>
            <th className="w-16 py-1 text-right font-medium">Qty</th>
            <th className="w-24 py-1 text-right font-medium">Value</th>
          </tr>
        </thead>
        <tbody>
          {pricedItems.map((item) => {
            const total = (item.chaosValue ?? 0) * item.stackSize;
            return (
              <tr key={item.id} className="border-t border-poe-border/10">
                <td className="py-1">
                  <div className="flex items-center gap-2">
                    {item.icon && (
                      <img src={item.icon} alt="" className="h-5 w-5 object-contain" loading="lazy" />
                    )}
                    <span className="truncate text-xs text-poe-text">{item.itemName}</span>
                  </div>
                </td>
                <td className="py-1 text-right text-xs tabular-nums text-poe-text-dim">
                  {item.stackSize}
                </td>
                <td className="py-1 text-right">
                  <span className="flex items-center justify-end gap-1 text-xs tabular-nums text-poe-currency">
                    {formatValue(total, divineRate, unit)}
                    <PoeIcon name={unit === 'divine' ? 'divine' : 'chaos'} size={12} />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Unpriced items */}
      {unpricedItems.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-poe-text-muted">
            Unpriced ({unpricedItems.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unpricedItems.map((item) => (
              <span
                key={item.id}
                className="flex items-center gap-1 rounded bg-poe-panel-light/20 px-1.5 py-0.5 text-[10px] text-poe-text-dim"
              >
                {item.icon && (
                  <img src={item.icon} alt="" className="h-3.5 w-3.5 object-contain" />
                )}
                {item.itemName} x{item.stackSize}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Delete button */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={isDeleting}
          className="text-red-400 hover:text-red-300"
        >
          <span className="flex items-center gap-1">
            <Trash2 size={12} />
            Delete
          </span>
        </Button>
      </div>
    </div>
  );
}
