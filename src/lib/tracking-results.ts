// ABOUTME: Per-strategy results from measured tracking runs — profit, div/hr, maps/hr, profit per map.
// ABOUTME: A run's profit and time are split evenly across its maps, so maps moved to another strategy carry their share.

import { strategyCostPerMap } from '@/lib/strategy-cost';
import type { StrategyConfig } from '@/types/strategies';
import type { TrackingRunDetail } from '@/types/tracking';

export interface RunResult {
  runId: string;
  startedAt: string;
  maps: number;
  /** null while the run is open or one of its snapshots is missing. */
  hours: number | null;
  gross: number | null;
  cost: number;
  net: number | null;
  divineRate: number | null;
}

export interface StrategyTotals {
  runs: number;
  maps: number;
  hours: number;
  netChaos: number;
  netDivine: number | null;
  divPerHour: number | null;
  mapsPerHour: number | null;
  profitPerMap: number | null;
}

function hoursBetween(start: string, end: string): number {
  return (new Date(end + 'Z').getTime() - new Date(start + 'Z').getTime()) / 3_600_000;
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/** `config` is the strategy's own config; its cost per map prices every map attributed to it. */
export function strategyResults(
  strategyId: string,
  runs: TrackingRunDetail[],
  config: StrategyConfig | null,
): { rows: RunResult[]; totals: StrategyTotals } {
  const costPerMap = config ? strategyCostPerMap(config) : 0;
  const rows: RunResult[] = [];

  for (const run of runs) {
    const maps = run.maps.filter((m) => (m.strategyId ?? run.strategyId) === strategyId).length;
    if (maps === 0) continue;
    const share = maps / run.maps.length;
    const cost = costPerMap * maps;
    const { endedAt, beforeChaos, afterChaos } = run;
    let gross: number | null = null;
    let hours: number | null = null;
    if (endedAt !== null && beforeChaos !== null && afterChaos !== null) {
      gross = (afterChaos - beforeChaos) * share;
      hours = hoursBetween(run.startedAt, endedAt) * share;
    }
    rows.push({
      runId: run.id,
      startedAt: run.startedAt,
      maps,
      hours,
      gross,
      cost,
      net: gross === null ? null : gross - cost,
      divineRate: run.divineRate,
    });
  }

  const measured = rows.filter((r) => r.net !== null && r.hours !== null);
  const maps = sum(measured.map((r) => r.maps));
  const hours = sum(measured.map((r) => r.hours ?? 0));
  const netChaos = sum(measured.map((r) => r.net ?? 0));
  const priced = measured.length > 0 && measured.every((r) => (r.divineRate ?? 0) > 0);
  const netDivine = priced ? sum(measured.map((r) => (r.net ?? 0) / (r.divineRate ?? 1))) : null;

  return {
    rows,
    totals: {
      runs: measured.length,
      maps,
      hours,
      netChaos,
      netDivine,
      divPerHour: netDivine !== null && hours > 0 ? netDivine / hours : null,
      mapsPerHour: hours > 0 ? maps / hours : null,
      profitPerMap: maps > 0 ? netChaos / maps : null,
    },
  };
}
