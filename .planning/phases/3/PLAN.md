# Phase 3: Trade API — Execution Plan

---
phase: 3-trade-api
plan: 01-05
type: execute
wave: 1-3
depends_on: [phase-2-sqlite-data-layer]
files_modified:
  - src-tauri/src/commands/trade.rs
  - src-tauri/src/commands/prices.rs
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/state.rs
  - src-tauri/src/lib.rs
  - src-tauri/Cargo.toml
  - src/lib/ipc.ts
  - src/lib/hooks/use-trade-stats.ts
  - src/lib/hooks/use-prices.ts
  - src/lib/hooks/use-leagues.ts
  - src/lib/league-context.tsx
autonomous: true
requirements: [TRADE-01, TRADE-02, TRADE-03, TRADE-04, TRADE-05]

must_haves:
  truths:
    - "User can execute a trade search from the app; results arrive without a Next.js proxy"
    - "Rate limiting is enforced in Rust; the frontend cannot bypass it"
    - "poe.watch price data is served from a Rust cache; repeated reads within 15 min do not re-fetch"
    - "Trade stat definitions (mods, base types) are served from Rust cache; no per-call GGG hit"
    - "League list is fetched and cached; user can read the active league from AppState"
  artifacts:
    - path: "src-tauri/src/commands/trade.rs"
      provides: "search_trade, fetch_trade_results, get_leagues, get_trade_stats, proxy_search commands"
      exports: ["search_trade", "fetch_trade_results", "get_leagues", "get_trade_stats", "proxy_search"]
    - path: "src-tauri/src/commands/prices.rs"
      provides: "get_prices command with TTL cache"
      exports: ["get_prices"]
    - path: "src-tauri/src/state.rs"
      provides: "AppState with rate_limiter, price_cache, league_cache, stat_cache fields"
      contains: "RateLimiter, PriceCache, LeagueCache"
    - path: "src/lib/ipc.ts"
      provides: "Typed invoke wrappers for all trade and price commands"
      exports: ["ipc.searchTrade", "ipc.fetchTradeResults", "ipc.getLeagues", "ipc.getTradeStats", "ipc.getPrices", "ipc.proxySearch"]
    - path: "src/lib/hooks/use-trade-stats.ts"
      provides: "TanStack Query hook using invoke instead of fetch"
    - path: "src/lib/hooks/use-prices.ts"
      provides: "TanStack Query hook using invoke instead of fetch"
  key_links:
    - from: "src/lib/hooks/use-trade-stats.ts"
      to: "src-tauri/src/commands/trade.rs::get_trade_stats"
      via: "ipc.getTradeStats() → invoke('get_trade_stats')"
    - from: "src/lib/hooks/use-prices.ts"
      to: "src-tauri/src/commands/prices.rs::get_prices"
      via: "ipc.getPrices(category, league) → invoke('get_prices', { category, league })"
    - from: "src-tauri/src/commands/trade.rs"
      to: "AppState.rate_limiter"
      via: "rate_limiter.acquire().await before every outbound reqwest call"
    - from: "src-tauri/src/commands/trade.rs"
      to: "https://www.pathofexile.com/api/trade"
      via: "reqwest client with User-Agent header"
    - from: "src-tauri/src/commands/prices.rs"
      to: "https://api.poe.watch/get"
      via: "reqwest client, result stored in AppState.price_cache keyed by (league, category)"
---

## Context: What Exists Now

All trade logic currently lives in Next.js API routes and server-side TypeScript. The migration replaces these four pieces:

| Current file | Rust destination | Notes |
|---|---|---|
| `src/lib/server/poe-api.ts` | `commands/trade.rs` | `rateLimitedFetch`, `searchTrade`, `fetchResults`, `buildQuery`, `fetchLeagues` |
| `src/lib/server/poe-static-data.ts` | `commands/trade.rs` (stat cache) | `getAllStats`, `searchStats`, `findStatId` — all logic ports to Rust |
| `src/lib/server/price-cache.ts` | `commands/prices.rs` | `fetchPrices`, `getPrice`, virtual categories (chisel, astrolabe) |
| `src/lib/server/league-cache.ts` | `AppState.league_cache` | TTL + fallback logic |
| `src/app/api/trade/search/route.ts` | `commands/trade.rs::search_trade` | filter-ID-based search, stat resolution |
| `src/app/api/trade/proxy-search/route.ts` | `commands/trade.rs::proxy_search` | raw query passthrough |
| `src/app/api/trade/results/[queryId]/route.ts` | `commands/trade.rs::fetch_trade_results` | |
| `src/app/api/trade/leagues/route.ts` | `commands/trade.rs::get_leagues` | |
| `src/app/api/trade/stats/route.ts` | `commands/trade.rs::get_trade_stats` | |
| `src/lib/hooks/use-trade-stats.ts` | ADAPT — swap `api.get` for `ipc.getTradeStats()` | |
| `src/lib/hooks/use-prices.ts` | ADAPT — swap `api.get` for `ipc.getPrices()` | |

---

## Pitfall Guard-Rails (from PITFALLS.md)

- **Pitfall 9** (rate limiter rethink): The current 1500ms hardcoded delay was for a shared server. Desktop is one user / one IP. Port the delay as a starting point but wire it to respect `X-Rate-Limit-*` response headers from GGG. Do NOT remove the limiter entirely — GGG bans IPs.
- **Pitfall 7** (CSP): All PoE API and poe.watch calls happen in Rust via reqwest — they bypass the WebView CSP entirely. No `connect-src` changes needed for trade calls.
- **Anti-pattern 1**: React must never call `fetch('https://www.pathofexile.com/...')` directly. All outbound HTTP lives in Rust commands.

---

## Wave Structure

```
Wave 1 (parallel):
  Plan 01 — AppState trade fields + Cargo deps
  Plan 02 — Rate limiter implementation in Rust

Wave 2 (parallel, depend on Wave 1):
  Plan 03 — commands/trade.rs (search, fetch, leagues, stats)
  Plan 04 — commands/prices.rs (poe.watch cache)

Wave 3 (sequential, depends on Wave 2):
  Plan 05 — Frontend adaptation (ipc.ts wrappers + hook migration)
```

---

## Plan 01 — AppState Trade Fields + Cargo Dependencies

**Wave:** 1
**Depends on:** Phase 2 (AppState already exists with `db` field)
**Requirements:** TRADE-01, TRADE-02, TRADE-03, TRADE-04, TRADE-05

### Task 1: Add reqwest, tokio, and cache dependencies to Cargo.toml

**Files:** `src-tauri/Cargo.toml`

**Action:**
Add the following to `[dependencies]` in `src-tauri/Cargo.toml`:

```toml
reqwest = { version = "0.12", features = ["json", "rustls-tls"], default-features = false }
tokio = { version = "1", features = ["sync", "time"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "1"
```

Rationale: `rustls-tls` avoids linking OpenSSL on Windows (common pain point). `tokio::sync::Mutex` is needed for async-safe AppState fields. `thiserror` for the unified error type from ARCHITECTURE.md.

Do NOT add `openssl` or `native-tls` features — they cause Windows build failures on machines without Visual C++ build tools for OpenSSL.

**Verify:** `cargo check --manifest-path src-tauri/Cargo.toml` exits 0.

**Done:** `Cargo.toml` contains reqwest 0.12 with rustls-tls, tokio 1 with sync+time, serde with derive, serde_json, thiserror. `cargo check` passes.

---

### Task 2: Extend AppState with trade-specific fields

**Files:** `src-tauri/src/state.rs`

**Action:**
Read the current `state.rs` (it will have a `db` field from Phase 2). Extend `AppState` with these additional fields:

```rust
// ABOUTME: Application state shared across all Tauri commands.
// ABOUTME: Holds database pool, HTTP caches, and rate limiter for trade API calls.

use std::sync::Arc;
use tokio::sync::Mutex;

pub struct RateLimiter {
    pub last_request_ms: u64,   // Unix timestamp of last outbound PoE API request
    pub min_gap_ms: u64,        // Minimum gap between requests (default: 1500)
}

impl RateLimiter {
    pub fn new() -> Self {
        Self { last_request_ms: 0, min_gap_ms: 1500 }
    }
}

pub struct PriceCacheEntry {
    pub items: Vec<PoeWatchItem>,
    pub fetched_at: std::time::Instant,
}

pub struct PriceCache {
    pub entries: std::collections::HashMap<String, PriceCacheEntry>,
    pub ttl_secs: u64,  // 900 (15 minutes)
}

impl PriceCache {
    pub fn new() -> Self {
        Self { entries: std::collections::HashMap::new(), ttl_secs: 900 }
    }
}

pub struct LeagueCache {
    pub leagues: Vec<League>,
    pub fetched_at: Option<std::time::Instant>,
    pub ttl_secs: u64,  // 86400 (24 hours)
}

impl LeagueCache {
    pub fn new() -> Self {
        Self { leagues: Vec::new(), fetched_at: None, ttl_secs: 86400 }
    }
}

pub struct StatCache {
    pub stats: Vec<TradeStat>,
    pub fetched_at: Option<std::time::Instant>,
    pub ttl_secs: u64,  // 3600 (1 hour)
}

impl StatCache {
    pub fn new() -> Self {
        Self { stats: Vec::new(), fetched_at: None, ttl_secs: 3600 }
    }
}

// Types used by caches (define here, re-export from commands modules)
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct League {
    pub id: String,
    pub text: String,
    pub realm: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TradeStat {
    pub id: String,
    pub text: String,
    #[serde(rename = "type")]
    pub stat_type: String,
}

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

pub struct AppState {
    pub db: /* keep existing Phase 2 DbPool type */,
    pub rate_limiter: Arc<Mutex<RateLimiter>>,
    pub price_cache: Arc<Mutex<PriceCache>>,
    pub league_cache: Arc<Mutex<LeagueCache>>,
    pub stat_cache: Arc<Mutex<StatCache>>,
}
```

In `lib.rs`, initialize new fields alongside the existing `db` initialization:
```rust
app.manage(AppState {
    db: /* existing */,
    rate_limiter: Arc::new(Mutex::new(RateLimiter::new())),
    price_cache: Arc::new(Mutex::new(PriceCache::new())),
    league_cache: Arc::new(Mutex::new(LeagueCache::new())),
    stat_cache: Arc::new(Mutex::new(StatCache::new())),
});
```

**Verify:** `cargo check --manifest-path src-tauri/Cargo.toml` exits 0.

**Done:** `AppState` has `rate_limiter`, `price_cache`, `league_cache`, `stat_cache` fields. All are `Arc<Mutex<T>>`. `cargo check` passes.

---

## Plan 02 — Rate Limiter Implementation

**Wave:** 1 (parallel with Plan 01)
**Depends on:** Plan 01 (RateLimiter struct in state.rs)
**Requirements:** TRADE-02

### Task 1: Implement rate limiter logic as a shared utility

**Files:** `src-tauri/src/commands/trade.rs` (initial section — rate limiter helpers)

**Action:**
The rate limiter must be called before every outbound request to `pathofexile.com`. Per PITFALLS.md Pitfall 9, the 1500ms hardcoded delay works for a starting point but the implementation must also respect `X-Rate-Limit-*` response headers.

Implement these two functions in `commands/trade.rs` (they will be used by all outbound GGG calls):

```rust
/// Enforces minimum gap between PoE API requests. Call before every outbound reqwest call.
/// Reads `last_request_ms` from the shared RateLimiter, sleeps if needed, then updates it.
async fn rate_limit_wait(limiter: &tokio::sync::Mutex<crate::state::RateLimiter>) {
    let mut guard = limiter.lock().await;
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    if guard.last_request_ms > 0 {
        let elapsed = now_ms.saturating_sub(guard.last_request_ms);
        if elapsed < guard.min_gap_ms {
            let sleep_ms = guard.min_gap_ms - elapsed;
            drop(guard); // release lock before sleeping
            tokio::time::sleep(tokio::time::Duration::from_millis(sleep_ms)).await;
            let mut guard = limiter.lock().await;
            guard.last_request_ms = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64;
            return;
        }
    }
    guard.last_request_ms = now_ms;
}

/// After a GGG API response, inspect X-Rate-Limit-* headers and tighten min_gap_ms if needed.
/// GGG headers: X-Rate-Limit-Ip: "5:4:240" means 5 hits per 4 seconds per window (240s ban).
/// If we're at 80%+ of the limit, increase min_gap_ms to back off gracefully.
fn update_rate_limit_from_headers(
    limiter: &mut crate::state::RateLimiter,
    headers: &reqwest::header::HeaderMap,
) {
    // X-Rate-Limit-Ip-State: "1:4:0" means current_hits:window_secs:currently_banned_secs
    if let Some(state_val) = headers.get("X-Rate-Limit-Ip-State").and_then(|v| v.to_str().ok()) {
        if let Some(limit_val) = headers.get("X-Rate-Limit-Ip").and_then(|v| v.to_str().ok()) {
            // Parse "current:window:ban" and "max:window:ban"
            let current: u64 = state_val.split(':').next().and_then(|s| s.parse().ok()).unwrap_or(0);
            let max: u64 = limit_val.split(':').next().and_then(|s| s.parse().ok()).unwrap_or(5);
            let window_secs: u64 = state_val.split(':').nth(1).and_then(|s| s.parse().ok()).unwrap_or(4);

            if max > 0 && current > 0 {
                let utilization = current as f64 / max as f64;
                if utilization >= 0.8 {
                    // Back off: increase min gap proportionally
                    let new_gap = (window_secs * 1000 / max) * 2;
                    limiter.min_gap_ms = limiter.min_gap_ms.max(new_gap);
                } else if utilization < 0.4 && limiter.min_gap_ms > 1500 {
                    // Recover: gradually reduce back toward 1500ms
                    limiter.min_gap_ms = (limiter.min_gap_ms - 100).max(1500);
                }
            }
        }
    }
}
```

**Verify:** `cargo check --manifest-path src-tauri/Cargo.toml` exits 0 after adding these functions.

**Done:** `rate_limit_wait` and `update_rate_limit_from_headers` compile. Rate limiter acquires the lock, sleeps the delta if needed, updates `last_request_ms`. Header-based backoff logic parses `X-Rate-Limit-Ip` and `X-Rate-Limit-Ip-State`.

---

## Plan 03 — commands/trade.rs: PoE Trade API Commands

**Wave:** 2
**Depends on:** Plan 01 (AppState fields), Plan 02 (rate limiter helpers)
**Requirements:** TRADE-01, TRADE-02, TRADE-04, TRADE-05

### Task 1: Implement Rust trade data types and stat cache helpers

**Files:** `src-tauri/src/commands/trade.rs`

**Action:**
This plan implements the full `commands/trade.rs` module. Start with the data types and stat cache helpers.

**Rust types that mirror the TypeScript interfaces in `poe-api.ts` and `poe-static-data.ts`:**

```rust
// ABOUTME: PoE Trade API commands — search, fetch results, leagues, and stat definitions.
// ABOUTME: All outbound HTTP goes through the shared RateLimiter in AppState.

use serde::{Deserialize, Serialize};
use tauri::State;
use crate::state::{AppState, League, TradeStat};
use crate::error::AppError;

const BASE_URL: &str = "https://www.pathofexile.com/api/trade";
const USER_AGENT: &str = "CADIRO-TradeHelper/0.1.0";

// ---- Request/Response types ----

#[derive(Debug, Serialize, Deserialize)]
pub struct TradeStatFilter {
    pub id: String,
    pub disabled: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TradeStatGroup {
    #[serde(rename = "type")]
    pub group_type: String,
    pub filters: Vec<TradeStatFilter>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TradeQueryBody {
    pub status: serde_json::Value,       // { "option": "online" }
    pub stats: Vec<TradeStatGroup>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filters: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TradeQuery {
    pub query: TradeQueryBody,
    pub sort: serde_json::Value,          // { "price": "asc" }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TradeSearchResponse {
    pub id: String,
    pub total: u32,
    pub result: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TradeItem {
    pub id: String,
    pub listing: serde_json::Value,
    pub item: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
struct TradeFetchResponse {
    pub result: Vec<TradeItem>,
}

// ---- Args types (received from frontend via IPC) ----

#[derive(Debug, Deserialize)]
pub struct SearchTradeArgs {
    pub filter_ids: Vec<String>,      // SQLite filter IDs to resolve
    pub league: String,
    pub min_price: Option<f64>,
    pub max_price: Option<f64>,
    pub currency: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SearchTradeResult {
    pub query_id: Option<String>,
    pub total: u32,
    pub results: Vec<TradeItem>,
    pub filters_used: Vec<FilterMatch>,
}

#[derive(Debug, Serialize)]
pub struct FilterMatch {
    pub filter_name: String,
    pub pattern: String,
    pub matched_stat_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ProxySearchArgs {
    pub league: String,
    pub query: TradeQuery,
}

#[derive(Debug, Serialize)]
pub struct ProxySearchResult {
    pub id: String,
    pub total: u32,
    pub url: String,
}
```

**Stat cache helper — mirrors `findStatId` from `poe-static-data.ts`:**

```rust
/// Resolves a regex pattern string to a PoE stat ID.
/// Logic mirrors src/lib/server/poe-static-data.ts::findStatId.
fn find_stat_id(pattern: &str, stats: &[TradeStat]) -> Option<String> {
    // Replace # placeholders with sample number for regex matching
    let test_pattern = pattern.replace('#', "10");

    if let Ok(re) = regex::Regex::new(&format!("(?i){}", test_pattern)) {
        for stat in stats {
            let sample = stat.text.replace('#', "10");
            if re.is_match(&sample) {
                return Some(stat.id.clone());
            }
        }
    }

    // Fallback: simplified text match (strip regex metacharacters)
    let simplified: String = test_pattern
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace())
        .collect::<String>()
        .trim()
        .to_lowercase();

    if simplified.len() > 3 {
        return stats.iter()
            .find(|s| s.text.to_lowercase().contains(&simplified))
            .map(|s| s.id.clone());
    }

    None
}
```

Add `regex = "1"` to `Cargo.toml` dependencies (the `regex` crate — already ubiquitous in Rust, no feature flags needed for this usage).

**Verify:** `cargo check` exits 0 with these types and helpers defined.

**Done:** All types compile. `find_stat_id` handles both regex-based and simplified text matching, mirroring the TypeScript original.

---

### Task 2: Implement the five Tauri commands

**Files:** `src-tauri/src/commands/trade.rs` (continued), `src-tauri/src/commands/mod.rs`, `src-tauri/src/lib.rs`

**Action:**
Implement these five `#[tauri::command]` functions. Each one maps directly from a Next.js API route.

**`get_leagues` — replaces `GET /api/trade/leagues`:**
```rust
#[tauri::command]
pub async fn get_leagues(state: State<'_, AppState>) -> Result<Vec<League>, AppError> {
    {
        let cache = state.league_cache.lock().await;
        if let Some(fetched_at) = cache.fetched_at {
            if fetched_at.elapsed().as_secs() < cache.ttl_secs && !cache.leagues.is_empty() {
                return Ok(cache.leagues.clone());
            }
        }
    }

    // Cache miss — fetch from GGG
    rate_limit_wait(&state.rate_limiter).await;

    let client = reqwest::Client::new();
    let url = "https://www.pathofexile.com/api/data/leagues";
    let resp = client.get(url)
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| AppError::Network(e.to_string()))?;

    {
        let mut limiter = state.rate_limiter.lock().await;
        update_rate_limit_from_headers(&mut limiter, resp.headers());
    }

    if !resp.status().is_success() {
        // Fallback to cached (possibly stale) or hardcoded
        let cache = state.league_cache.lock().await;
        if !cache.leagues.is_empty() {
            return Ok(cache.leagues.clone());
        }
        return Ok(vec![
            League { id: "Standard".into(), text: "Standard".into(), realm: None },
            League { id: "Settlers".into(), text: "Settlers".into(), realm: None },
        ]);
    }

    // Parse: GGG response is { result: [{ id, text, realm }] }
    let body: serde_json::Value = resp.json().await.map_err(|e| AppError::Parse(e.to_string()))?;
    let entries = body["result"].as_array().cloned().unwrap_or_default();

    let leagues: Vec<League> = entries.into_iter().filter_map(|e| {
        let id = e["id"].as_str()?.to_owned();
        let text = e["text"].as_str()?.to_owned();
        let realm = e["realm"].as_str().map(|s| s.to_owned());
        // Filter to PC realm only (matches TypeScript: realm === 'pc' || realm === undefined)
        if realm.as_deref() == Some("pc") || realm.is_none() {
            Some(League { id, text, realm })
        } else {
            None
        }
    }).collect();

    {
        let mut cache = state.league_cache.lock().await;
        cache.leagues = leagues.clone();
        cache.fetched_at = Some(std::time::Instant::now());
    }

    Ok(leagues)
}
```

**`get_trade_stats` — replaces `GET /api/trade/stats`:**
```rust
#[tauri::command]
pub async fn get_trade_stats(state: State<'_, AppState>) -> Result<Vec<TradeStat>, AppError> {
    {
        let cache = state.stat_cache.lock().await;
        if let Some(fetched_at) = cache.fetched_at {
            if fetched_at.elapsed().as_secs() < cache.ttl_secs && !cache.stats.is_empty() {
                return Ok(cache.stats.clone());
            }
        }
    }

    // Cache miss — fetch from GGG (does NOT go through rate_limiter; stats endpoint is separate)
    let client = reqwest::Client::new();
    let url = "https://www.pathofexile.com/api/data/stats";
    let resp = client.get(url)
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| AppError::Network(e.to_string()))?;

    if !resp.status().is_success() {
        let cache = state.stat_cache.lock().await;
        if !cache.stats.is_empty() {
            return Ok(cache.stats.clone()); // serve stale on error
        }
        return Ok(FALLBACK_STATS.to_vec()); // defined as a const Vec<TradeStat>
    }

    // GGG response: { result: [{ label, entries: [{ id, text, type }] }] }
    let body: serde_json::Value = resp.json().await.map_err(|e| AppError::Parse(e.to_string()))?;
    let groups = body["result"].as_array().cloned().unwrap_or_default();

    let mut stats: Vec<TradeStat> = Vec::new();
    for group in groups {
        if let Some(entries) = group["entries"].as_array() {
            for entry in entries {
                if let (Some(id), Some(text), Some(stat_type)) = (
                    entry["id"].as_str(),
                    entry["text"].as_str(),
                    entry["type"].as_str(),
                ) {
                    stats.push(TradeStat {
                        id: id.to_owned(),
                        text: text.to_owned(),
                        stat_type: stat_type.to_owned(),
                    });
                }
            }
        }
    }

    {
        let mut cache = state.stat_cache.lock().await;
        cache.stats = stats.clone();
        cache.fetched_at = Some(std::time::Instant::now());
    }

    Ok(stats)
}
```

**`search_trade` — replaces `POST /api/trade/search`:**
This command loads filter patterns from SQLite (using the DB from Phase 2), resolves them to stat IDs using the stat cache, builds the trade query, and executes the search. No user auth required in desktop context.

```rust
#[tauri::command]
pub async fn search_trade(
    args: SearchTradeArgs,
    state: State<'_, AppState>,
) -> Result<SearchTradeResult, AppError> {
    // 1. Load regex filters from SQLite by IDs
    //    (uses Phase 2 DB — sqlx query on regex_filters table)
    let rows = sqlx::query!(
        "SELECT id, name, pattern FROM regex_filters WHERE id IN (SELECT value FROM json_each(?))",
        serde_json::to_string(&args.filter_ids).unwrap()
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| AppError::Database(e.to_string()))?;

    if rows.is_empty() {
        return Ok(SearchTradeResult {
            query_id: None, total: 0, results: vec![], filters_used: vec![],
        });
    }

    // 2. Ensure stat cache is warm (call get_trade_stats internally if needed)
    let stats = {
        let cache = state.stat_cache.lock().await;
        if cache.stats.is_empty() {
            drop(cache);
            get_trade_stats(state.clone()).await?
        } else {
            cache.stats.clone()
        }
    };

    // 3. Resolve each filter pattern to a stat ID
    let mut filters_used: Vec<FilterMatch> = Vec::new();
    let mut stat_ids: Vec<String> = Vec::new();

    for row in &rows {
        let matched = find_stat_id(&row.pattern, &stats);
        filters_used.push(FilterMatch {
            filter_name: row.name.clone(),
            pattern: row.pattern.clone(),
            matched_stat_id: matched.clone(),
        });
        if let Some(id) = matched {
            stat_ids.push(id);
        }
    }

    if stat_ids.is_empty() {
        return Ok(SearchTradeResult {
            query_id: None, total: 0, results: vec![], filters_used,
        });
    }

    // 4. Build query (mirrors buildQuery from poe-api.ts)
    let trade_filters: Vec<TradeStatFilter> = stat_ids.iter()
        .map(|id| TradeStatFilter { id: id.clone(), disabled: false })
        .collect();

    let mut query_body = TradeQueryBody {
        status: serde_json::json!({ "option": "online" }),
        stats: vec![TradeStatGroup { group_type: "and".into(), filters: trade_filters }],
        filters: None,
    };

    // Price filters
    if args.min_price.is_some() || args.max_price.is_some() || args.currency.is_some() {
        let mut price_obj = serde_json::Map::new();
        if let Some(min) = args.min_price { price_obj.insert("min".into(), min.into()); }
        if let Some(max) = args.max_price { price_obj.insert("max".into(), max.into()); }
        if let Some(cur) = &args.currency { price_obj.insert("option".into(), cur.clone().into()); }
        query_body.filters = Some(serde_json::json!({
            "trade_filters": { "filters": { "price": price_obj } }
        }));
    }

    let trade_query = TradeQuery {
        query: query_body,
        sort: serde_json::json!({ "price": "asc" }),
    };

    // 5. Execute search (rate-limited)
    rate_limit_wait(&state.rate_limiter).await;
    let client = reqwest::Client::new();
    let url = format!("{}/search/{}", BASE_URL, urlencoding::encode(&args.league));

    let resp = client.post(&url)
        .header("User-Agent", USER_AGENT)
        .json(&trade_query)
        .send()
        .await
        .map_err(|e| AppError::Network(e.to_string()))?;

    {
        let mut limiter = state.rate_limiter.lock().await;
        update_rate_limit_from_headers(&mut limiter, resp.headers());
    }

    if !resp.status().is_success() {
        let msg = resp.text().await.unwrap_or_default();
        return Err(AppError::TradeApi(format!("Search failed: {}", msg)));
    }

    let search_resp: TradeSearchResponse = resp.json().await
        .map_err(|e| AppError::Parse(e.to_string()))?;

    // 6. Fetch first 10 results
    let result_ids = search_resp.result.iter().take(10).cloned().collect::<Vec<_>>();
    let results = if result_ids.is_empty() {
        vec![]
    } else {
        fetch_trade_results_inner(&search_resp.id, result_ids, &state).await?
    };

    Ok(SearchTradeResult {
        query_id: Some(search_resp.id),
        total: search_resp.total,
        results,
        filters_used,
    })
}
```

**`fetch_trade_results` — replaces `GET /api/trade/results/[queryId]`:**
```rust
// Internal version called by search_trade
async fn fetch_trade_results_inner(
    query_id: &str,
    result_ids: Vec<String>,
    state: &State<'_, AppState>,
) -> Result<Vec<TradeItem>, AppError> {
    rate_limit_wait(&state.rate_limiter).await;
    let ids_str = result_ids.iter().take(10).cloned().collect::<Vec<_>>().join(",");
    let url = format!("{}/fetch/{}?query={}", BASE_URL, ids_str, urlencoding::encode(query_id));

    let client = reqwest::Client::new();
    let resp = client.get(&url)
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| AppError::Network(e.to_string()))?;

    {
        let mut limiter = state.rate_limiter.lock().await;
        update_rate_limit_from_headers(&mut limiter, resp.headers());
    }

    if !resp.status().is_success() {
        return Err(AppError::TradeApi(format!("Fetch results failed: {}", resp.status())));
    }

    let body: TradeFetchResponse = resp.json().await
        .map_err(|e| AppError::Parse(e.to_string()))?;
    Ok(body.result)
}

// Public Tauri command version (called independently from frontend)
#[tauri::command]
pub async fn fetch_trade_results(
    query_id: String,
    ids: Vec<String>,
    state: State<'_, AppState>,
) -> Result<Vec<TradeItem>, AppError> {
    if ids.is_empty() {
        return Ok(vec![]);
    }
    fetch_trade_results_inner(&query_id, ids, &state).await
}
```

**`proxy_search` — replaces `POST /api/trade/proxy-search`:**
```rust
#[tauri::command]
pub async fn proxy_search(
    args: ProxySearchArgs,
    state: State<'_, AppState>,
) -> Result<ProxySearchResult, AppError> {
    rate_limit_wait(&state.rate_limiter).await;
    let client = reqwest::Client::new();
    let url = format!("{}/search/{}", BASE_URL, urlencoding::encode(&args.league));

    let resp = client.post(&url)
        .header("User-Agent", USER_AGENT)
        .json(&args.query)
        .send()
        .await
        .map_err(|e| AppError::Network(e.to_string()))?;

    {
        let mut limiter = state.rate_limiter.lock().await;
        update_rate_limit_from_headers(&mut limiter, resp.headers());
    }

    if !resp.status().is_success() {
        let msg = resp.text().await.unwrap_or_default();
        return Err(AppError::TradeApi(format!("Proxy search failed: {}", msg)));
    }

    let search_resp: TradeSearchResponse = resp.json().await
        .map_err(|e| AppError::Parse(e.to_string()))?;

    Ok(ProxySearchResult {
        id: search_resp.id.clone(),
        total: search_resp.total,
        url: format!(
            "https://www.pathofexile.com/trade/search/{}/{}",
            urlencoding::encode(&args.league),
            search_resp.id
        ),
    })
}
```

Add `urlencoding = "2"` to `Cargo.toml` dependencies.

**Register all commands in `lib.rs`** (per PITFALLS.md Pitfall 11 — single `generate_handler!` call):
```rust
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
        // Phase 2 commands (already registered)
        commands::filters::get_filters,
        commands::filters::create_filter,
        // ... etc
        // Phase 3 trade commands
        commands::trade::get_leagues,
        commands::trade::get_trade_stats,
        commands::trade::search_trade,
        commands::trade::fetch_trade_results,
        commands::trade::proxy_search,
        // Phase 3 price commands (Plan 04)
        commands::prices::get_prices,
    ])
```

Also add to `commands/mod.rs`:
```rust
pub mod trade;
pub mod prices;  // (from Plan 04)
```

**FALLBACK_STATS constant** — port the 25-item fallback from `poe-static-data.ts`:
```rust
static FALLBACK_STATS: &[TradeStat] = &[
    TradeStat { id: "explicit.stat_1940865751".into(), text: "#% increased Pack Size".into(), stat_type: "explicit".into() },
    // ... (port all 25 entries from poe-static-data.ts lines 32-57)
];
```
Note: Use `lazy_static!` or `once_cell::sync::Lazy` to define this as a static `Vec<TradeStat>` since `TradeStat` contains `String` (not `Copy`). Add `once_cell = "1"` to `Cargo.toml`.

**Verify:** `cargo build --manifest-path src-tauri/Cargo.toml` exits 0 (full build, not just check, to catch any proc-macro issues).

**Done:** All five commands registered and compile. `cargo build` passes. Each command maps 1:1 to the replaced Next.js route.

---

## Plan 04 — commands/prices.rs: poe.watch Price Cache

**Wave:** 2 (parallel with Plan 03)
**Depends on:** Plan 01 (PriceCache, PoeWatchItem in state.rs)
**Requirements:** TRADE-03

### Task 1: Implement get_prices command with TTL cache

**Files:** `src-tauri/src/commands/prices.rs`

**Action:**
Port `src/lib/server/price-cache.ts` to Rust. The virtual categories (chisel, astrolabe) must be preserved — they filter from the `currency` category.

```rust
// ABOUTME: poe.watch price commands with 15-minute TTL cache.
// ABOUTME: Virtual categories (chisel, astrolabe) filter from the currency category response.

use serde::{Deserialize, Serialize};
use tauri::State;
use crate::state::{AppState, PoeWatchItem};
use crate::error::AppError;

const POE_WATCH_BASE: &str = "https://api.poe.watch/get";
const USER_AGENT: &str = "CADIRO-TradeHelper/0.1.0";

// Virtual categories: map to a real poe.watch category + filter by item name
struct VirtualCategory {
    real_category: &'static str,
    filter_name: &'static str,
}

fn virtual_category(category: &str) -> Option<VirtualCategory> {
    match category {
        "chisel" => Some(VirtualCategory { real_category: "currency", filter_name: "Cartographer's Chisel" }),
        "astrolabe" => Some(VirtualCategory { real_category: "currency", filter_name: "Astrolabe" }),
        _ => None,
    }
}

fn cache_key(league: &str, category: &str) -> String {
    format!("{}:{}", league, category)
}

#[tauri::command]
pub async fn get_prices(
    category: String,
    league: String,
    state: State<'_, AppState>,
) -> Result<Vec<PoeWatchItem>, AppError> {
    let virtual_cat = virtual_category(&category);
    let actual_category = virtual_cat.as_ref()
        .map(|v| v.real_category)
        .unwrap_or(category.as_str());

    let key = cache_key(&league, actual_category);

    // Check cache (TTL: 900 seconds = 15 minutes)
    {
        let cache = state.price_cache.lock().await;
        if let Some(entry) = cache.entries.get(&key) {
            if entry.fetched_at.elapsed().as_secs() < cache.ttl_secs {
                let items = if let Some(vcat) = &virtual_cat {
                    entry.items.iter()
                        .filter(|item| item.name == vcat.filter_name)
                        .cloned()
                        .collect()
                } else {
                    entry.items.clone()
                };
                return Ok(items);
            }
        }
    }

    // Cache miss — fetch from poe.watch
    let url = format!(
        "{}?league={}&category={}",
        POE_WATCH_BASE,
        urlencoding::encode(&league),
        urlencoding::encode(actual_category)
    );

    let client = reqwest::Client::new();
    let resp = client.get(&url)
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| AppError::Network(e.to_string()))?;

    if !resp.status().is_success() {
        // Return stale cache if available rather than error
        let cache = state.price_cache.lock().await;
        if let Some(entry) = cache.entries.get(&key) {
            return Ok(entry.items.clone());
        }
        return Err(AppError::Network(format!("poe.watch fetch failed: {}", resp.status())));
    }

    // Parse poe.watch response (array of items, not wrapped in envelope)
    let raw: serde_json::Value = resp.json().await.map_err(|e| AppError::Parse(e.to_string()))?;
    let raw_arr = raw.as_array().cloned().unwrap_or_default();

    let items: Vec<PoeWatchItem> = raw_arr.into_iter().filter_map(|obj| {
        Some(PoeWatchItem {
            id: obj["id"].as_i64()?,
            name: obj["name"].as_str()?.to_owned(),
            category: obj["category"].as_str().unwrap_or("").to_owned(),
            mean: obj["mean"].as_f64().unwrap_or(0.0),
            daily: obj["daily"].as_f64().unwrap_or(0.0),
            change: obj["change"].as_f64().unwrap_or(0.0),
            low_confidence: obj["lowConfidence"].as_bool().unwrap_or(true),
            icon: obj["icon"].as_str().unwrap_or("").to_owned(),
        })
    }).collect();

    // Store in cache
    {
        let mut cache = state.price_cache.lock().await;
        cache.entries.insert(key, crate::state::PriceCacheEntry {
            items: items.clone(),
            fetched_at: std::time::Instant::now(),
        });
    }

    // Apply virtual category filter
    let result = if let Some(vcat) = &virtual_cat {
        items.into_iter().filter(|item| item.name == vcat.filter_name).collect()
    } else {
        items
    };

    Ok(result)
}
```

**Verify:** `cargo build --manifest-path src-tauri/Cargo.toml` exits 0. Run `tauri dev` (or `cargo test` if unit tests exist) to confirm the module compiles in context.

**Done:** `get_prices` command compiles and is registered in `lib.rs`. Cache key is `"league:category"`. TTL is 900 seconds. Virtual categories chisel and astrolabe filter from the `currency` fetch. Stale cache served on network error (graceful degradation matching the TypeScript original).

---

## Plan 05 — Frontend: ipc.ts Wrappers + Hook Migration

**Wave:** 3
**Depends on:** Plan 03, Plan 04 (all Rust commands must exist before frontend calls them)
**Requirements:** TRADE-01, TRADE-03, TRADE-04, TRADE-05

### Task 1: Add trade and price commands to ipc.ts

**Files:** `src/lib/ipc.ts`

**Action:**
Read the existing `src/lib/ipc.ts` (created in Phase 2 with filter/preset/strategy commands). Add the Phase 3 trade and price commands.

First, add these TypeScript interfaces to `src/types/` or inline at the top of `ipc.ts` if types don't already exist there. Check `src/types/` first.

```typescript
// Types for trade IPC commands (add to src/types/trade.ts or inline in ipc.ts)

export interface TradeStat {
  id: string;
  text: string;
  type: string;
}

export interface League {
  id: string;
  text: string;
  realm?: string;
}

export interface TradeStatFilter {
  id: string;
  disabled: boolean;
}

export interface TradeStatGroup {
  type: string;
  filters: TradeStatFilter[];
}

export interface TradeQuery {
  query: {
    status: { option: string };
    stats: TradeStatGroup[];
    filters?: Record<string, unknown>;
  };
  sort: { price: string };
}

export interface TradeItem {
  id: string;
  listing: Record<string, unknown>;
  item: Record<string, unknown>;
}

export interface FilterMatch {
  filterName: string;
  pattern: string;
  matchedStatId: string | null;
}

export interface SearchTradeResult {
  queryId: string | null;
  total: number;
  results: TradeItem[];
  filtersUsed: FilterMatch[];
}

export interface ProxySearchResult {
  id: string;
  total: number;
  url: string;
}

export interface SearchTradeArgs {
  filterIds: string[];
  league: string;
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
}

export interface PoeWatchItem {
  id: number;
  name: string;
  category: string;
  mean: number;
  daily: number;
  change: number;
  lowConfidence: boolean;
  icon: string;
}

export type PriceCategory = 'scarab' | 'deliriumOrb' | 'currency' | 'chisel' | 'astrolabe';
```

Then extend the `ipc` object in `src/lib/ipc.ts`:

```typescript
// Add to existing ipc object — do NOT replace existing filter/preset/strategy commands

// Trade
searchTrade: (args: SearchTradeArgs) =>
  invoke<SearchTradeResult>('search_trade', { args }),

fetchTradeResults: (queryId: string, ids: string[]) =>
  invoke<TradeItem[]>('fetch_trade_results', { queryId, ids }),

getLeagues: () =>
  invoke<League[]>('get_leagues'),

getTradeStats: () =>
  invoke<TradeStat[]>('get_trade_stats'),

proxySearch: (args: { league: string; query: TradeQuery }) =>
  invoke<ProxySearchResult>('proxy_search', { args }),

// Prices
getPrices: (category: PriceCategory, league: string) =>
  invoke<PoeWatchItem[]>('get_prices', { category, league }),
```

**Caution on serialization:** Tauri IPC serializes Rust `snake_case` field names as `camelCase` by default when using `serde`. Verify `#[serde(rename_all = "camelCase")]` is applied to the Rust response structs in `commands/trade.rs` if the TypeScript side uses camelCase. If not already present, add `#[serde(rename_all = "camelCase")]` to `SearchTradeResult`, `FilterMatch`, `TradeItem`, and `ProxySearchResult` in `trade.rs`.

**Verify:** `tsc --noEmit` (TypeScript compile check) exits 0.

**Done:** `ipc.ts` exports typed wrappers for all 6 Phase 3 commands. No `any` types. Return types match the Rust command signatures.

---

### Task 2: Adapt use-trade-stats.ts and use-prices.ts hooks

**Files:**
- `src/lib/hooks/use-trade-stats.ts`
- `src/lib/hooks/use-prices.ts`
- `src/lib/hooks/use-leagues.ts` (new file — replaces league-cache.ts fetch)

**Action:**
**`use-trade-stats.ts`** — swap `api.get('/trade/stats')` for `ipc.getTradeStats()`:

```typescript
// ABOUTME: Fetches PoE trade stat definitions from Rust backend via IPC.
// ABOUTME: Stats are cached for 1 hour via TanStack Query. Used for trade search query building.

import { useQuery } from '@tanstack/react-query';
import { ipc } from '@/lib/ipc';
import type { TradeStat } from '@/lib/ipc';

const ONE_HOUR = 60 * 60 * 1000;

export function useTradeStats() {
  return useQuery<TradeStat[]>({
    queryKey: ['trade-stats'],
    queryFn: () => ipc.getTradeStats(),
    staleTime: ONE_HOUR,
  });
}

// Keep findStatByText, matchModTexts as-is — pure functions, no change needed
export function findStatByText(allStats: TradeStat[], modText: string): string | null {
  // ... (unchanged from current implementation)
}

export function matchModTexts(
  allStats: TradeStat[],
  modTexts: string[],
): Array<{ text: string; statId: string | null }> {
  // ... (unchanged from current implementation)
}
```

**`use-prices.ts`** — swap `api.get('/prices/...')` for `ipc.getPrices()`:

```typescript
// ABOUTME: TanStack Query hooks for fetching poe.watch price data by category via Rust IPC.
// ABOUTME: Public data — uses ipc.getPrices which reads from the Rust-side TTL cache.

import { useQuery } from '@tanstack/react-query';
import { ipc } from '@/lib/ipc';
import type { PoeWatchItem, PriceCategory } from '@/lib/ipc';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

export type { PoeWatchItem, PriceCategory };

export function usePrices(category: PriceCategory, league: string) {
  return useQuery<PoeWatchItem[]>({
    queryKey: ['prices', category, league],
    queryFn: () => ipc.getPrices(category, league),
    staleTime: FIFTEEN_MINUTES,
    enabled: league.length > 0,
  });
}

export function useDivinePrice(league: string) {
  const { data } = usePrices('currency', league);
  const divine = data?.find((item) => item.name === 'Divine Orb');
  return divine?.mean ?? 150;
}
```

**`use-leagues.ts`** (new file) — replaces calls to `api.get('/trade/leagues')` in `league-context.tsx`:

```typescript
// ABOUTME: TanStack Query hook for fetching available PoE leagues via Rust IPC.
// ABOUTME: League list is cached in Rust for 24 hours; this hook provides a React-level cache on top.

import { useQuery } from '@tanstack/react-query';
import { ipc } from '@/lib/ipc';
import type { League } from '@/lib/ipc';

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export type { League };

export function useLeagues() {
  return useQuery<League[]>({
    queryKey: ['leagues'],
    queryFn: () => ipc.getLeagues(),
    staleTime: TWENTY_FOUR_HOURS,
  });
}
```

**Update `league-context.tsx`** to use `useLeagues()` instead of `api.get('/api/trade/leagues')`. Read the file first; replace only the fetch call, preserve the context shape and `activeLeague` state.

**Verify:**
```bash
tsc --noEmit
```
TypeScript compile exits 0 with no errors in the adapted hooks.

**Done:** `use-trade-stats.ts` queries via `ipc.getTradeStats()`. `use-prices.ts` queries via `ipc.getPrices(category, league)`. `use-leagues.ts` queries via `ipc.getLeagues()`. `league-context.tsx` uses `useLeagues()`. No `api.get()` calls remain in trade-related hooks. All hooks pass `tsc --noEmit`.

---

## Overall Verification

After all five plans are executed in wave order:

```bash
# 1. Rust build clean
cargo build --manifest-path src-tauri/Cargo.toml

# 2. TypeScript clean
cd frontend && tsc --noEmit

# 3. Integration smoke test (tauri dev)
# Start the app, open DevTools console, run:
#   window.__TAURI__.invoke('get_leagues').then(console.log)
#   window.__TAURI__.invoke('get_trade_stats').then(r => console.log(r.length + ' stats'))
#   window.__TAURI__.invoke('get_prices', { category: 'currency', league: 'Standard' }).then(console.log)
```

### Success Criteria (Phase 3 complete when ALL are TRUE)

1. `cargo build` exits 0 — all five commands compile without warnings (use `#[allow(dead_code)]` only if needed for unused stubs that Phase 4 will fill)
2. `tsc --noEmit` exits 0 — no TypeScript errors in adapted hooks or ipc.ts
3. `invoke('get_leagues')` from DevTools returns an array with at least `Standard` in it
4. `invoke('get_trade_stats')` returns an array with at least 25 items (fallback list)
5. `invoke('get_prices', { category: 'currency', league: 'Standard' })` returns poe.watch data or an empty array without crashing
6. A second call to `invoke('get_trade_stats')` within 1 hour returns instantly (no network delay — cache hit)
7. No `api.get()` or `fetch('/api/trade/...')` calls remain in `use-trade-stats.ts`, `use-prices.ts`, or `league-context.tsx`
8. Rate limiter `last_request_ms` is updated after each GGG API call — verify by logging in Rust or checking `X-Rate-Limit-Ip-State` header is parsed without panic

---

## Output

After completion, create `.planning/phases/3/3-trade-api-SUMMARY.md` with:
- Commands implemented (names, signatures)
- Fallback behavior confirmed (stat fallback, league fallback, stale price cache)
- Rate limiter approach (1500ms base + header-driven backoff)
- Any deviations from this plan and why
