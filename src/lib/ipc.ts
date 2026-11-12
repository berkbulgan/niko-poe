// ABOUTME: Typed wrappers around Tauri IPC invoke calls for all backend commands.
// ABOUTME: This is the single file that calls @tauri-apps/api — all hooks go through here.

import { invoke as tauriInvoke, type InvokeArgs } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { PhysicalPosition } from '@tauri-apps/api/dpi';
import type {
  GggProfile,
  RegexFilter,
  CreateRegexFilterInput,
  UpdateRegexFilterInput,
} from '@/types/index';
import type {
  FilterPreset,
  CreateFilterPresetInput,
  UpdateFilterPresetInput,
} from '@/types/index';
import type {
  Strategy,
  CreateStrategyInput,
  UpdateStrategyInput,
} from '@/types/index';
import type { AtlasTreeRecord, CreateAtlasTreeInput, UpdateAtlasTreeInput } from '@/types/index';
import type {
  DecodeResult,
  League,
  TradeStat,
  TradeSearchResult,
  TradeResult,
  ProxySearchResult,
  PriceItem,
  StashTab,
  StashItem,
} from '@/types/index';
import type { TrackerState, TrackingRunDetail, TrackerSettings, TrackerSettingsInput } from '@/types/tracking';
import type {
  ListQuery,
  ListResponse,
  PublishRequest,
  PublishResponse,
  StrategyDetail,
  TagCount,
} from '@/types/community';
import type { AtlasVersion, MapModData } from '@/types/game-data';

/**
 * Rust commands reject with the serialized `Error` enum (e.g. `{ Auth: "..." }`), not an Error.
 * Normalize so every caller can rely on `err.message`.
 */
export function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (typeof err === 'string') return new Error(err);
  if (err !== null && typeof err === 'object') {
    const [message] = Object.values(err);
    if (typeof message === 'string') return new Error(message);
  }
  return new Error(String(err));
}

function invoke<T>(cmd: string, args?: InvokeArgs): Promise<T> {
  return tauriInvoke<T>(cmd, args).catch((err: unknown) => {
    throw toError(err);
  });
}

// --- Regex Filters ---

export function getRegexFilters(): Promise<RegexFilter[]> {
  return invoke<RegexFilter[]>('get_regex_filters');
}

export function getRegexFilter(id: string): Promise<RegexFilter> {
  return invoke<RegexFilter>('get_regex_filter', { id });
}

export function createRegexFilter(input: CreateRegexFilterInput): Promise<RegexFilter> {
  return invoke<RegexFilter>('create_regex_filter', { input });
}

export function updateRegexFilter(id: string, input: UpdateRegexFilterInput): Promise<RegexFilter> {
  return invoke<RegexFilter>('update_regex_filter', { id, input });
}

export function deleteRegexFilter(id: string): Promise<void> {
  return invoke<void>('delete_regex_filter', { id });
}

// --- Filter Presets ---

export function getFilterPresets(): Promise<FilterPreset[]> {
  return invoke<FilterPreset[]>('get_filter_presets');
}

export function getFilterPreset(id: string): Promise<FilterPreset> {
  return invoke<FilterPreset>('get_filter_preset', { id });
}

export function createFilterPreset(input: CreateFilterPresetInput): Promise<FilterPreset> {
  return invoke<FilterPreset>('create_filter_preset', { input });
}

export function updateFilterPreset(id: string, input: UpdateFilterPresetInput): Promise<FilterPreset> {
  return invoke<FilterPreset>('update_filter_preset', { id, input });
}

export function deleteFilterPreset(id: string): Promise<void> {
  return invoke<void>('delete_filter_preset', { id });
}

// --- Strategies ---

export function getStrategies(): Promise<Strategy[]> {
  return invoke<Strategy[]>('get_strategies');
}

export function getStrategy(id: string): Promise<Strategy> {
  return invoke<Strategy>('get_strategy', { id });
}

export function createStrategy(input: CreateStrategyInput): Promise<Strategy> {
  return invoke<Strategy>('create_strategy', { input });
}

export function updateStrategy(id: string, input: UpdateStrategyInput): Promise<Strategy> {
  return invoke<Strategy>('update_strategy', { id, input });
}

export function deleteStrategy(id: string): Promise<void> {
  return invoke<void>('delete_strategy', { id });
}

// --- Atlas Trees ---

export function getAtlasTrees(): Promise<AtlasTreeRecord[]> {
  return invoke<AtlasTreeRecord[]>('get_atlas_trees');
}

export function getAtlasTree(id: string): Promise<AtlasTreeRecord> {
  return invoke<AtlasTreeRecord>('get_atlas_tree', { id });
}

export function createAtlasTree(input: CreateAtlasTreeInput): Promise<AtlasTreeRecord> {
  return invoke<AtlasTreeRecord>('create_atlas_tree', { input });
}

export function updateAtlasTree(id: string, input: UpdateAtlasTreeInput): Promise<AtlasTreeRecord> {
  return invoke<AtlasTreeRecord>('update_atlas_tree', { id, input });
}

export function deleteAtlasTree(id: string): Promise<void> {
  return invoke<void>('delete_atlas_tree', { id });
}

// --- Trade ---

export function getLeagues(): Promise<League[]> {
  return invoke<League[]>('get_leagues');
}

export function getTradeStats(): Promise<TradeStat[]> {
  return invoke<TradeStat[]>('get_trade_stats');
}

export function searchTrade(filterId: string, league: string): Promise<TradeSearchResult> {
  return invoke<TradeSearchResult>('search_trade', { args: { filterIds: [filterId], league } });
}

export function fetchTradeResults(queryId: string, resultIds: string[]): Promise<TradeResult[]> {
  return invoke<TradeResult[]>('fetch_trade_results', { queryId, ids: resultIds });
}

export function proxySearch(query: object, league: string): Promise<ProxySearchResult> {
  return invoke<ProxySearchResult>('proxy_search', { args: { query, league } });
}

// --- Prices ---

export function getPrices(category: string, league: string): Promise<PriceItem[]> {
  return invoke<PriceItem[]>('get_prices', { category, league });
}

/** Fetches all poe.ninja prices for a league. Returns item count. */
export function fetchAllPrices(league: string): Promise<number> {
  return invoke<number>('fetch_all_prices', { league });
}

/** Leagues poe.ninja has prices for, current challenge league first. */
export function getPriceLeagues(): Promise<League[]> {
  return invoke<League[]>('get_price_leagues');
}

export interface PriceLookupEntry {
  chaosValue: number;
  icon: string;
  category: string;
  listingCount: number | null;
}

/** Looks up prices for a list of item names from the ninja price cache. */
export function lookupItemPrices(itemNames: string[], league: string): Promise<Record<string, PriceLookupEntry>> {
  return invoke<Record<string, PriceLookupEntry>>('lookup_item_prices', { itemNames, league });
}

export interface AdvancedLookupItem {
  name: string;
  frameType?: number | null;
  links?: number | null;
  gemLevel?: number | null;
  gemQuality?: number | null;
  corrupted?: boolean | null;
  mapTier?: number | null;
  variant?: string | null;
  baseType?: string | null;
  itemLevel?: number | null;
}

/** Advanced price lookup matching item properties (links, gem level, variant, etc.). */
export function lookupItemPricesAdvanced(items: AdvancedLookupItem[], league: string): Promise<Record<string, PriceLookupEntry>> {
  return invoke<Record<string, PriceLookupEntry>>('lookup_item_prices_advanced', { items, league });
}

/** Returns whether prices are currently being fetched. */
export function isPricesLoading(): Promise<boolean> {
  return invoke<boolean>('is_prices_loading');
}

// --- Sharing ---

export function encodeShareCode(entityType: string, payloadJson: string): Promise<string> {
  return invoke<string>('encode_share_code', { entityType, payloadJson });
}

export function decodeShareCode(code: string): Promise<DecodeResult> {
  return invoke<DecodeResult>('decode_share_code', { code });
}

export function importFromPastebin(url: string): Promise<string> {
  return invoke<string>('import_from_pastebin', { url });
}

export function contentHash(json: string): Promise<string> {
  return invoke<string>('content_hash', { json });
}

// --- Community strategies ---

export function communityList(query: ListQuery): Promise<ListResponse> {
  return invoke<ListResponse>('community_list', { query });
}

export function communityGet(id: string): Promise<StrategyDetail> {
  return invoke<StrategyDetail>('community_get', { id });
}

export function communityTags(league: string | null): Promise<TagCount[]> {
  return invoke<TagCount[]>('community_tags', { league });
}

export function communityPublish(requestBody: PublishRequest): Promise<PublishResponse> {
  return invoke<PublishResponse>('community_publish', { requestBody });
}

export function communityUpdate(id: string, token: string, requestBody: PublishRequest): Promise<StrategyDetail> {
  return invoke<StrategyDetail>('community_update', { id, token, requestBody });
}

export function communityDelete(id: string, token: string): Promise<void> {
  return invoke<void>('community_delete', { id, token });
}

export function communityFavourite(id: string, on: boolean): Promise<{ favouriteCount: number }> {
  return invoke<{ favouriteCount: number }>('community_favourite', { id, on });
}

export function communityReport(id: string, reason: string): Promise<void> {
  return invoke<void>('community_report', { id, reason });
}

export interface ResultSubmission {
  installId: string;
  league: string;
  maps: number;
  hours: number;
  netDivine: number;
}

/** Resolves true when stored, false when this install already shared a result for the strategy today. */
export function communitySubmitResult(id: string, result: ResultSubmission): Promise<boolean> {
  return invoke<boolean>('community_submit_result', { id, ...result });
}

/** Sets the server URL override (null restores the built-in default). Returns the URL now in use. */
export function setCommunityBaseUrl(url: string | null): Promise<string | null> {
  return invoke<string | null>('set_community_base_url', { url });
}

// --- Game data (N.I.K.O. server) ---

/** game-data/map-mods.json: the last map mod data the server sent, and when it last answered. */
export interface CachedMapMods {
  patch: string;
  sha256: string;
  checkedAt: string;
  data: MapModData;
}

/** `data` only with 'updated'; `checkedAt` whenever the server answered. */
export interface MapModRefresh {
  status: 'updated' | 'unchanged' | 'failed';
  data?: MapModData;
  checkedAt?: string;
}

/** The map mod data saved by an earlier refresh; null when none is saved (or the file is corrupt). */
export function mapModDataCached(): Promise<CachedMapMods | null> {
  return invoke<CachedMapMods | null>('map_mod_data_cached');
}

/** Asks the server for newer map mod data and saves it. Server problems resolve to status 'failed'. */
export function refreshMapModData(): Promise<MapModRefresh> {
  return invoke<MapModRefresh>('refresh_map_mod_data');
}

// --- Game data: atlas tree ---

/** One atlas tag's files on disk (Rust `AtlasPatchFiles`): GGG's data.json text and the folder holding its sprites. */
export interface AtlasPatchFiles {
  tag: string;
  dataJson: string;
  assetDir: string;
}

/** The cached atlas tag list, newest first; `refresh` fetches the server's instead and rejects when it does not answer. */
export function atlasVersions(refresh: boolean): Promise<AtlasVersion[]> {
  return invoke<AtlasVersion[]>('atlas_versions', { refresh });
}

/** Makes sure the tag's data.json and sprites are on disk, downloading what is missing; null when the server lacks it. */
export function atlasData(tag: string): Promise<AtlasPatchFiles | null> {
  return invoke<AtlasPatchFiles | null>('atlas_data', { tag });
}

// --- GGG Auth ---

/** Opens the GGG OAuth PKCE flow in the system browser. Resolves when login completes. */
export function startOAuthLogin(): Promise<void> {
  return invoke<void>('start_oauth_login');
}

/** Returns the stored GGG profile if the user is logged in, or null otherwise. */
export function getGggProfile(): Promise<GggProfile | null> {
  return invoke<GggProfile | null>('get_ggg_profile');
}

/** Clears the stored GGG token and profile from the secure store. */
export function logoutGgg(): Promise<void> {
  return invoke<void>('logout_ggg');
}

/** Attempts a silent token refresh using the stored refresh token. */
export function refreshGggToken(): Promise<GggProfile> {
  return invoke<GggProfile>('refresh_ggg_token');
}

// --- Stash ---

/** Returns the list of stash tabs for the given league. Requires GGG auth. */
export function getStashTabs(league: string): Promise<StashTab[]> {
  return invoke<StashTab[]>('get_stash_tabs', { league });
}

/** Returns the items inside a specific stash tab. Requires GGG auth. */
export function getStashTabContents(league: string, stashId: string): Promise<StashItem[]> {
  return invoke<StashItem[]>('get_stash_tab_contents', { league, stashId });
}

// --- Snapshots ---

import type {
  SnapshotConfig,
  CreateSnapshotConfigInput,
  UpdateSnapshotConfigInput,
  StashSnapshot,
  SnapshotSummary,
  RecentSnapshot,
  TakeSnapshotInput,
} from '@/types/snapshots';

export function getSnapshotConfigs(): Promise<SnapshotConfig[]> {
  return invoke<SnapshotConfig[]>('get_snapshot_configs');
}

export function createSnapshotConfig(input: CreateSnapshotConfigInput): Promise<SnapshotConfig> {
  return invoke<SnapshotConfig>('create_snapshot_config', { input });
}

export function updateSnapshotConfig(id: string, input: UpdateSnapshotConfigInput): Promise<SnapshotConfig> {
  return invoke<SnapshotConfig>('update_snapshot_config', { id, input });
}

export function deleteSnapshotConfig(id: string): Promise<void> {
  return invoke<void>('delete_snapshot_config', { id });
}

export function takeSnapshot(input: TakeSnapshotInput): Promise<StashSnapshot> {
  return invoke<StashSnapshot>('take_snapshot', { input });
}

export function getSnapshots(configId: string): Promise<SnapshotSummary[]> {
  return invoke<SnapshotSummary[]>('get_snapshots', { configId });
}

export function getSnapshotDetail(snapshotId: string): Promise<StashSnapshot> {
  return invoke<StashSnapshot>('get_snapshot_detail', { snapshotId });
}

export function getRecentSnapshots(): Promise<RecentSnapshot[]> {
  return invoke<RecentSnapshot[]>('get_recent_snapshots');
}

export function deleteSnapshot(snapshotId: string): Promise<void> {
  return invoke<void>('delete_snapshot', { snapshotId });
}

// --- Map Tracking ---

export function getTrackerState(): Promise<TrackerState> {
  return invoke<TrackerState>('get_tracker_state');
}

export function startTrackingRun(strategyId: string, configId: string): Promise<void> {
  return invoke<void>('start_tracking_run', { input: { strategyId, configId } });
}

export function switchTrackingStrategy(strategyId: string): Promise<void> {
  return invoke<void>('switch_tracking_strategy', { strategyId });
}

export function stopTrackingRun(skipSnapshot: boolean): Promise<void> {
  return invoke<void>('stop_tracking_run', { skipSnapshot });
}

export function dismissTrackingSuggestion(): Promise<void> {
  return invoke<void>('dismiss_tracking_suggestion');
}

export function getTrackingHistory(): Promise<TrackingRunDetail[]> {
  return invoke<TrackingRunDetail[]>('get_tracking_history');
}

export function reassignMapRuns(mapIds: string[], strategyId: string | null): Promise<void> {
  return invoke<void>('reassign_map_runs', { mapIds, strategyId });
}

export function deleteTrackingRun(id: string): Promise<void> {
  return invoke<void>('delete_tracking_run', { id });
}

export function getTrackerSettings(): Promise<TrackerSettings> {
  return invoke<TrackerSettings>('get_tracker_settings');
}

export function setTrackerSettings(input: TrackerSettingsInput): Promise<void> {
  return invoke<void>('set_tracker_settings', { input });
}

/** Subscribes to tracker state pushed by the backend after every change. */
export function onTrackerState(cb: (state: TrackerState) => void): Promise<UnlistenFn> {
  return listen<TrackerState>('tracker-state', (event) => cb(event.payload));
}

/** Moves the current window to the saved position, then saves it whenever the window moves. */
export async function persistOverlayPosition(
  load: () => { x: number; y: number } | null,
  save: (pos: { x: number; y: number }) => void,
): Promise<UnlistenFn> {
  const win = getCurrentWindow();
  const pos = load();
  if (pos) await win.setPosition(new PhysicalPosition(pos.x, pos.y));
  return win.onMoved(({ payload }) => save({ x: payload.x, y: payload.y }));
}
