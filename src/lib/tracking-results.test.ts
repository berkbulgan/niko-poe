// ABOUTME: Tests per-strategy attribution of measured tracking runs.
// ABOUTME: Covers reassigned maps, runs with unknown profit, and strategies with no maps.

import { describe, expect, it } from 'vitest';
import { strategyResults } from './tracking-results';
import type { StrategyConfig } from '@/types/strategies';
import type { MapRun, TrackingRunDetail } from '@/types/tracking';

const config: StrategyConfig = { items: [], averageMapCost: 10, mapCount: 1, filterPresetId: null, atlasTreeId: null };

function map(id: string, strategyId: string | null = null): MapRun {
  return { id, areaName: 'Strand', areaId: 'MapWorldsStrand', areaLevel: 83, seed: 1, enteredAt: '', durationSecs: 300, strategyId };
}

function run(overrides: Partial<TrackingRunDetail>): TrackingRunDetail {
  return {
    id: 'r1', strategyId: 'A', configId: 'c', startedAt: '2026-11-02 10:00:00', endedAt: '2026-11-02 12:00:00',
    beforeChaos: 1000, afterChaos: 1400, divineRate: 200, maps: [], ...overrides,
  };
}

describe('strategyResults', () => {
  it('splits a run evenly across its maps, honouring reassigned maps', () => {
    const runs = [run({ maps: [map('m1'), map('m2'), map('m3'), map('m4', 'B')] })];

    const a = strategyResults('A', runs, config);
    expect(a.rows).toHaveLength(1);
    expect(a.rows[0]).toMatchObject({ maps: 3, gross: 300, cost: 30, net: 270, hours: 1.5 });
    expect(a.totals).toMatchObject({ runs: 1, maps: 3, netChaos: 270, netDivine: 1.35, mapsPerHour: 2 });
    expect(a.totals.divPerHour).toBeCloseTo(0.9);

    const b = strategyResults('B', runs, config);
    expect(b.rows[0]).toMatchObject({ maps: 1, gross: 100, net: 90, hours: 0.5 });
  });

  it('lists open or snapshot-less runs without counting them in totals', () => {
    const runs = [run({ id: 'open', endedAt: null, afterChaos: null, maps: [map('m1')] })];
    const { rows, totals } = strategyResults('A', runs, config);
    expect(rows[0]).toMatchObject({ maps: 1, gross: null, net: null, hours: null });
    expect(totals).toMatchObject({ runs: 0, maps: 0, divPerHour: null, profitPerMap: null });
  });

  it('returns nothing for a strategy without maps', () => {
    expect(strategyResults('Z', [run({ maps: [map('m1')] })], null).rows).toEqual([]);
  });
});
