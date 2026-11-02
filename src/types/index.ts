// ABOUTME: Shared TypeScript type definitions for the N.I.K.O. frontend.
// ABOUTME: Covers IPC data shapes mirroring Rust structs and common response shapes.

// --- Auth ---
// Mirrors the GggProfile struct returned by the get_ggg_profile Tauri command.

export interface GggProfile {
  accountName: string;
}

// UserProfile is the frontend representation of an authenticated user.
// Derived from GggProfile after a successful OAuth login.
export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
}

// --- Common ---

export interface ApiResponse<TData> {
  data: TData;
  timestamp: string;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error: string;
}

// --- Regex Filters ---
// Mirrors src-tauri/src/commands/regex_filters.rs RegexFilter (serde rename_all = "camelCase")

export interface RegexFilter {
  id: string;
  name: string;
  description: string | null;
  category: string;
  pattern: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRegexFilterInput {
  name: string;
  description?: string;
  category: string;
  pattern: string;
  isActive?: boolean;
}

export interface UpdateRegexFilterInput {
  name?: string;
  description?: string;
  category?: string;
  pattern?: string;
  isActive?: boolean;
}

// --- Filter Presets ---
// Mirrors src-tauri/src/commands/filter_presets.rs FilterPreset
// config is stored as a JSON string in SQLite; parse/stringify at the hook layer.

export interface FilterPreset {
  id: string;
  name: string;
  config: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFilterPresetInput {
  name: string;
  config: string;
}

export interface UpdateFilterPresetInput {
  name?: string;
  config?: string;
}

// --- Strategies ---
// Mirrors src-tauri/src/commands/strategies.rs Strategy

export interface Strategy {
  id: string;
  name: string;
  config: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStrategyInput {
  name: string;
  config: string;
}

export interface UpdateStrategyInput {
  name?: string;
  config?: string;
}

// --- Atlas Trees ---
// Named AtlasTreeRecord to avoid collision with AtlasTree in atlas-tree.ts.
// Mirrors src-tauri/src/commands/atlas_trees.rs AtlasTree

export interface AtlasTreeRecord {
  id: string;
  name: string;
  config: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAtlasTreeInput {
  name: string;
  config: string;
}

export interface UpdateAtlasTreeInput {
  name?: string;
  config?: string;
}

// --- Sharing ---
// Mirrors src-tauri/src/commands/sharing.rs DecodeResult

export interface DecodeResult {
  entityType: string;
  payloadJson: string;
}

// --- Trade & Price IPC types ---
// All fields match Rust serde(rename_all = "camelCase") structs in commands/trade.rs and commands/prices.rs.

export interface League {
  id: string;
  text: string;
}

export interface TradeStat {
  id: string;
  text: string;
  type: string;
}

export interface TradeSearchResult {
  /** GGG trade query ID, used to fetch the actual result items. */
  queryId: string;
  /** Up to 10 result IDs returned by the initial search. */
  resultIds: string[];
  /** Total number of matching listings on the trade site. */
  total: number;
}

export interface TradeResultItem {
  name: string;
  typeLine: string;
  corrupted: boolean | null;
  note: string | null;
  ilvl: number;
  identified: boolean;
}

export interface TradeResultListing {
  /** ISO-8601 timestamp from the trade site. */
  indexed: string;
  price: {
    type: string;
    amount: number;
    currency: string;
  };
  account: {
    name: string;
    lastCharacterName: string;
    online: { league: string | null } | null;
  };
  whisper: string;
}

export interface TradeResult {
  id: string;
  item: TradeResultItem;
  listing: TradeResultListing;
}

// Mirrors src-tauri/src/commands/trade.rs ProxySearchResult
export interface ProxySearchResult {
  id: string;
  total: number;
  /** Direct pathofexile.com trade URL for the search. */
  url: string;
}

/** One price entry from poe.ninja, mirroring NinjaPrice in state.rs. */
export interface PriceItem {
  name: string;
  chaosValue: number;
  icon: string;
  category: string;
  frameType: number | null;
  links: number | null;
  variant: string | null;
  gemLevel: number | null;
  gemQuality: number | null;
  corrupted: boolean | null;
  mapTier: number | null;
  baseType: string | null;
  itemLevel: number | null;
  listingCount: number | null;
  detailsId: string | null;
}

// --- Stash ---
// Mirrors StashTab and StashItem in src-tauri/src/commands/stash.rs.

export interface StashColor {
  r: number;
  g: number;
  b: number;
}

export interface StashTab {
  id: string;
  name: string;
  stashType: string;
  index: number;
  colour: StashColor | null;
  children: StashTab[];
}

export interface StashItem {
  id: string;
  name: string;
  typeLine: string;
  icon: string;
  stackSize: number | null;
  maxStackSize: number | null;
  /** Player-set price tag, e.g. "~price 1 chaos". */
  note: string | null;
  x: number | null;
  y: number | null;
  identified: boolean | null;
  corrupted: boolean | null;
  ilvl: number | null;
  /** Item rarity: 0=Normal, 1=Magic, 2=Rare, 3=Unique, 4=Gem, 5=Currency, 6=Divination, 7=Quest, 8=Prophecy, 9=Foil */
  frameType: number | null;
}
