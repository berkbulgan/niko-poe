// ABOUTME: Tests which strategies of a stopped run are offered for sharing.
// ABOUTME: Covers unlinked strategies, short runs and runs split across two strategies.

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/ipc', () => ({ contentHash: vi.fn() }));

const { shareCandidates } = await import('./result-sharing');
import type { StrategyParsed } from '@/lib/hooks/use-strategies';
import type { MapRun, TrackingRunDetail } from '@/types/tracking';

const config = { items: [], averageMapCost: 0, mapCount: 1, filterPresetId: null, atlasTreeId: null };
const strategy = (id: string) => ({ id, name: `Strategy ${id}`, config }) as unknown as StrategyParsed;
const map = (id: string, strategyId: string | null = null): MapRun => ({
  id, areaName: 'Strand', areaId: 'MapWorldsStrand', areaLevel: 83, seed: 1, enteredAt: '', durationSecs: 300, strategyId,
});
const run = (maps: MapRun[]): TrackingRunDetail => ({
  id: 'r1', strategyId: 'A', configId: 'c', startedAt: '2026-11-09 10:00:00', endedAt: '2026-11-09 12:00:00',
  beforeChaos: 1000, afterChaos: 3000, divineRate: 200, maps,
});

describe('shareCandidates', () => {
  it('offers only linked strategies with enough maps', () => {
    const maps = [...['1', '2', '3', '4', '5', '6'].map((i) => map(i)), map('7', 'B'), map('8', 'B')];
    const result = shareCandidates(run(maps), [strategy('A'), strategy('B')], { A: 'aaaaaaaa', B: 'bbbbbbbb' });
    // B has only 2 maps, so only A qualifies: 6 of 8 maps → 1.5 h, 1500 chaos → 7.5 div.
    expect(result).toEqual([{ communityId: 'aaaaaaaa', strategyName: 'Strategy A', payload: { maps: 6, hours: 1.5, netDivine: 7.5 } }]);
  });

  it('skips strategies that are not linked', () => {
    const maps = ['1', '2', '3', '4', '5'].map((i) => map(i));
    expect(shareCandidates(run(maps), [strategy('A')], {})).toEqual([]);
  });
});
