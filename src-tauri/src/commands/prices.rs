// ABOUTME: poe.ninja price commands — fetches currency and item overviews for bulk pricing.
// ABOUTME: fetch_all_prices loads all categories; lookup_prices resolves items with advanced matching.

use std::collections::HashMap;
use tauri::State;

use crate::error::Result;
use crate::state::{AppState, NinjaPrice};

const NINJA_BASE: &str = "https://poe.ninja/api/data";

/// All poe.ninja currency overview types (use currencyoverview endpoint).
const CURRENCY_TYPES: &[&str] = &["Currency", "Fragment"];

/// All poe.ninja item overview types (use itemoverview endpoint).
const ITEM_TYPES: &[&str] = &[
    "Oil",
    "Incubator",
    "Scarab",
    "Fossil",
    "Resonator",
    "Essence",
    "DivinationCard",
    "SkillGem",
    "Tattoo",
    "Omen",
    "UniqueMap",
    "Map",
    "UniqueJewel",
    "UniqueFlask",
    "UniqueWeapon",
    "UniqueArmour",
    "UniqueRelic",
    "UniqueAccessory",
    "DeliriumOrb",
    "Beast",
    "Vial",
    "Invitation",
    "Artifact",
    "Memory",
    "BlightedMap",
    "BlightRavagedMap",
    "Coffin",
    "AllflameEmber",
    "KalguuranRune",
];

/// Fetches all poe.ninja prices for a league (currency + item overviews).
/// Called at app startup. Stores everything in NinjaPriceCache.
/// Returns the total number of priced items loaded.
#[tauri::command]
pub async fn fetch_all_prices(
    league: String,
    state: State<'_, AppState>,
) -> Result<u32> {
    // Check if cache is still fresh
    {
        let cache = state.ninja_prices.lock().await;
        if let Some(fetched_at) = cache.fetched_at {
            if fetched_at.elapsed().as_secs() < cache.ttl_secs {
                let count: usize = cache.prices.values().map(|v| v.len()).sum();
                return Ok(count as u32);
            }
        }
    }

    {
        let mut cache = state.ninja_prices.lock().await;
        cache.is_loading = true;
    }

    let client = &state.http_client;
    let mut all_prices: HashMap<String, Vec<NinjaPrice>> = HashMap::new();

    // Fetch currency overviews
    for currency_type in CURRENCY_TYPES {
        let url = format!(
            "{}/currencyoverview?league={}&type={}",
            NINJA_BASE,
            urlencoding::encode(&league),
            currency_type,
        );

        match fetch_currency_overview(client, &url, currency_type).await {
            Ok(prices) => {
                for price in prices {
                    let key = price.name.to_lowercase();
                    all_prices.entry(key).or_default().push(price);
                }
            }
            Err(e) => {
                eprintln!("poe.ninja currency fetch failed for {}: {}", currency_type, e);
            }
        }
    }

    // Fetch item overviews
    for item_type in ITEM_TYPES {
        let url = format!(
            "{}/itemoverview?league={}&type={}",
            NINJA_BASE,
            urlencoding::encode(&league),
            item_type,
        );

        match fetch_item_overview(client, &url, item_type).await {
            Ok(prices) => {
                for price in prices {
                    let key = price.name.to_lowercase();
                    all_prices.entry(key).or_default().push(price);
                }
            }
            Err(e) => {
                eprintln!("poe.ninja item fetch failed for {}: {}", item_type, e);
            }
        }

        // Rate limit: ~100ms between requests to be polite to poe.ninja
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }

    let total: usize = all_prices.values().map(|v| v.len()).sum();

    {
        let mut cache = state.ninja_prices.lock().await;
        cache.prices = all_prices;
        cache.fetched_at = Some(std::time::Instant::now());
        cache.is_loading = false;
    }

    Ok(total as u32)
}

/// Price lookup result for a single item.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PriceLookupEntry {
    pub chaos_value: f64,
    pub icon: String,
    pub category: String,
    pub listing_count: Option<i32>,
}

/// Looks up prices for a list of item names from the ninja cache.
/// Uses simple name matching. For advanced matching, use lookup_item_prices_advanced.
#[tauri::command]
pub async fn lookup_item_prices(
    item_names: Vec<String>,
    _league: String,
    state: State<'_, AppState>,
) -> Result<HashMap<String, PriceLookupEntry>> {
    let cache = state.ninja_prices.lock().await;
    let mut result = HashMap::new();

    for name in &item_names {
        let key = name.to_lowercase();
        if let Some(entries) = cache.prices.get(&key) {
            // Pick the entry with the highest listing count (most reliable)
            if let Some(best) = entries.iter().max_by_key(|e| e.listing_count.unwrap_or(0)) {
                result.insert(name.clone(), PriceLookupEntry {
                    chaos_value: best.chaos_value,
                    icon: best.icon.clone(),
                    category: best.category.clone(),
                    listing_count: best.listing_count,
                });
            }
        }
    }

    Ok(result)
}

/// Advanced price lookup matching item properties (links, gem level, variant, etc.).
#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvancedLookupItem {
    pub name: String,
    pub frame_type: Option<i32>,
    pub links: Option<i32>,
    pub gem_level: Option<i32>,
    pub gem_quality: Option<i32>,
    pub corrupted: Option<bool>,
    pub map_tier: Option<i32>,
    pub variant: Option<String>,
    pub base_type: Option<String>,
    pub item_level: Option<i32>,
}

#[tauri::command]
pub async fn lookup_item_prices_advanced(
    items: Vec<AdvancedLookupItem>,
    _league: String,
    state: State<'_, AppState>,
) -> Result<HashMap<String, PriceLookupEntry>> {
    let cache = state.ninja_prices.lock().await;
    let mut result = HashMap::new();

    for item in &items {
        let key = item.name.to_lowercase();
        if let Some(entries) = cache.prices.get(&key) {
            if let Some(matched) = find_best_match(entries, item) {
                result.insert(item.name.clone(), PriceLookupEntry {
                    chaos_value: matched.chaos_value,
                    icon: matched.icon.clone(),
                    category: matched.category.clone(),
                    listing_count: matched.listing_count,
                });
            }
        }
    }

    Ok(result)
}

/// Returns whether prices are currently being fetched.
#[tauri::command]
pub async fn is_prices_loading(
    state: State<'_, AppState>,
) -> Result<bool> {
    let cache = state.ninja_prices.lock().await;
    Ok(cache.is_loading)
}

/// Returns all prices for a specific category (for strategy builder item picker).
#[tauri::command]
pub async fn get_prices(
    category: String,
    _league: String,
    state: State<'_, AppState>,
) -> Result<Vec<NinjaPrice>> {
    let cache = state.ninja_prices.lock().await;

    let target_category = normalize_category(&category);

    let mut items: Vec<NinjaPrice> = cache
        .prices
        .values()
        .flatten()
        .filter(|p| p.category.to_lowercase() == target_category)
        .cloned()
        .collect();

    // Sort by chaos value descending
    items.sort_by(|a, b| b.chaos_value.partial_cmp(&a.chaos_value).unwrap_or(std::cmp::Ordering::Equal));

    Ok(items)
}

// ── Internal helpers ────────────────────────────────────────────────────────

/// Maps frontend category names to poe.ninja type names.
fn normalize_category(category: &str) -> String {
    match category {
        "scarab" => "scarab".to_string(),
        "deliriumOrb" | "delirium_orb" => "deliriumorb".to_string(),
        "currency" | "chisel" | "astrolabe" => "currency".to_string(),
        "fragment" => "fragment".to_string(),
        "divinationCard" | "divination" => "divinationcard".to_string(),
        "essence" => "essence".to_string(),
        "fossil" => "fossil".to_string(),
        "oil" => "oil".to_string(),
        "incubator" => "incubator".to_string(),
        "uniqueMap" => "uniquemap".to_string(),
        "map" => "map".to_string(),
        "skillGem" | "gem" => "skillgem".to_string(),
        "uniqueWeapon" => "uniqueweapon".to_string(),
        "uniqueArmour" => "uniquearmour".to_string(),
        "uniqueAccessory" => "uniqueaccessory".to_string(),
        "uniqueJewel" => "uniquejewel".to_string(),
        "uniqueFlask" => "uniqueflask".to_string(),
        "beast" => "beast".to_string(),
        other => other.to_lowercase(),
    }
}

/// Advanced matching: finds the best price entry for an item based on its properties.
fn find_best_match<'a>(entries: &'a [NinjaPrice], item: &AdvancedLookupItem) -> Option<&'a NinjaPrice> {
    let frame_type = item.frame_type.unwrap_or(-1);

    match frame_type {
        // Gem: match by name + gem_level + gem_quality + corrupted
        4 => {
            let level = item.gem_level.unwrap_or(1);
            let quality = item.gem_quality.unwrap_or(0);
            let corrupted = item.corrupted.unwrap_or(false);

            // Try exact match first
            let exact = entries.iter().find(|e| {
                e.gem_level == Some(level)
                    && e.gem_quality == Some(quality)
                    && e.corrupted == Some(corrupted)
            });
            if exact.is_some() {
                return exact;
            }

            // Try matching level + quality without corruption
            let partial = entries.iter().find(|e| {
                e.gem_level == Some(level) && e.gem_quality == Some(quality)
            });
            if partial.is_some() {
                return partial;
            }

            // Fall back to highest listing count
            entries.iter().max_by_key(|e| e.listing_count.unwrap_or(0))
        }

        // Unique: match by name + links + variant
        3 | 9 => {
            let links = item.links.unwrap_or(0);

            // Try exact variant + links match
            if item.variant.is_some() || links >= 5 {
                let exact = entries.iter().find(|e| {
                    let links_match = if links >= 5 { e.links == Some(links) } else { true };
                    let variant_match = match (&item.variant, &e.variant) {
                        (Some(iv), Some(ev)) => iv.to_lowercase() == ev.to_lowercase(),
                        (None, None) | (None, Some(_)) => true,
                        (Some(_), None) => false,
                    };
                    links_match && variant_match
                });
                if exact.is_some() {
                    return exact;
                }
            }

            // Fall back to entry without links/variant (base price)
            let base = entries.iter().find(|e| e.links.is_none() && e.variant.is_none());
            if base.is_some() {
                return base;
            }

            entries.iter().max_by_key(|e| e.listing_count.unwrap_or(0))
        }

        // Map: match by name + map_tier
        0 | 1 | 2 if item.map_tier.is_some() => {
            let tier = item.map_tier.unwrap_or(0);
            let exact = entries.iter().find(|e| e.map_tier == Some(tier));
            if exact.is_some() {
                return exact;
            }
            entries.iter().max_by_key(|e| e.listing_count.unwrap_or(0))
        }

        // Currency / Divination / Default: simple name match, highest listing count
        _ => entries.iter().max_by_key(|e| e.listing_count.unwrap_or(0)),
    }
}

/// Fetch a currency overview from poe.ninja and convert to NinjaPrice entries.
async fn fetch_currency_overview(
    client: &reqwest::Client,
    url: &str,
    category: &str,
) -> std::result::Result<Vec<NinjaPrice>, String> {
    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }

    let raw: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    // Build icon lookup from currencyDetails
    let mut icon_map: HashMap<String, String> = HashMap::new();
    if let Some(details) = raw.get("currencyDetails").and_then(|v| v.as_array()) {
        for d in details {
            if let (Some(name), Some(icon)) = (d["name"].as_str(), d["icon"].as_str()) {
                icon_map.insert(name.to_string(), icon.to_string());
            }
        }
    }

    let lines = raw
        .get("lines")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let mut prices = Vec::new();
    for line in &lines {
        let name = match line["currencyTypeName"].as_str() {
            Some(n) if !n.is_empty() => n,
            _ => continue,
        };
        let chaos_value = match line["chaosEquivalent"].as_f64() {
            Some(v) if v > 0.0 => v,
            _ => continue,
        };

        let icon = icon_map.get(name).cloned().unwrap_or_default();
        let count = line.get("receive")
            .and_then(|r| r["count"].as_i64())
            .map(|c| c as i32);

        let details_id = line["detailsId"].as_str().map(|s| s.to_string());

        prices.push(NinjaPrice {
            name: name.to_string(),
            chaos_value,
            icon,
            category: category.to_lowercase(),
            frame_type: Some(5),
            links: None,
            variant: None,
            gem_level: None,
            gem_quality: None,
            corrupted: None,
            map_tier: None,
            base_type: None,
            item_level: None,
            listing_count: count,
            details_id,
        });
    }

    Ok(prices)
}

/// Fetch an item overview from poe.ninja and convert to NinjaPrice entries.
async fn fetch_item_overview(
    client: &reqwest::Client,
    url: &str,
    category: &str,
) -> std::result::Result<Vec<NinjaPrice>, String> {
    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }

    let raw: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    let lines = raw
        .get("lines")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let mut prices = Vec::new();
    for line in &lines {
        let name = match line["name"].as_str() {
            Some(n) if !n.is_empty() => n,
            _ => continue,
        };
        let chaos_value = match line["chaosValue"].as_f64() {
            Some(v) if v > 0.0 => v,
            _ => continue,
        };

        let icon = line["icon"].as_str().unwrap_or("").to_string();
        let frame_type = line["itemClass"].as_i64().map(|v| v as i32);
        let links = line["links"].as_i64().filter(|&v| v > 0).map(|v| v as i32);
        let variant = line["variant"].as_str().filter(|s| !s.is_empty()).map(|s| s.to_string());
        let gem_level = line["gemLevel"].as_i64().filter(|&v| v > 0).map(|v| v as i32);
        let gem_quality = line["gemQuality"].as_i64().filter(|&v| v > 0).map(|v| v as i32);
        let corrupted = line["corrupted"].as_bool();
        let map_tier = line["mapTier"].as_i64().filter(|&v| v > 0).map(|v| v as i32);
        let base_type = line["baseType"].as_str().filter(|s| !s.is_empty()).map(|s| s.to_string());
        let item_level = line["levelRequired"].as_i64().filter(|&v| v > 0).map(|v| v as i32);
        let listing_count = line["count"].as_i64().map(|v| v as i32);
        let details_id = line["detailsId"].as_str().map(|s| s.to_string());

        prices.push(NinjaPrice {
            name: name.to_string(),
            chaos_value,
            icon,
            category: category.to_lowercase(),
            frame_type,
            links,
            variant,
            gem_level,
            gem_quality,
            corrupted,
            map_tier,
            base_type,
            item_level,
            listing_count,
            details_id,
        });
    }

    Ok(prices)
}
