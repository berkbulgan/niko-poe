// ABOUTME: Tauri IPC commands for GGG stash API — tab listing and item fetching.
// ABOUTME: Requires an authenticated GGG OAuth token stored in AppState.

use tauri::State;

use crate::error::{Error, Result};
use crate::state::AppState;

const GGG_STASH_BASE: &str = "https://api.pathofexile.com/stash";

/// Color value returned by the GGG stash API as an RGB triplet.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StashColor {
    pub r: u8,
    pub g: u8,
    pub b: u8,
}

/// A single stash tab entry returned by the GGG stash list endpoint.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StashTab {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub stash_type: String,
    pub index: u32,
    pub colour: Option<StashColor>,
    /// Child tabs (e.g. folders contain children).
    #[serde(default)]
    pub children: Vec<StashTab>,
}

/// Metadata field attached to an individual stash item.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemProperty {
    pub name: String,
    pub values: Vec<serde_json::Value>,
    pub display_mode: Option<i32>,
}

/// A single item returned inside a stash tab.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StashItem {
    pub id: String,
    pub name: String,
    pub type_line: String,
    pub icon: String,
    /// Current stack size (only present for stackable items).
    pub stack_size: Option<u32>,
    /// Maximum stack size for this item type.
    pub max_stack_size: Option<u32>,
    /// Price note set by the player (e.g. "~price 1 chaos").
    pub note: Option<String>,
    /// X position within the stash grid.
    pub x: Option<i32>,
    /// Y position within the stash grid.
    pub y: Option<i32>,
    pub identified: Option<bool>,
    pub corrupted: Option<bool>,
    pub ilvl: Option<u32>,
    /// Item rarity frame type: 0=Normal, 1=Magic, 2=Rare, 3=Unique, 4=Gem, 5=Currency, 6=Divination, 7=Quest, 8=Prophecy, 9=Foil
    #[serde(default)]
    pub frame_type: Option<u32>,
}

/// GGG stash tabs list response shape.
#[derive(Debug, serde::Deserialize)]
struct StashTabsResponse {
    stashes: Vec<StashTab>,
}

/// GGG single stash tab response shape.
#[derive(Debug, serde::Deserialize)]
struct StashTabContentsResponse {
    stash: StashTabDetail,
}

/// Detail payload for a single stash tab (includes items).
#[derive(Debug, serde::Deserialize)]
struct StashTabDetail {
    #[allow(dead_code)]
    id: String,
    #[allow(dead_code)]
    name: String,
    #[serde(default)]
    items: Vec<StashItem>,
}

/// Retrieves the list of stash tabs for the given league.
///
/// Requires a valid GGG OAuth token with the `account:stashes` scope.
/// Returns `Error::Auth` if no token is present or GGG rejects it.
#[tauri::command]
pub async fn get_stash_tabs(
    league: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<StashTab>> {
    let access_token = crate::commands::auth::access_token(&app, &state).await?;
    let url = format!("{}/{}", GGG_STASH_BASE, urlencoding::encode(&league));
    let parsed: StashTabsResponse = stash_get(&url, &access_token).await?;
    Ok(parsed.stashes)
}

/// Retrieves the items inside a specific stash tab.
///
/// Requires a valid GGG OAuth token with the `account:stashes` scope.
/// Returns `Error::Auth` if no token is present or if GGG rejects the request.
#[tauri::command]
pub async fn get_stash_tab_contents(
    league: String,
    stash_id: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<StashItem>> {
    let access_token = crate::commands::auth::access_token(&app, &state).await?;
    fetch_tab_items(&league, &stash_id, &access_token).await
}

/// Fetches the items of one stash tab. Shared by the stash page and snapshots.
pub(crate) async fn fetch_tab_items(
    league: &str,
    stash_id: &str,
    access_token: &str,
) -> Result<Vec<StashItem>> {
    let url = format!(
        "{}/{}/{}",
        GGG_STASH_BASE,
        urlencoding::encode(league),
        urlencoding::encode(stash_id),
    );
    let parsed: StashTabContentsResponse = stash_get(&url, access_token).await?;
    Ok(parsed.stash.items)
}

/// GET a GGG stash endpoint and map auth / rate-limit failures to readable errors.
async fn stash_get<T: serde::de::DeserializeOwned>(url: &str, access_token: &str) -> Result<T> {
    let response = reqwest::Client::new()
        .get(url)
        .bearer_auth(access_token)
        .header("User-Agent", crate::commands::auth::USER_AGENT)
        .send()
        .await
        .map_err(|e| Error::Network(e.to_string()))?;

    let status = response.status();

    if status == reqwest::StatusCode::FORBIDDEN {
        return Err(Error::Auth(
            "access denied — the account:stashes scope may not be available for this client"
                .into(),
        ));
    }

    if status == reqwest::StatusCode::UNAUTHORIZED {
        return Err(Error::Auth(
            "GGG token rejected — please log in again".into(),
        ));
    }

    if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
        let retry_after = response
            .headers()
            .get("Retry-After")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("a few");
        return Err(Error::Network(format!(
            "GGG rate limit reached — try again in {} seconds",
            retry_after
        )));
    }

    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(Error::Network(format!(
            "stash request failed: HTTP {} — {}",
            status, body
        )));
    }

    response
        .json()
        .await
        .map_err(|e| Error::Parse(e.to_string()))
}
