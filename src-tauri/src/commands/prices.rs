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

    // Fetch all items from compact endpoint — returns { items: [{id, name, mean, ...}] }
    let url = format!(
        "{}?league={}&all=true",
        POE_WATCH_COMPACT,
        urlencoding::encode(&league),
    );

    let resp = state.http_client
        .get(&url)
        .send()
        .await
        .map_err(|e| Error::Network(e.to_string()))?;

    if !resp.status().is_success() {
        let mut cache = state.compact_prices.lock().await;
        cache.is_loading = false;
        return Err(Error::Network(format!(
            "poe.watch compact fetch failed: {}",
            resp.status()
        )));
    }

    let raw: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| Error::Parse(e.to_string()))?;

    // Response is { items: [ {id, name, mean, category, frame, ...}, ... ] }
    let items_arr = raw
        .get("items")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    // (mean, daily, low_confidence) per name — keep highest daily volume entry
    let mut name_entries: HashMap<String, (f64, f64, bool)> = HashMap::new();

    for item in &items_arr {
        let name = match item["name"].as_str() {
            Some(n) if !n.is_empty() => n,
            _ => continue,
        };
        let mean = match item["mean"].as_f64() {
            Some(m) if m > 0.0 => m,
            _ => continue,
        };

        let low_confidence = item["lowConfidence"].as_bool().unwrap_or(true);
        let daily = item["daily"].as_f64().unwrap_or(0.0);
        let key = name.to_lowercase();

        let existing_daily = name_entries.get(&key).map(|(_, d, _)| *d).unwrap_or(0.0);
        if daily > existing_daily {
            name_entries.insert(key, (mean, daily, low_confidence));
        }
    }

    // Store name → (price, low_confidence) in cache
    let name_to_price: HashMap<String, (f64, bool)> = name_entries
        .into_iter()
        .map(|(k, (mean, _, low_conf))| (k, (mean, low_conf)))
        .collect();

    let count = name_to_price.len() as u32;

    {
        let mut cache = state.compact_prices.lock().await;
        cache.prices = name_to_price;
        cache.fetched_at = Some(std::time::Instant::now());
        cache.is_loading = false;
    }

    Ok(count)
}

/// Price lookup result for a single item.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PriceLookupEntry {
    pub mean: f64,
    pub low_confidence: bool,
}

/// Looks up prices for a list of item names from the compact cache.
/// Must call fetch_all_prices first. Returns name→{mean, lowConfidence} map.
#[tauri::command]
pub async fn lookup_item_prices(
    item_names: Vec<String>,
    _league: String,
    state: State<'_, AppState>,
) -> Result<HashMap<String, PriceLookupEntry>> {
    let cache = state.compact_prices.lock().await;
    let mut result = HashMap::new();

    for name in &item_names {
        let key = name.to_lowercase();
        if let Some(&(mean, low_confidence)) = cache.prices.get(&key) {
            result.insert(name.clone(), PriceLookupEntry { mean, low_confidence });
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
        "deliriumOrb" => "delirium",
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
        "chisel" => items.into_iter().filter(|i| i.name.to_lowercase().contains("chisel")).collect(),
        "astrolabe" => items.into_iter().filter(|i| i.name.to_lowercase().contains("astrolabe")).collect(),
        _ => items,
    }
}
