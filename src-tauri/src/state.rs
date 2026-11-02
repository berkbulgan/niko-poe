// ABOUTME: AppState holds shared runtime resources injected into all Tauri commands.
// ABOUTME: Holds database pool, HTTP caches, and rate limiter for trade API calls.

use std::collections::HashMap;
use std::sync::Arc;
use sqlx::SqlitePool;
use tokio::sync::Mutex;

pub struct RateLimiter {
    /// Unix timestamp in ms of the last outbound PoE API request.
    pub last_request_ms: u64,
    /// Minimum gap between requests (default: 1500ms). Adjusted by header-based backoff.
    pub min_gap_ms: u64,
}

impl RateLimiter {
    pub fn new() -> Self {
        Self {
            last_request_ms: 0,
            min_gap_ms: 1500,
        }
    }
}

/// A normalized price entry stored in the ninja price cache.
/// Supports advanced matching via optional fields (links, gem_level, variant, etc.).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NinjaPrice {
    pub name: String,
    pub chaos_value: f64,
    pub icon: String,
    pub category: String,
    /// Item frame type (0=Normal, 1=Magic, 2=Rare, 3=Unique, 4=Gem, 5=Currency, 6=Div, 9=Relic)
    pub frame_type: Option<i32>,
    /// Number of links (for 5L/6L unique weapons/armour)
    pub links: Option<i32>,
    /// Variant string from poe.ninja (e.g. "Shaper", "Elder")
    pub variant: Option<String>,
    /// Gem level (for skill gems)
    pub gem_level: Option<i32>,
    /// Gem quality (for skill gems)
    pub gem_quality: Option<i32>,
    /// Whether the item is corrupted
    pub corrupted: Option<bool>,
    /// Map tier
    pub map_tier: Option<i32>,
    /// Base type (for maps, beasts, etc.)
    pub base_type: Option<String>,
    /// Item level (for coffins, allflame embers, etc.)
    pub item_level: Option<i32>,
    /// Listing count — used as confidence indicator
    pub listing_count: Option<i32>,
    /// Details ID from poe.ninja (used for URL generation)
    pub details_id: Option<String>,
}

/// Stores all poe.ninja prices fetched on demand when a league is selected.
pub struct NinjaPriceCache {
    /// All price entries from poe.ninja, keyed by lowercase name for fast lookup.
    /// Multiple entries per name are possible (e.g. different gem levels).
    pub prices: HashMap<String, Vec<NinjaPrice>>,
    /// Which league these prices belong to.
    pub league: Option<String>,
    pub fetched_at: Option<std::time::Instant>,
    pub ttl_secs: u64,
    /// League of the most recent in-flight fetch; older fetches for other leagues are discarded.
    pub loading_league: Option<String>,
}

impl NinjaPriceCache {
    pub fn new() -> Self {
        Self {
            prices: HashMap::new(),
            league: None,
            fetched_at: None,
            ttl_secs: 3600,
            loading_league: None,
        }
    }
}

pub struct LeagueCache {
    pub leagues: Vec<League>,
    pub fetched_at: Option<std::time::Instant>,
    /// Cache TTL in seconds (default: 86400 = 24 hours).
    pub ttl_secs: u64,
}

impl LeagueCache {
    pub fn new() -> Self {
        Self {
            leagues: Vec::new(),
            fetched_at: None,
            ttl_secs: 86400,
        }
    }
}

pub struct StatCache {
    pub stats: Vec<TradeStat>,
    pub fetched_at: Option<std::time::Instant>,
    /// Cache TTL in seconds (default: 3600 = 1 hour).
    pub ttl_secs: u64,
}

impl StatCache {
    pub fn new() -> Self {
        Self {
            stats: Vec::new(),
            fetched_at: None,
            ttl_secs: 3600,
        }
    }
}

/// PoE league entry returned by the GGG leagues endpoint.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct League {
    pub id: String,
    pub text: String,
    pub realm: Option<String>,
}

/// A single trade stat definition (mod) from the GGG stats endpoint.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TradeStat {
    pub id: String,
    pub text: String,
    #[serde(rename = "type")]
    pub stat_type: String,
}

/// GGG OAuth2 token state stored in memory and persisted to the secure store.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct GggTokenState {
    pub access_token: String,
    pub refresh_token: Option<String>,
    /// Unix timestamp (seconds) when the access token expires.
    pub expires_at: i64,
    pub account_name: String,
}

pub struct AppState {
    pub pool: SqlitePool,
    pub http_client: reqwest::Client,
    pub rate_limiter: Arc<Mutex<RateLimiter>>,
    pub ninja_prices: Arc<Mutex<NinjaPriceCache>>,
    pub league_cache: Arc<Mutex<LeagueCache>>,
    pub stat_cache: Arc<Mutex<StatCache>>,
    pub ggg_token: Arc<Mutex<Option<GggTokenState>>>,
    /// Community strategies server URL; `None` when neither a build default nor an override is set.
    pub community_base_url: Arc<Mutex<Option<String>>>,
}
