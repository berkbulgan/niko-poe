// ABOUTME: PoE Trade API commands — search, fetch results, leagues, and stat definitions.
// ABOUTME: All outbound HTTP goes through the shared RateLimiter in AppState.

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::{Error, Result};
use crate::state::{AppState, League, TradeStat};

const BASE_URL: &str = "https://www.pathofexile.com/api/trade";
const USER_AGENT: &str = "NIKO-TradeHelper/0.1.0";

// ---- Fallback stat definitions (subset of GGG stats for offline/error resilience) ----

static FALLBACK_STATS: Lazy<Vec<TradeStat>> = Lazy::new(|| {
    vec![
        TradeStat { id: "explicit.stat_1497673356".into(), text: "Monsters deal #% extra Physical Damage as Fire".into(), stat_type: "explicit".into() },
        TradeStat { id: "explicit.stat_3448216135".into(), text: "Monsters deal #% extra Physical Damage as Cold".into(), stat_type: "explicit".into() },
        TradeStat { id: "explicit.stat_3416853625".into(), text: "Monsters deal #% extra Physical Damage as Lightning".into(), stat_type: "explicit".into() },
        TradeStat { id: "explicit.stat_2306522833".into(), text: "#% increased Monster Movement Speed".into(), stat_type: "explicit".into() },
        TradeStat { id: "explicit.stat_1913583994".into(), text: "#% increased Monster Attack Speed".into(), stat_type: "explicit".into() },
        TradeStat { id: "explicit.stat_2488361432".into(), text: "#% increased Monster Cast Speed".into(), stat_type: "explicit".into() },
        TradeStat { id: "explicit.stat_322206271".into(), text: "Monsters have #% chance to Avoid Elemental Ailments".into(), stat_type: "explicit".into() },
        TradeStat { id: "explicit.stat_4154059009".into(), text: "Monsters are Hexproof".into(), stat_type: "explicit".into() },
        TradeStat { id: "explicit.stat_3464419871".into(), text: "Monsters reflect #% of Physical Damage".into(), stat_type: "explicit".into() },
        TradeStat { id: "explicit.stat_2764017512".into(), text: "Monsters reflect #% of Elemental Damage".into(), stat_type: "explicit".into() },
        TradeStat { id: "explicit.stat_95249895".into(), text: "#% more Monster Life".into(), stat_type: "explicit".into() },
        TradeStat { id: "explicit.stat_1263311755".into(), text: "#% more Monster Damage".into(), stat_type: "explicit".into() },
        TradeStat { id: "explicit.stat_2961018200".into(), text: "Area is inhabited by Abominations".into(), stat_type: "explicit".into() },
        TradeStat { id: "explicit.stat_4103440490".into(), text: "Players are Cursed with Enfeeble".into(), stat_type: "explicit".into() },
        TradeStat { id: "explicit.stat_2326202293".into(), text: "Players are Cursed with Temporal Chains".into(), stat_type: "explicit".into() },
        TradeStat { id: "explicit.stat_1366534040".into(), text: "Players are Cursed with Vulnerability".into(), stat_type: "explicit".into() },
        TradeStat { id: "explicit.stat_558910024".into(), text: "Players are Cursed with Elemental Weakness".into(), stat_type: "explicit".into() },
        TradeStat { id: "explicit.stat_3796523155".into(), text: "#% less effect of Curses on Monsters".into(), stat_type: "explicit".into() },
        TradeStat { id: "explicit.stat_2887760183".into(), text: "Monsters gain #% of Maximum Life as Extra Maximum Energy Shield".into(), stat_type: "explicit".into() },
        TradeStat { id: "explicit.stat_3561450806".into(), text: "Area has increased monster variety".into(), stat_type: "explicit".into() },
    ]
});

// ---- Request / Response types ----

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
    pub status: serde_json::Value,
    pub stats: Vec<TradeStatGroup>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filters: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TradeQuery {
    pub query: TradeQueryBody,
    pub sort: serde_json::Value,
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

#[derive(Debug, Deserialize)]
struct TradeFetchResponse {
    pub result: Vec<TradeItem>,
}

// ---- Args types (received from frontend via IPC) ----

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchTradeArgs {
    pub filter_ids: Vec<String>,
    pub league: String,
    pub min_price: Option<f64>,
    pub max_price: Option<f64>,
    pub currency: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchTradeResult {
    pub query_id: Option<String>,
    pub total: u32,
    pub results: Vec<TradeItem>,
    pub filters_used: Vec<FilterMatch>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FilterMatch {
    pub filter_name: String,
    pub pattern: String,
    pub matched_stat_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxySearchArgs {
    pub league: String,
    pub query: serde_json::Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxySearchResult {
    pub id: String,
    pub total: u32,
    pub url: String,
}

// ---- Rate limiter helpers ----

/// Enforces minimum gap between PoE API requests. Call before every outbound reqwest call.
/// Reads `last_request_ms` from the shared RateLimiter, sleeps if needed, then updates it.
/// The lock is dropped before sleeping to avoid holding it during the sleep duration.
pub(crate) async fn rate_limit_wait(limiter: &tokio::sync::Mutex<crate::state::RateLimiter>) {
    let now_ms = || {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64
    };

    let sleep_ms = {
        let guard = limiter.lock().await;
        if guard.last_request_ms > 0 {
            let elapsed = now_ms().saturating_sub(guard.last_request_ms);
            if elapsed < guard.min_gap_ms {
                Some(guard.min_gap_ms - elapsed)
            } else {
                None
            }
        } else {
            None
        }
    }; // lock released here before any sleep

    if let Some(ms) = sleep_ms {
        tokio::time::sleep(tokio::time::Duration::from_millis(ms)).await;
    }

    // Re-acquire and stamp the request time
    let mut guard = limiter.lock().await;
    guard.last_request_ms = now_ms();
}

/// After a GGG API response, inspect X-Rate-Limit-* headers and adjust min_gap_ms.
/// GGG header format: X-Rate-Limit-Ip: "5:4:240" (max_hits:window_secs:ban_secs)
/// X-Rate-Limit-Ip-State: "1:4:0" (current_hits:window_secs:currently_banned_secs)
/// At 80%+ utilization: increase min_gap_ms to back off. Below 40%: recover toward 1500ms.
pub(crate) fn update_rate_limit_from_headers(
    limiter: &mut crate::state::RateLimiter,
    headers: &reqwest::header::HeaderMap,
) {
    let state_val = headers
        .get("X-Rate-Limit-Ip-State")
        .and_then(|v| v.to_str().ok());
    let limit_val = headers
        .get("X-Rate-Limit-Ip")
        .and_then(|v| v.to_str().ok());

    if let (Some(state_str), Some(limit_str)) = (state_val, limit_val) {
        let current: u64 = state_str
            .split(':')
            .next()
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);
        let max: u64 = limit_str
            .split(':')
            .next()
            .and_then(|s| s.parse().ok())
            .unwrap_or(5);
        let window_secs: u64 = state_str
            .split(':')
            .nth(1)
            .and_then(|s| s.parse().ok())
            .unwrap_or(4);

        if max > 0 && current > 0 {
            let utilization = current as f64 / max as f64;
            if utilization >= 0.8 {
                // Back off: spread remaining capacity across the window
                let new_gap = (window_secs * 1000 / max) * 2;
                limiter.min_gap_ms = limiter.min_gap_ms.max(new_gap);
            } else if utilization < 0.4 && limiter.min_gap_ms > 1500 {
                // Recover gradually toward the 1500ms baseline
                limiter.min_gap_ms = (limiter.min_gap_ms - 100).max(1500);
            }
        }
    }
}

// ---- Stat cache helpers ----

/// Resolves a regex pattern string to a PoE stat ID.
/// Logic mirrors src/lib/server/poe-static-data.ts::findStatId.
/// Replaces # placeholders with a sample number before attempting regex matching.
fn find_stat_id(pattern: &str, stats: &[TradeStat]) -> Option<String> {
    let test_pattern = pattern.replace('#', "10");

    if let Ok(re) = regex::Regex::new(&format!("(?i){}", test_pattern)) {
        for stat in stats {
            let sample = stat.text.replace('#', "10");
            if re.is_match(&sample) {
                return Some(stat.id.clone());
            }
        }
    }

    // Fallback: strip regex metacharacters and use substring match
    let simplified: String = test_pattern
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace())
        .collect::<String>()
        .trim()
        .to_lowercase();

    if simplified.len() > 3 {
        return stats
            .iter()
            .find(|s| s.text.to_lowercase().contains(&simplified))
            .map(|s| s.id.clone());
    }

    None
}

// ---- Internal fetch helper ----

async fn fetch_trade_results_inner(
    query_id: &str,
    result_ids: Vec<String>,
    state: &State<'_, AppState>,
) -> Result<Vec<TradeItem>> {
    rate_limit_wait(&state.rate_limiter).await;
    let ids_str = result_ids
        .iter()
        .take(10)
        .cloned()
        .collect::<Vec<_>>()
        .join(",");
    let url = format!(
        "{}/fetch/{}?query={}",
        BASE_URL,
        ids_str,
        urlencoding::encode(query_id)
    );

    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| Error::Network(e.to_string()))?;

    {
        let mut limiter = state.rate_limiter.lock().await;
        update_rate_limit_from_headers(&mut limiter, resp.headers());
    }

    if !resp.status().is_success() {
        return Err(Error::TradeApi(format!(
            "Fetch results failed: {}",
            resp.status()
        )));
    }

    let body: TradeFetchResponse = resp
        .json()
        .await
        .map_err(|e| Error::Parse(e.to_string()))?;
    Ok(body.result)
}

// ---- Tauri commands ----

/// Fetches and caches the list of active PC leagues from GGG.
/// Replaces GET /api/trade/leagues in the Next.js layer.
/// Falls back to stale cache or a hardcoded list on network failure.
#[tauri::command]
pub async fn get_leagues(state: State<'_, AppState>) -> Result<Vec<League>> {
    {
        let cache = state.league_cache.lock().await;
        if let Some(fetched_at) = cache.fetched_at {
            if fetched_at.elapsed().as_secs() < cache.ttl_secs && !cache.leagues.is_empty() {
                return Ok(cache.leagues.clone());
            }
        }
    }

    // Cache miss — fetch from GGG (leagues endpoint is not rate-limited like trade search)
    let client = reqwest::Client::new();
    let resp = client
        .get("https://api.pathofexile.com/leagues?type=main&realm=pc")
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| Error::Network(e.to_string()))?;

    if !resp.status().is_success() {
        let cache = state.league_cache.lock().await;
        if !cache.leagues.is_empty() {
            return Ok(cache.leagues.clone());
        }
        return Ok(vec![
            League {
                id: "Standard".into(),
                text: "Standard".into(),
                realm: None,
            },
            League {
                id: "Hardcore".into(),
                text: "Hardcore".into(),
                realm: None,
            },
        ]);
    }

    // GGG /leagues response is a JSON array of { id, text, realm, ... }
    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| Error::Parse(e.to_string()))?;
    let entries = body.as_array().cloned().unwrap_or_default();

    let leagues: Vec<League> = entries
        .into_iter()
        .filter_map(|e| {
            let id = e["id"].as_str()?.to_owned();
            let text = e["text"].as_str().unwrap_or(&id).to_owned();
            let realm = e["realm"].as_str().map(|s| s.to_owned());
            Some(League { id, text, realm })
        })
        .collect();

    {
        let mut cache = state.league_cache.lock().await;
        cache.leagues = leagues.clone();
        cache.fetched_at = Some(std::time::Instant::now());
    }

    Ok(leagues)
}

/// Fetches and caches PoE trade stat definitions (mods, base types, etc.) from GGG.
/// Replaces GET /api/trade/stats in the Next.js layer.
/// Falls back to FALLBACK_STATS if the request fails and cache is cold.
#[tauri::command]
pub async fn get_trade_stats(state: State<'_, AppState>) -> Result<Vec<TradeStat>> {
    {
        let cache = state.stat_cache.lock().await;
        if let Some(fetched_at) = cache.fetched_at {
            if fetched_at.elapsed().as_secs() < cache.ttl_secs && !cache.stats.is_empty() {
                return Ok(cache.stats.clone());
            }
        }
    }

    // Cache miss — stats endpoint is not trade-rate-limited, fetch directly
    let client = reqwest::Client::new();
    let resp = client
        .get(&format!("{}/data/stats", BASE_URL))
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| Error::Network(e.to_string()))?;

    if !resp.status().is_success() {
        let cache = state.stat_cache.lock().await;
        if !cache.stats.is_empty() {
            return Ok(cache.stats.clone());
        }
        return Ok(FALLBACK_STATS.clone());
    }

    // GGG response: { result: [{ label, entries: [{ id, text, type }] }] }
    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| Error::Parse(e.to_string()))?;
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

/// Resolves filter IDs from SQLite to trade stat IDs, builds a query, and searches PoE trade.
/// Replaces POST /api/trade/search in the Next.js layer.
/// Returns up to 10 fetched results plus metadata about stat resolution.
#[tauri::command]
pub async fn search_trade(
    args: SearchTradeArgs,
    state: State<'_, AppState>,
) -> Result<SearchTradeResult> {
    // 1. Load regex filters from SQLite by IDs
    let ids_json =
        serde_json::to_string(&args.filter_ids).map_err(|e| Error::Serialization(e.to_string()))?;
    let rows = sqlx::query(
        "SELECT id, name, pattern FROM regex_filters
         WHERE id IN (SELECT value FROM json_each(?))",
    )
    .bind(&ids_json)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    if rows.is_empty() {
        return Ok(SearchTradeResult {
            query_id: None,
            total: 0,
            results: vec![],
            filters_used: vec![],
        });
    }

    // 2. Ensure stat cache is warm
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
    use sqlx::Row;
    let mut filters_used: Vec<FilterMatch> = Vec::new();
    let mut stat_ids: Vec<String> = Vec::new();

    for row in &rows {
        let name: String = row.get("name");
        let pattern: String = row.get("pattern");
        let matched = find_stat_id(&pattern, &stats);
        if let Some(ref id) = matched {
            stat_ids.push(id.clone());
        }
        filters_used.push(FilterMatch {
            filter_name: name,
            pattern,
            matched_stat_id: matched,
        });
    }

    if stat_ids.is_empty() {
        return Ok(SearchTradeResult {
            query_id: None,
            total: 0,
            results: vec![],
            filters_used,
        });
    }

    // 4. Build query (mirrors buildQuery from poe-api.ts)
    let trade_filters: Vec<TradeStatFilter> = stat_ids
        .iter()
        .map(|id| TradeStatFilter {
            id: id.clone(),
            disabled: false,
        })
        .collect();

    let mut query_body = TradeQueryBody {
        status: serde_json::json!({ "option": "online" }),
        stats: vec![TradeStatGroup {
            group_type: "and".into(),
            filters: trade_filters,
        }],
        filters: None,
    };

    if args.min_price.is_some() || args.max_price.is_some() || args.currency.is_some() {
        let mut price_obj = serde_json::Map::new();
        if let Some(min) = args.min_price {
            price_obj.insert("min".into(), min.into());
        }
        if let Some(max) = args.max_price {
            price_obj.insert("max".into(), max.into());
        }
        if let Some(ref cur) = args.currency {
            price_obj.insert("option".into(), cur.clone().into());
        }
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
    let url = format!(
        "{}/search/{}",
        BASE_URL,
        urlencoding::encode(&args.league)
    );

    let resp = client
        .post(&url)
        .header("User-Agent", USER_AGENT)
        .json(&trade_query)
        .send()
        .await
        .map_err(|e| Error::Network(e.to_string()))?;

    {
        let mut limiter = state.rate_limiter.lock().await;
        update_rate_limit_from_headers(&mut limiter, resp.headers());
    }

    if !resp.status().is_success() {
        let msg = resp.text().await.unwrap_or_default();
        return Err(Error::TradeApi(format!("Search failed: {}", msg)));
    }

    let search_resp: TradeSearchResponse = resp
        .json()
        .await
        .map_err(|e| Error::Parse(e.to_string()))?;

    // 6. Fetch first 10 results
    let result_ids = search_resp
        .result
        .iter()
        .take(10)
        .cloned()
        .collect::<Vec<_>>();
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

/// Fetches result items for a completed trade search by query ID and item IDs.
/// Replaces GET /api/trade/results/[queryId] in the Next.js layer.
#[tauri::command]
pub async fn fetch_trade_results(
    query_id: String,
    ids: Vec<String>,
    state: State<'_, AppState>,
) -> Result<Vec<TradeItem>> {
    if ids.is_empty() {
        return Ok(vec![]);
    }
    fetch_trade_results_inner(&query_id, ids, &state).await
}

/// Accepts a raw TradeQuery from the frontend and proxies it directly to PoE Trade.
/// Replaces POST /api/trade/proxy-search in the Next.js layer.
/// Returns the search ID, total count, and a direct trade URL.
#[tauri::command]
pub async fn proxy_search(
    args: ProxySearchArgs,
    state: State<'_, AppState>,
) -> Result<ProxySearchResult> {
    rate_limit_wait(&state.rate_limiter).await;
    let client = reqwest::Client::new();
    let url = format!(
        "{}/search/{}",
        BASE_URL,
        urlencoding::encode(&args.league)
    );

    let resp = client
        .post(&url)
        .header("User-Agent", USER_AGENT)
        .json(&args.query)
        .send()
        .await
        .map_err(|e| Error::Network(e.to_string()))?;

    {
        let mut limiter = state.rate_limiter.lock().await;
        update_rate_limit_from_headers(&mut limiter, resp.headers());
    }

    if !resp.status().is_success() {
        let msg = resp.text().await.unwrap_or_default();
        return Err(Error::TradeApi(format!("Proxy search failed: {}", msg)));
    }

    let search_resp: TradeSearchResponse = resp
        .json()
        .await
        .map_err(|e| Error::Parse(e.to_string()))?;

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
