// ABOUTME: poe.watch price commands with 15-minute TTL cache.
// ABOUTME: Virtual categories (chisel, astrolabe) filter from the currency category response.

use tauri::State;

use crate::error::{Error, Result};
use crate::state::{AppState, PoeWatchItem};

const POE_WATCH_BASE: &str = "https://api.poe.watch/get";
const USER_AGENT: &str = "NIKO-TradeHelper/0.1.0";

/// Maps a virtual category name to the real poe.watch category and an item name filter.
/// Virtual categories share a real category fetch but expose a filtered subset.
struct VirtualCategory {
    real_category: &'static str,
    filter_name: &'static str,
}

fn virtual_category(category: &str) -> Option<VirtualCategory> {
    match category {
        "chisel" => Some(VirtualCategory {
            real_category: "currency",
            filter_name: "Cartographer's Chisel",
        }),
        "astrolabe" => Some(VirtualCategory {
            real_category: "currency",
            filter_name: "Astrolabe",
        }),
        _ => None,
    }
}

fn cache_key(league: &str, category: &str) -> String {
    format!("{}:{}", league, category)
}

/// Fetches item prices from poe.watch for the given league and category.
/// Results are cached for 15 minutes (900 seconds). Virtual categories (chisel, astrolabe)
/// are fetched as `currency` and filtered by item name before returning.
/// On network failure, stale cache is served if available (graceful degradation).
#[tauri::command]
pub async fn get_prices(
    category: String,
    league: String,
    state: State<'_, AppState>,
) -> Result<Vec<PoeWatchItem>> {
    let virtual_cat = virtual_category(&category);
    let actual_category = virtual_cat
        .as_ref()
        .map(|v| v.real_category)
        .unwrap_or(category.as_str());

    let key = cache_key(&league, actual_category);

    // Check cache — serve hit without touching the network
    {
        let cache = state.price_cache.lock().await;
        if let Some(entry) = cache.entries.get(&key) {
            if entry.fetched_at.elapsed().as_secs() < cache.ttl_secs {
                let items = if let Some(ref vcat) = virtual_cat {
                    entry
                        .items
                        .iter()
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
    let resp = client
        .get(&url)
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| Error::Network(e.to_string()))?;

    if !resp.status().is_success() {
        // Serve stale cache on error rather than propagating failure
        let cache = state.price_cache.lock().await;
        if let Some(entry) = cache.entries.get(&key) {
            return Ok(entry.items.clone());
        }
        return Err(Error::Network(format!(
            "poe.watch fetch failed: {}",
            resp.status()
        )));
    }

    // poe.watch returns a bare array (no envelope wrapper)
    let raw: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| Error::Parse(e.to_string()))?;
    let raw_arr = raw.as_array().cloned().unwrap_or_default();

    let items: Vec<PoeWatchItem> = raw_arr
        .into_iter()
        .filter_map(|obj| {
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
        })
        .collect();

    // Store in cache before applying virtual filter
    {
        let mut cache = state.price_cache.lock().await;
        cache.entries.insert(
            key,
            crate::state::PriceCacheEntry {
                items: items.clone(),
                fetched_at: std::time::Instant::now(),
            },
        );
    }

    let result = if let Some(ref vcat) = virtual_cat {
        items
            .into_iter()
            .filter(|item| item.name == vcat.filter_name)
            .collect()
    } else {
        items
    };

    Ok(result)
}

/// Categories to search when looking up item prices by name.
const LOOKUP_CATEGORIES: &[&str] = &[
    "currency",
    "essence",
    "card",
    "scarab",
    "fossil",
    "resonator",
    "oil",
    "catalyst",
    "fragment",
    "delirium-orb",
    "vial",
    "incubator",
    "map",
];

/// Looks up prices for a list of item names across multiple poe.watch categories.
/// Returns a map of item name → price (chaos). Uses cached data when available.
/// Items not found in any category are omitted from the result.
#[tauri::command]
pub async fn lookup_item_prices(
    item_names: Vec<String>,
    league: String,
    state: State<'_, AppState>,
) -> Result<std::collections::HashMap<String, f64>> {
    let mut result = std::collections::HashMap::new();
    if item_names.is_empty() {
        return Ok(result);
    }

    // Build a set for O(1) lookups
    let name_set: std::collections::HashSet<String> = item_names
        .iter()
        .map(|n| n.to_lowercase())
        .collect();

    for &cat in LOOKUP_CATEGORIES {
        let key = cache_key(&league, cat);

        // Try cache first
        let cached_items = {
            let cache = state.price_cache.lock().await;
            cache.entries.get(&key).and_then(|entry| {
                if entry.fetched_at.elapsed().as_secs() < cache.ttl_secs {
                    Some(entry.items.clone())
                } else {
                    None
                }
            })
        };

        let items = if let Some(cached) = cached_items {
            cached
        } else {
            // Fetch from poe.watch
            let url = format!(
                "{}?league={}&category={}",
                POE_WATCH_BASE,
                urlencoding::encode(&league),
                urlencoding::encode(cat)
            );

            let client = reqwest::Client::new();
            let resp = client
                .get(&url)
                .header("User-Agent", USER_AGENT)
                .send()
                .await;

            match resp {
                Ok(r) if r.status().is_success() => {
                    let raw: serde_json::Value = r
                        .json()
                        .await
                        .map_err(|e| Error::Parse(e.to_string()))?;
                    let raw_arr = raw.as_array().cloned().unwrap_or_default();

                    let fetched: Vec<PoeWatchItem> = raw_arr
                        .into_iter()
                        .filter_map(|obj| {
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
                        })
                        .collect();

                    // Cache it
                    {
                        let mut cache = state.price_cache.lock().await;
                        cache.entries.insert(
                            key,
                            crate::state::PriceCacheEntry {
                                items: fetched.clone(),
                                fetched_at: std::time::Instant::now(),
                            },
                        );
                    }

                    fetched
                }
                _ => continue, // Skip this category on error
            }
        };

        // Match items by name (case-insensitive)
        for item in &items {
            let lower = item.name.to_lowercase();
            if name_set.contains(&lower) && !result.contains_key(&item.name) && item.mean > 0.0 {
                result.insert(item.name.clone(), item.mean);
            }
        }

        // Early exit if all names found
        if result.len() >= item_names.len() {
            break;
        }
    }

    Ok(result)
}
