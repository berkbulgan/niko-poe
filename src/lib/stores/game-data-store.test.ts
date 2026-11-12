// ABOUTME: Tests the game data store's startup load and server refresh, with the IPC layer mocked.
// ABOUTME: Covers cached data, updated data remapping the open Regex draft, unchanged data, and failures.

import { describe, expect, it, vi } from 'vitest';
import type { MapModData } from '@/types/game-data';

vi.mock('@/lib/ipc', () => ({ mapModDataCached: vi.fn(), refreshMapModData: vi.fn() }));

const ipc = await import('@/lib/ipc');
// Read MAP_MODS through the module object: it is a live binding that applyMapModData replaces.
const dataModule = await import('@/data');
const { applyMapModData } = dataModule;
const { useFiltersStore } = await import('@/lib/stores/filters-store');
const { loadCachedMapMods, refreshMapMods, useGameDataStore } = await import('./game-data-store');

const mapMods = (patch: string, ids: number[]): MapModData => ({
  patch,
  sha256: `sha-${patch}`,
  optimizationTable: {},
  aliases: { '1': 2 },
  tokens: ids.map((id) => ({
    id, regex: `r${id}`, rawText: `Mod ${id}`, generalizedText: `^mod ${id}$`, options: { scary: 100 },
  })),
});

const modIds = () => dataModule.MAP_MODS.map((m) => m.id);

describe('game data store', () => {
  it('starts on the bundled data', () => {
    expect(useGameDataStore.getState()).toMatchObject({ mapModSource: 'bundled', checkedAt: null, offline: false, version: 0 });
    expect(modIds().length).toBeGreaterThan(0);
  });

  it('applies saved map mod data before the first render', async () => {
    vi.mocked(ipc.mapModDataCached).mockResolvedValueOnce({
      patch: '3.30.0.1', sha256: 'x', checkedAt: '2026-11-12T10:00:00Z', data: mapMods('3.30.0.1', [2, 3]),
    });
    await loadCachedMapMods();
    expect(modIds()).toEqual([2, 3]);
    expect(useGameDataStore.getState()).toMatchObject({
      mapModPatch: '3.30.0.1', mapModSource: 'cached', checkedAt: '2026-11-12T10:00:00Z',
    });
  });

  it('on updated: applies the data, remaps the open Regex draft and bumps version', async () => {
    applyMapModData(mapMods('old', [1, 5]));
    const filters = useFiltersStore.getState();
    filters.loadConfig({ ...filters.getConfig(), avoidModIds: [1], preferModIds: [5] });
    const before = useGameDataStore.getState().version;
    vi.mocked(ipc.refreshMapModData).mockResolvedValueOnce({
      status: 'updated', data: mapMods('3.30.0.2', [2, 5]), checkedAt: '2026-11-12T11:00:00Z',
    });

    await expect(refreshMapMods()).resolves.toBe('updated');

    expect(modIds()).toEqual([2, 5]);
    expect([...useFiltersStore.getState().avoidIds]).toEqual([2]);
    expect([...useFiltersStore.getState().preferIds]).toEqual([5]);
    expect(useGameDataStore.getState()).toMatchObject({
      mapModPatch: '3.30.0.2', mapModSource: 'server', checkedAt: '2026-11-12T11:00:00Z', offline: false, version: before + 1,
    });
  });

  it('on unchanged: records the check and clears offline', async () => {
    useGameDataStore.setState({ offline: true });
    const version = useGameDataStore.getState().version;
    vi.mocked(ipc.refreshMapModData).mockResolvedValueOnce({ status: 'unchanged', checkedAt: '2026-11-12T12:00:00Z' });

    await expect(refreshMapMods()).resolves.toBe('unchanged');

    expect(useGameDataStore.getState()).toMatchObject({ checkedAt: '2026-11-12T12:00:00Z', offline: false, version });
  });

  it('on failure, a rejected call or invalid data: sets offline and keeps the data', async () => {
    applyMapModData(mapMods('keep', [7]));
    const outcomes = [
      () => Promise.resolve({ status: 'failed' as const }),
      () => Promise.reject(new Error('IPC down')),
      () => Promise.resolve({ status: 'updated' as const, data: { ...mapMods('bad', [8]), tokens: [{ id: 'x' }] } }),
    ];
    for (const outcome of outcomes) {
      useGameDataStore.setState({ offline: false });
      vi.mocked(ipc.refreshMapModData).mockImplementationOnce(outcome);
      await expect(refreshMapMods()).resolves.toBe('failed');
      expect(useGameDataStore.getState().offline).toBe(true);
    }
    expect(modIds()).toEqual([7]);
  });
});
