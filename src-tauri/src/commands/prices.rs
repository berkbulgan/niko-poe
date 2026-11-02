// ABOUTME: poe.ninja price commands — fetches currency and item overviews for bulk pricing.
// ABOUTME: fetch_all_prices loads all categories; lookup_prices resolves items with advanced matching.

use std::collections::HashMap;
use tauri::State;

use crate::error::Result;
use crate::state::{AppState, NinjaPrice};

const NINJA_BASE: &str = "https://poe.ninja/poe1/api/economy";
/// poe.ninja asks API clients for a User-Agent that names the app and a contact.
const NINJA_USER_AGENT: &str =
    concat!("N.I.K.O./", env!("CARGO_PKG_VERSION"), " (+https://github.com/berkbulgan/niko-poe)");

/// Bulk-tradeable types, served by the currency exchange endpoint.
const EXCHANGE_TYPES: &[&str] = &[
    "Currency",
    "Fragment",
    "Astrolabe",
    "Oil",
    "Scarab",
    "Fossil",
    "Resonator",
    "Essence",
    "DivinationCard",
    "Tattoo",
    "Omen",
    "DeliriumOrb",
    "Artifact",
    "AllflameEmber",
];

/// Types priced from stash listings (uniques, gems, maps...), served by the item overview endpoint.
const ITEM_TYPES: &[&str] = &[
    "Incubator",
    "SkillGem",
    "UniqueMap",
    "Map",
    "UniqueJewel",
    "UniqueFlask",
    "UniqueWeapon",
    "UniqueArmour",
    "UniqueRelic",
    "UniqueAccessory",
    "Beast",
    "Vial",
    "Invitation",
    "Memory",
    "BlightedMap",
    "BlightRavagedMap",
];


/// Fetches all poe.ninja prices for a league (currency + item overviews).
/// Called when the user selects a league. Invalidates cache if league changed.
/// Returns the total number of priced items loaded.
#[tauri::command]
pub async fn fetch_all_prices(
    league: String,
    state: State<'_, AppState>,
) -> Result<u32> {
    // Check if cache is still fresh AND for the same league
    {
        let mut cache = state.ninja_prices.lock().await;
        let same_league = cache.league.as_deref() == Some(&league);
        if same_league {
            if let Some(fetched_at) = cache.fetched_at {
                if fetched_at.elapsed().as_secs() < cache.ttl_secs {
                    // Switched back to the cached league: drop any in-flight fetch for another one.
                    cache.loading_league = None;
                    let count: usize = cache.prices.values().map(|v| v.len()).sum();
                    return Ok(count as u32);
                }
            }
        }
    }

    {
        let mut cache = state.ninja_prices.lock().await;
        cache.loading_league = Some(league.clone());
    }

    let client = &state.http_client;
    let mut all_prices: HashMap<String, Vec<NinjaPrice>> = HashMap::new();

    // Fetch currency exchange overviews
    for exchange_type in EXCHANGE_TYPES {
        let url = format!(
            "{}/exchange/current/overview?league={}&type={}",
            NINJA_BASE,
            urlencoding::encode(&league),
            exchange_type,
        );

        match fetch_exchange_overview(client, &url, exchange_type).await {
            Ok(prices) => {
                for price in prices {
                    let key = price.name.to_lowercase();
                    all_prices.entry(key).or_default().push(price);
                }
            }
            Err(e) => {
                eprintln!("poe.ninja exchange fetch failed for {}: {}", exchange_type, e);
            }
        }
    }

    // Fetch item overviews
    for item_type in ITEM_TYPES {
        let url = format!(
            "{}/stash/current/item/overview?league={}&type={}",
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
        // The user switched league while this fetch ran; the newer fetch owns the cache.
        if cache.loading_league.as_deref() != Some(league.as_str()) {
            return Ok(total as u32);
        }
        cache.loading_league = None;
        cache.league = Some(league);
        cache.prices = all_prices;
        // Don't cache an empty (failed) fetch for an hour — let the next call retry.
        cache.fetched_at = (total > 0).then(std::time::Instant::now);
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
    league: String,
    state: State<'_, AppState>,
) -> Result<HashMap<String, PriceLookupEntry>> {
    let cache = state.ninja_prices.lock().await;
    let mut result = HashMap::new();
    if cache.league.as_deref() != Some(league.as_str()) {
        return Ok(result);
    }

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
    league: String,
    state: State<'_, AppState>,
) -> Result<HashMap<String, PriceLookupEntry>> {
    let cache = state.ninja_prices.lock().await;
    let mut result = HashMap::new();
    if cache.league.as_deref() != Some(league.as_str()) {
        return Ok(result);
    }

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
    Ok(cache.loading_league.is_some())
}

/// Returns all prices for a specific category (for strategy builder item picker).
#[tauri::command]
pub async fn get_prices(
    category: String,
    league: String,
    state: State<'_, AppState>,
) -> Result<Vec<NinjaPrice>> {
    let cache = state.ninja_prices.lock().await;
    if cache.league.as_deref() != Some(league.as_str()) {
        return Ok(Vec::new());
    }

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
        "currency" | "chisel" => "currency".to_string(),
        "astrolabe" => "astrolabe".to_string(),
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
            // poe.ninja omits 0 quality and non-corrupted flags, so missing means 0 / false.
            let exact = entries.iter().find(|e| {
                e.gem_level == Some(level)
                    && e.gem_quality.unwrap_or(0) == quality
                    && e.corrupted.unwrap_or(false) == corrupted
            });
            if exact.is_some() {
                return exact;
            }

            // Try matching level + quality without corruption
            let partial = entries.iter().find(|e| {
                e.gem_level == Some(level) && e.gem_quality.unwrap_or(0) == quality
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

/// Fetch a currency exchange overview from poe.ninja and convert to NinjaPrice entries.
async fn fetch_exchange_overview(
    client: &reqwest::Client,
    url: &str,
    category: &str,
) -> std::result::Result<Vec<NinjaPrice>, String> {
    let resp = client
        .get(url)
        .header("User-Agent", NINJA_USER_AGENT)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }

    let raw: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(parse_exchange_overview(&raw, category))
}

/// Exchange overviews list prices (`lines`, chaos value in `primaryValue`) and names/icons (`items`) by id.
fn parse_exchange_overview(raw: &serde_json::Value, category: &str) -> Vec<NinjaPrice> {
    let empty = Vec::new();
    let items = raw["items"].as_array().unwrap_or(&empty);
    let item_by_id: HashMap<&str, &serde_json::Value> =
        items.iter().filter_map(|i| Some((i["id"].as_str()?, i))).collect();
    let icon_of = |item: &serde_json::Value| match item["image"].as_str() {
        Some(path) if path.starts_with('/') => format!("https://web.poecdn.com{path}"),
        Some(url) => url.to_string(),
        None => String::new(),
    };
    let frame_type = if category == "DivinationCard" { 6 } else { 5 };

    let mut prices = Vec::new();
    for line in raw["lines"].as_array().unwrap_or(&empty) {
        let Some(item) = line["id"].as_str().and_then(|id| item_by_id.get(id)) else { continue };
        let name = match item["name"].as_str() {
            Some(n) if !n.is_empty() => n,
            _ => continue,
        };
        let chaos_value = match line["primaryValue"].as_f64() {
            Some(v) if v > 0.0 => v,
            _ => continue,
        };

        prices.push(NinjaPrice {
            name: name.to_string(),
            chaos_value,
            icon: icon_of(item),
            category: category.to_lowercase(),
            frame_type: Some(frame_type),
            links: None,
            variant: None,
            gem_level: None,
            gem_quality: None,
            corrupted: None,
            map_tier: None,
            base_type: None,
            item_level: None,
            listing_count: None,
            details_id: item["detailsId"].as_str().map(|s| s.to_string()),
        });
    }

    // Chaos Orb is the reference currency; add it if this overview leaves it out.
    if category == "Currency" && !prices.iter().any(|p| p.name == "Chaos Orb") {
        prices.push(chaos_orb(String::new()));
    }

    prices
}

fn chaos_orb(icon: String) -> NinjaPrice {
    NinjaPrice {
        name: "Chaos Orb".to_string(),
        chaos_value: 1.0,
        icon,
        category: "currency".to_string(),
        frame_type: Some(5),
        links: None,
        variant: None,
        gem_level: None,
        gem_quality: None,
        corrupted: None,
        map_tier: None,
        base_type: None,
        item_level: None,
        listing_count: None,
        details_id: None,
    }
}

/// Fetch an item overview from poe.ninja and convert to NinjaPrice entries.
async fn fetch_item_overview(
    client: &reqwest::Client,
    url: &str,
    category: &str,
) -> std::result::Result<Vec<NinjaPrice>, String> {
    let resp = client
        .get(url)
        .header("User-Agent", NINJA_USER_AGENT)
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

#[cfg(test)]
mod tests {
    use super::*;

    fn gem(level: i32, quality: Option<i32>, corrupted: Option<bool>, value: f64) -> NinjaPrice {
        NinjaPrice {
            gem_level: Some(level),
            gem_quality: quality,
            corrupted,
            chaos_value: value,
            listing_count: Some(if value == 1.0 { 999 } else { 1 }),
            ..chaos_orb(String::new())
        }
    }

    fn lookup(level: i32, quality: i32, corrupted: bool) -> AdvancedLookupItem {
        AdvancedLookupItem {
            name: "Enlighten Support".into(),
            frame_type: Some(4),
            links: None,
            gem_level: Some(level),
            gem_quality: Some(quality),
            corrupted: Some(corrupted),
            map_tier: None,
            variant: None,
            base_type: None,
            item_level: None,
        }
    }

    #[test]
    fn exchange_overview_joins_lines_to_items_by_id() {
        let raw = serde_json::json!({
            "core": { "primary": "chaos" },
            "lines": [
                { "id": "divine", "primaryValue": 680.6 },
                { "id": "unpriced", "primaryValue": 0 },
                { "id": "missing-item", "primaryValue": 3.0 }
            ],
            "items": [
                { "id": "divine", "name": "Divine Orb", "image": "/gen/image/x/CurrencyModValues.png", "detailsId": "divine-orb" },
                { "id": "unpriced", "name": "Unpriced Orb", "image": "/gen/image/y.png" }
            ]
        });
        let prices = parse_exchange_overview(&raw, "Currency");
        let names: Vec<&str> = prices.iter().map(|p| p.name.as_str()).collect();
        assert_eq!(names, vec!["Divine Orb", "Chaos Orb"]);
        assert_eq!(prices[0].chaos_value, 680.6);
        assert_eq!(prices[0].icon, "https://web.poecdn.com/gen/image/x/CurrencyModValues.png");
        assert_eq!(prices[0].category, "currency");
        assert_eq!(prices[0].details_id.as_deref(), Some("divine-orb"));
    }

    #[test]
    fn gem_without_quality_or_corruption_matches_its_own_entry() {
        let entries = vec![
            gem(1, None, None, 1.0),
            gem(3, None, None, 500.0),
            gem(4, Some(20), Some(true), 9000.0),
        ];
        assert_eq!(find_best_match(&entries, &lookup(3, 0, false)).unwrap().chaos_value, 500.0);
        assert_eq!(find_best_match(&entries, &lookup(4, 20, true)).unwrap().chaos_value, 9000.0);
    }
}
