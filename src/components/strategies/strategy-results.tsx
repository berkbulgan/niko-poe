// ABOUTME: Measured results for one strategy — totals, div/hr per run, and the map log of each run.
// ABOUTME: Maps can be moved to another strategy, one or many at once, to fix maps logged under the wrong one.

import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LineChart } from '@/components/ui/line-chart';
import { useStrategies } from '@/lib/hooks/use-strategies';
import { useDeleteTrackingRun, useReassignMapRuns, useTrackerState, useTrackingHistory } from '@/lib/hooks/use-tracking';
import { confirmAction } from '@/lib/platform';
import { useCurrencyDisplay } from '@/lib/stores/currency-display-store';
import { strategyResults } from '@/lib/tracking-results';

function shortDate(db: string): string {
  const d = new Date(db + 'Z');
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-poe-border/20 bg-poe-panel/40 p-2">
      <p className="text-poe-text-muted">{label}</p>
      <p className="font-medium text-poe-text">{value}</p>
    </div>
  );
}

export function StrategyResults({ strategyId }: { strategyId: string }) {
  const tracker = useTrackerState();
  const { data: runs } = useTrackingHistory();
  const { data: strategies } = useStrategies();
  const { unit } = useCurrencyDisplay();
  const reassign = useReassignMapRuns();
  const deleteRun = useDeleteTrackingRun();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const config = strategies?.find((s) => s.id === strategyId)?.config ?? null;
  const { rows, totals } = useMemo(
    () => strategyResults(strategyId, runs ?? [], config),
    [strategyId, runs, config],
  );

  const money = (chaos: number, divineRate: number | null) =>
    unit === 'divine' && divineRate ? `${(chaos / divineRate).toFixed(1)} div` : `${chaos.toFixed(0)} c`;

  const chartData = [...rows].reverse().flatMap((r) => {
    if (r.net === null || !r.hours || !r.divineRate) return [];
    const value = r.net / r.divineRate / r.hours;
    return [{ label: shortDate(r.startedAt), value, tooltip: `${value.toFixed(1)} div/hr` }];
  });

  const profitPerMap =
    totals.maps === 0
      ? '—'
      : unit === 'divine' && totals.netDivine !== null
        ? `${(totals.netDivine / totals.maps).toFixed(2)} div`
        : `${(totals.netChaos / totals.maps).toFixed(0)} c`;

  function move(mapIds: string[], runStrategyId: string, target: string) {
    reassign.mutate(
      { mapIds, strategyId: target === runStrategyId ? null : target },
      { onSuccess: () => setSelected(new Set()) },
    );
  }

  const expandedRun = runs?.find((r) => r.id === expanded);

  return (
    <section className="mt-6 border-t border-poe-border/20 pt-4">
      <h3 className="mb-2 font-display text-sm tracking-wide text-poe-text-dim">Results</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-poe-text-muted">No tracked maps yet. Start tracking from the in-game overlay.</p>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <Stat label="Sample" value={`${totals.maps} maps · ${totals.runs} runs · ${totals.hours.toFixed(1)} h`} />
            <Stat label="Div / hr" value={totals.divPerHour?.toFixed(1) ?? '—'} />
            <Stat label="Maps / hr" value={totals.mapsPerHour?.toFixed(1) ?? '—'} />
            <Stat label="Profit / map" value={profitPerMap} />
          </div>
          {chartData.length > 1 && <LineChart data={chartData} unit="div/hr" />}

          {selected.size > 0 && expandedRun && (
            <div className="my-2 flex items-center gap-2 text-xs">
              <span>{selected.size} selected — move to</span>
              <select
                aria-label="Move selected maps to strategy"
                value=""
                onChange={(e) => move([...selected], expandedRun.strategyId, e.target.value)}
                className="border border-poe-border/40 bg-poe-panel px-1 py-0.5"
              >
                <option value="" disabled>Strategy…</option>
                {strategies?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          <table className="w-full text-xs">
            <thead className="text-left text-poe-text-muted">
              <tr>
                <th className="w-6" />
                <th>Started</th>
                <th>Maps</th>
                <th>Hours</th>
                <th>Net</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const run = runs?.find((x) => x.id === r.runId);
                const open = expanded === r.runId;
                const active = tracker?.activeRun?.id === r.runId;
                return (
                  <Fragment key={r.runId}>
                    <tr className="border-t border-poe-border/10">
                      <td>
                        <button
                          type="button"
                          aria-label={open ? 'Hide maps' : 'Show maps'}
                          onClick={() => {
                            setExpanded(open ? null : r.runId);
                            setSelected(new Set());
                          }}
                          className="text-poe-text-dim hover:text-poe-text"
                        >
                          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      </td>
                      <td>{shortDate(r.startedAt)}</td>
                      <td>{r.maps}</td>
                      <td>{r.hours?.toFixed(1) ?? '—'}</td>
                      <td className={r.net === null ? 'text-poe-text-muted' : r.net >= 0 ? 'text-poe-success' : 'text-red-400'}>
                        {active ? 'running' : r.net === null ? 'unknown' : money(r.net, r.divineRate)}
                      </td>
                      <td>
                        {!active && (
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label="Delete run"
                            onClick={() => {
                              if (confirmAction('Delete this run and its map log? Its snapshots are kept.')) {
                                deleteRun.mutate(r.runId);
                              }
                            }}
                          >
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </td>
                    </tr>
                    {open && run?.maps.map((m) => (
                      <tr key={m.id} className="text-poe-text-dim">
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Select ${m.areaName}`}
                            checked={selected.has(m.id)}
                            onChange={(e) => {
                              const next = new Set(selected);
                              if (e.target.checked) next.add(m.id);
                              else next.delete(m.id);
                              setSelected(next);
                            }}
                          />
                        </td>
                        <td>{m.areaName} (lvl {m.areaLevel})</td>
                        <td colSpan={2}>{Math.round(m.durationSecs / 60)} min</td>
                        <td colSpan={2}>
                          <select
                            aria-label={`Strategy for ${m.areaName}`}
                            value={m.strategyId ?? run.strategyId}
                            onChange={(e) => move([m.id], run.strategyId, e.target.value)}
                            className="border border-poe-border/40 bg-poe-panel px-1 py-0.5"
                          >
                            {strategies?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
