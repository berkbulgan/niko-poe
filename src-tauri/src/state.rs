// ABOUTME: AppState holds shared runtime resources injected into all Tauri commands.
// ABOUTME: Holds database pool, HTTP caches, and rate limiter for trade API calls.

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

pub struct PriceCacheEntry {
    pub items: Vec<PoeWatchItem>,
    pub fetched_at: std::time::Instant,
}

pub struct PriceCache {
    pub entries: std::collections::HashMap<String, PriceCacheEntry>,
    /// Cache TTL in seconds (default: 900 = 15 minutes).
    pub ttl_secs: u64,
}

impl PriceCache {
    pub fn new() -> Self {
        Self {
            entries: std::collections::HashMap::new(),
            ttl_secs: 900,
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

/// A single item price record from poe.watch.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PoeWatchItem {
    pub id: i64,
    pub name: String,
    pub category: String,
    pub mean: f64,
    pub daily: f64,
    pub change: f64,
    pub low_confidence: bool,
    pub icon: String,
}

/// Compact price entry from poe.watch /compact endpoint.
/// Only has id and mean — name resolved via the full item list.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CompactPriceEntry {
    pub id: i64,
    pub mean: f64,
}

/// Stores the full compact price dataset fetched at app startup.
pub struct CompactPriceCache {
    /// Map of item name (lowercase) → mean chaos price.
    pub prices: std::collections::HashMap<String, f64>,
    pub fetched_at: Option<std::time::Instant>,
    pub ttl_secs: u64,
    pub is_loading: bool,
}

impl CompactPriceCache {
    pub fn new() -> Self {
        Self {
            prices: std::collections::HashMap::new(),
            fetched_at: None,
            ttl_secs: 900,
            is_loading: false,
        }
    }
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
    pub price_cache: Arc<Mutex<PriceCache>>,
    pub compact_prices: Arc<Mutex<CompactPriceCache>>,
    pub league_cache: Arc<Mutex<LeagueCache>>,
    pub stat_cache: Arc<Mutex<StatCache>>,
    pub ggg_token: Arc<Mutex<Option<GggTokenState>>>,
}
