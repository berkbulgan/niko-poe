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
/// Returns `Error::Auth` if no token is present.
/// Returns `Error::Auth` with a scope message if GGG responds with 403.
#[tauri::command]
pub async fn get_stash_tabs(
    league: String,
    state: State<'_, AppState>,
) -> Result<Vec<StashTab>> {
    let access_token = require_access_token(&state).await?;

    let url = format!("{}/{}", GGG_STASH_BASE, urlencoding::encode(&league));

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .bearer_auth(&access_token)
        .header("User-Agent", "OAuth niko/1.0.0 (contact: niko@example.com)")
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

    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(Error::Network(format!(
            "stash tabs request failed: HTTP {} — {}",
            status, body
        )));
    }

    let parsed: StashTabsResponse = response
        .json()
        .await
        .map_err(|e| Error::Parse(e.to_string()))?;

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
    state: State<'_, AppState>,
) -> Result<Vec<StashItem>> {
    let access_token = require_access_token(&state).await?;

    let url = format!(
        "{}/{}/{}",
        GGG_STASH_BASE,
        urlencoding::encode(&league),
        urlencoding::encode(&stash_id),
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .bearer_auth(&access_token)
        .header("User-Agent", "OAuth niko/1.0.0 (contact: niko@example.com)")
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

    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(Error::Network(format!(
            "stash tab contents request failed: HTTP {} — {}",
            status, body
        )));
    }

    let parsed: StashTabContentsResponse = response
        .json()
        .await
        .map_err(|e| Error::Parse(e.to_string()))?;

    Ok(parsed.stash.items)
}

/// Extracts the current access token from AppState.
/// Returns `Error::Auth` if no token is stored (user not logged in).
async fn require_access_token(state: &AppState) -> Result<String> {
    let guard = state.ggg_token.lock().await;
    guard
        .as_ref()
        .map(|t| t.access_token.clone())
        .ok_or_else(|| Error::Auth("not logged in — no GGG token available".into()))
}
