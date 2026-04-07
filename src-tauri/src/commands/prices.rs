// ABOUTME: poe.watch price commands — compact endpoint for bulk pricing on startup.
// ABOUTME: fetch_all_prices loads entire dataset; lookup_prices resolves names from cache.

use std::collections::HashMap;
use tauri::State;

use crate::error::{Error, Result};
use crate::state::AppState;

const POE_WATCH_COMPACT: &str = "https://api.poe.watch/compact";
const POE_WATCH_GET: &str = "https://api.poe.watch/get";

/// Fetches the entire poe.watch compact dataset for a league.
/// Called once at app startup. Stores a name→price map in CompactPriceCache.
/// Returns the number of items loaded.
#[tauri::command]
pub async fn fetch_all_prices(
    league: String,
    state: State<'_, AppState>,
) -> Result<u32> {
    {
        let mut cache = state.compact_prices.lock().await;
        // Already loaded and fresh? Return count.
        if let Some(fetched_at) = cache.fetched_at {
            if fetched_at.elapsed().as_secs() < cache.ttl_secs {
                return Ok(cache.prices.len() as u32);
            }
        }
        cache.is_loading = true;
    }

    // Step 1: Fetch compact data (id + mean only)
    let compact_url = format!(
        "{}?league={}&all=true",
        POE_WATCH_COMPACT,
        urlencoding::encode(&league),
    );

    let compact_resp = state.http_client
        .get(&compact_url)
        .send()
        .await
        .map_err(|e| Error::Network(e.to_string()))?;

    if !compact_resp.status().is_success() {
        let mut cache = state.compact_prices.lock().await;
        cache.is_loading = false;
        return Err(Error::Network(format!(
            "poe.watch compact fetch failed: {}",
            compact_resp.status()
        )));
    }

    let compact_raw: serde_json::Value = compact_resp
        .json()
        .await
        .map_err(|e| Error::Parse(e.to_string()))?;

    // Build id→mean map from compact data
    let mut id_to_mean: HashMap<i64, f64> = HashMap::new();
    if let Some(arr) = compact_raw.as_array() {
        for entry in arr {
            if let (Some(id), Some(mean)) = (entry["id"].as_i64(), entry["mean"].as_f64()) {
                if mean > 0.0 {
                    id_to_mean.insert(id, mean);
                }
            }
        }
    }

    // Step 2: Fetch itemdata (id + name mapping) from the get endpoint with category=all
    let itemdata_url = format!(
        "{}?league={}&category=all",
        POE_WATCH_GET,
        urlencoding::encode(&league),
    );

    let itemdata_resp = state.http_client
        .get(&itemdata_url)
        .send()
        .await;

    let mut name_to_price: HashMap<String, f64> = HashMap::new();

    match itemdata_resp {
        Ok(resp) if resp.status().is_success() => {
            let raw: serde_json::Value = resp
                .json()
                .await
                .map_err(|e| Error::Parse(e.to_string()))?;

            if let Some(arr) = raw.as_array() {
                for item in arr {
                    if let (Some(id), Some(name)) = (item["id"].as_i64(), item["name"].as_str()) {
                        if let Some(&mean) = id_to_mean.get(&id) {
                            let key = name.to_lowercase();
                            // Keep the first (usually more relevant) entry per name
                            name_to_price.entry(key).or_insert(mean);
                        }
                    }
                }
            }
        }
        _ => {
            // If itemdata fails, fall back to compact-only (no name resolution)
            // Still usable but lookup_prices won't find matches
        }
    }

    let count = name_to_price.len() as u32;

    {
        let mut cache = state.compact_prices.lock().await;
        cache.prices = name_to_price;
        cache.fetched_at = Some(std::time::Instant::now());
        cache.is_loading = false;
    }

    Ok(count)
}

/// Looks up prices for a list of item names from the compact cache.
/// Must call fetch_all_prices first. Returns name→chaos price map.
#[tauri::command]
pub async fn lookup_item_prices(
    item_names: Vec<String>,
    _league: String,
    state: State<'_, AppState>,
) -> Result<HashMap<String, f64>> {
    let cache = state.compact_prices.lock().await;
    let mut result = HashMap::new();

    for name in &item_names {
        let key = name.to_lowercase();
        if let Some(&price) = cache.prices.get(&key) {
            result.insert(name.clone(), price);
        }
    }

    Ok(result)
}

/// Returns whether compact prices are currently being fetched.
#[tauri::command]
pub async fn is_prices_loading(
    state: State<'_, AppState>,
) -> Result<bool> {
    let cache = state.compact_prices.lock().await;
    Ok(cache.is_loading)
}

/// Legacy per-category price fetch — kept for strategy builder item picker.
#[tauri::command]
pub async fn get_prices(
    category: String,
    league: String,
    state: State<'_, AppState>,
) -> Result<Vec<crate::state::PoeWatchItem>> {
    // Try compact cache first for simple name lookups
    let actual_category = match category.as_str() {
        "chisel" | "astrolabe" => "currency",
        other => other,
    };

    let key = format!("{}:{}", league, actual_category);

    // Check per-category cache
    {
        let cache = state.price_cache.lock().await;
        if let Some(entry) = cache.entries.get(&key) {
            if entry.fetched_at.elapsed().as_secs() < cache.ttl_secs {
                let items = filter_virtual(&category, entry.items.clone());
                return Ok(items);
            }
        }
    }

    // Fetch from poe.watch per-category endpoint
    let url = format!(
        "{}?league={}&category={}",
        POE_WATCH_GET,
        urlencoding::encode(&league),
        urlencoding::encode(actual_category),
    );

    let resp = state.http_client
        .get(&url)
        .send()
        .await
        .map_err(|e| Error::Network(e.to_string()))?;

    if !resp.status().is_success() {
        let cache = state.price_cache.lock().await;
        if let Some(entry) = cache.entries.get(&key) {
            return Ok(filter_virtual(&category, entry.items.clone()));
        }
        return Err(Error::Network(format!("poe.watch fetch failed: {}", resp.status())));
    }

    let raw: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| Error::Parse(e.to_string()))?;

    let items: Vec<crate::state::PoeWatchItem> = raw
        .as_array()
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|obj| {
            Some(crate::state::PoeWatchItem {
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

    Ok(filter_virtual(&category, items))
}

fn filter_virtual(category: &str, items: Vec<crate::state::PoeWatchItem>) -> Vec<crate::state::PoeWatchItem> {
    match category {
        "chisel" => items.into_iter().filter(|i| i.name == "Cartographer's Chisel").collect(),
        "astrolabe" => items.into_iter().filter(|i| i.name == "Astrolabe").collect(),
        _ => items,
    }
}
