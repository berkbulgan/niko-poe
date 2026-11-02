// ABOUTME: Type definitions for map tracking — live tracker state, run history, and tracker settings.
// ABOUTME: Mirrors the camelCase structs in src-tauri/src/commands/tracking.rs.

export interface ActiveRun {
  id: string;
  strategyId: string;
  configId: string;
  startedAt: string;
  mapCount: number;
}

export interface TrackerState {
  logFound: boolean;
  logActive: boolean;
  inMap: boolean;
  currentMap: { name: string; level: number } | null;
  suggestTracking: boolean;
  busy: boolean;
  activeRun: ActiveRun | null;
}

export interface MapRun {
  id: string;
  areaName: string;
  areaId: string;
  areaLevel: number;
  seed: number;
  enteredAt: string;
  durationSecs: number;
  /** null = the run's strategy. */
  strategyId: string | null;
}

export interface TrackingRunDetail {
  id: string;
  strategyId: string;
  configId: string;
  startedAt: string;
  endedAt: string | null;
  beforeChaos: number | null;
  afterChaos: number | null;
  divineRate: number | null;
  maps: MapRun[];
}

export interface TrackerSettings {
  logPath: string | null;
  activePath: string | null;
  logFound: boolean;
  overlayEnabled: boolean;
}

export interface TrackerSettingsInput {
  logPath: string | null;
  overlayEnabled: boolean;
}
