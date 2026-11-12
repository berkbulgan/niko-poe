// ABOUTME: Zustand store for runtime game data: which map mod data is in use and when the N.I.K.O. server last answered.
// ABOUTME: Loads saved map mod data before the first render and refreshes it from the server at startup and every 24 h.

import { create } from 'zustand';
import * as ipc from '@/lib/ipc';
import { applyMapModData } from '@/data';
import sources from '@/data/sources.json';
import { useFiltersStore } from '@/lib/stores/filters-store';
import type { AtlasVersion } from '@/types/game-data';

export type MapModSource = 'bundled' | 'cached' | 'server';
export type RefreshStatus = ipc.MapModRefresh['status'];

interface GameDataState {
  /** The map mod data patch in use. */
  mapModPatch: string;
  mapModSource: MapModSource;
  /** When the server last answered (RFC 3339); null before the first answer. */
  checkedAt: string | null;
  /** The last refresh failed. */
  offline: boolean;
  /** The current atlas tag. */
  atlasTag: string;
  /** The server's atlas tag list as last read (cached on disk), newest first; [] until the first read. */
  atlasVersions: AtlasVersion[];
  /** Bumped on every runtime apply; components keyed on it remount against the new data. */
  version: number;
}

export const useGameDataStore = create<GameDataState>(() => ({
  mapModPatch: sources.poeRePatch,
  mapModSource: 'bundled',
  checkedAt: null,
  offline: false,
  atlasTag: sources.atlasTag,
  atlasVersions: [],
  version: 0,
}));

const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Applies the map mod data saved by an earlier run. Call before the first render. */
export async function loadCachedMapMods(): Promise<void> {
  try {
    const cached = await ipc.mapModDataCached();
    if (cached && applyMapModData(cached.data)) {
      useGameDataStore.setState({ mapModPatch: cached.patch, mapModSource: 'cached', checkedAt: cached.checkedAt });
    }
  } catch (err) {
    console.error('[GameData] could not read saved map mod data:', err);
  }
}

/** Asks the server for newer map mod data and applies it. Never rejects. */
export async function refreshMapMods(): Promise<RefreshStatus> {
  let result: ipc.MapModRefresh;
  try {
    result = await ipc.refreshMapModData();
  } catch (err) {
    console.error('[GameData] map mod refresh failed:', err);
    result = { status: 'failed' };
  }
  if (result.status === 'unchanged') {
    useGameDataStore.setState({ checkedAt: result.checkedAt ?? null, offline: false });
    return 'unchanged';
  }
  const data = result.status === 'updated' ? result.data : undefined;
  if (!data || !applyMapModData(data)) {
    useGameDataStore.setState({ offline: true });
    return 'failed';
  }
  // Re-resolve the open Regex draft against the new ids; autosave then stores the remapped ids.
  useFiltersStore.getState().loadConfig(useFiltersStore.getState().getConfig());
  useGameDataStore.setState((s) => ({
    mapModPatch: data.patch,
    mapModSource: 'server',
    checkedAt: result.checkedAt ?? null,
    offline: false,
    version: s.version + 1,
  }));
  return 'updated';
}

/** Refreshes game data now, then every 24 hours while the app is open. Call once, after the first render. */
export function startGameDataRefresh(): void {
  const refresh = () => {
    void refreshMapMods();
  };
  refresh();
  setInterval(refresh, REFRESH_INTERVAL_MS);
}
