// ABOUTME: Typed wrappers around Tauri IPC invoke calls for all backend commands.
// ABOUTME: This is the single file that calls @tauri-apps/api — all hooks go through here.

import { invoke } from '@tauri-apps/api/core';
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
  return invoke<TradeSearchResult>('search_trade', { filterId, league });
}

export function fetchTradeResults(queryId: string, resultIds: string[]): Promise<TradeResult[]> {
  return invoke<TradeResult[]>('fetch_trade_results', { queryId, resultIds });
}

export function proxySearch(query: object, league: string): Promise<ProxySearchResult> {
  return invoke<ProxySearchResult>('proxy_search', { args: { query, league } });
}

// --- Prices ---

export function getPrices(category: string, league: string): Promise<PriceItem[]> {
  return invoke<PriceItem[]>('get_prices', { category, league });
}

/** Fetches the entire poe.watch compact dataset for a league. Returns item count. */
export function fetchAllPrices(league: string): Promise<number> {
  return invoke<number>('fetch_all_prices', { league });
}

export interface PriceLookupEntry {
  mean: number;
  lowConfidence: boolean;
}

/** Looks up prices for a list of item names from the compact price cache. */
export function lookupItemPrices(itemNames: string[], league: string): Promise<Record<string, PriceLookupEntry>> {
  return invoke<Record<string, PriceLookupEntry>>('lookup_item_prices', { itemNames, league });
}

/** Returns whether compact prices are currently being fetched. */
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
export function refreshGggToken(): Promise<void> {
  return invoke<void>('refresh_ggg_token');
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
