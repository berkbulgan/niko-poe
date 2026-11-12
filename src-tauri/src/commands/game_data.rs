// ABOUTME: Runtime game data from the N.I.K.O. community server, cached as JSON files under <app data>/game-data.
// ABOUTME: Map mod data: read the saved copy and refresh it with an ETag check. Files are written atomically.

use std::path::{Path, PathBuf};
use std::time::Duration;

use chrono::{DateTime, Utc};
use niko_community_api::{AtlasVersion, MapModData};
use reqwest::{header, Method};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Manager, State};
use tokio::sync::Mutex;

use crate::commands::community::request;
use crate::error::{Error, Result};
use crate::state::AppState;

/// Every game data request gives up after this long; the app then keeps what it has.
pub const SERVER_TIMEOUT: Duration = Duration::from_secs(10);
/// Atlas data.json and sprite downloads (up to a few MB each) get longer, so slow connections still finish.
const ATLAS_DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(60);
const MAP_MODS_FILE: &str = "map-mods.json";

/// `<app data dir>/game-data`, where all runtime game data lives.
pub fn game_data_dir(app: &AppHandle) -> Result<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| Error::Validation(format!("app data dir unavailable: {e}")))?;
    Ok(dir.join("game-data"))
}

/// `game-data/map-mods.json`: the last map mod data the server sent, and when it last answered.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CachedMapMods {
    pub patch: String,
    pub sha256: String,
    pub checked_at: DateTime<Utc>,
    pub data: MapModData,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum RefreshStatus {
    Updated,
    Unchanged,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MapModRefresh {
    pub status: RefreshStatus,
    /// The new data, only with `Updated`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<MapModData>,
    /// When the server answered; absent with `Failed`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub checked_at: Option<DateTime<Utc>>,
}

impl MapModRefresh {
    pub fn failed() -> Self {
        Self { status: RefreshStatus::Failed, data: None, checked_at: None }
    }
}

/// Writes `bytes` to `<path>.tmp`, then renames it over `path`, so a reader never sees a half-written file.
pub fn write_atomic(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut tmp = path.as_os_str().to_owned();
    tmp.push(".tmp");
    std::fs::write(&tmp, bytes)?;
    std::fs::rename(&tmp, path)
}

pub fn write_json<T: Serialize>(path: &Path, value: &T) -> std::io::Result<()> {
    write_atomic(path, &serde_json::to_vec(value)?)
}

/// The parsed file, or `None` when it is missing or does not parse (a corrupt file counts as missing).
pub fn read_json<T: DeserializeOwned>(path: &Path) -> Option<T> {
    serde_json::from_slice(&std::fs::read(path).ok()?).ok()
}

/// What a `/v1/data/mapmods` answer means: the cache file to write (if any) and the result for the UI.
/// 304, or a 200 with the hash already cached, only moves `checkedAt`. Anything else that is not a
/// parsable 200 is a failure and leaves the cache alone.
fn map_mod_outcome(
    status: u16,
    body: &str,
    cached: Option<CachedMapMods>,
    now: DateTime<Utc>,
) -> (Option<CachedMapMods>, MapModRefresh) {
    let unchanged = |c: CachedMapMods| {
        (
            Some(CachedMapMods { checked_at: now, ..c }),
            MapModRefresh { status: RefreshStatus::Unchanged, data: None, checked_at: Some(now) },
        )
    };
    match status {
        304 => cached.map_or_else(|| (None, MapModRefresh::failed()), unchanged),
        200 => match serde_json::from_str::<MapModData>(body) {
            Err(_) => (None, MapModRefresh::failed()),
            Ok(data) => match cached {
                Some(c) if c.sha256 == data.sha256 => unchanged(c),
                _ => (
                    Some(CachedMapMods {
                        patch: data.patch.clone(),
                        sha256: data.sha256.clone(),
                        checked_at: now,
                        data: data.clone(),
                    }),
                    MapModRefresh { status: RefreshStatus::Updated, data: Some(data), checked_at: Some(now) },
                ),
            },
        },
        _ => (None, MapModRefresh::failed()),
    }
}

/// The map mod data saved by an earlier refresh, or `None` when there is none (or it is corrupt).
#[tauri::command]
pub async fn map_mod_data_cached(app: AppHandle) -> Result<Option<CachedMapMods>> {
    Ok(read_json(&game_data_dir(&app)?.join(MAP_MODS_FILE)))
}

/// Asks the server for newer map mod data (ETag check against the saved copy) and saves it.
/// Server problems (no URL configured, offline, timeout, 429, 503, bad body) return `Failed`, not an error.
#[tauri::command]
pub async fn refresh_map_mod_data(app: AppHandle, state: State<'_, AppState>) -> Result<MapModRefresh> {
    let path = game_data_dir(&app)?.join(MAP_MODS_FILE);
    let cached: Option<CachedMapMods> = read_json(&path);
    let mut req = match request(&state, Method::GET, "/v1/data/mapmods").await {
        Ok(req) => req.timeout(SERVER_TIMEOUT),
        Err(_) => return Ok(MapModRefresh::failed()),
    };
    if let Some(cached) = &cached {
        // The server compares the quoted ETag byte for byte.
        req = req.header(header::IF_NONE_MATCH, format!("\"{}\"", cached.sha256));
    }
    let (status, body) = match req.send().await {
        Ok(res) => (res.status().as_u16(), res.text().await.unwrap_or_default()),
        Err(e) => {
            eprintln!("map mod data refresh failed: {e}");
            return Ok(MapModRefresh::failed());
        }
    };
    let (file, result) = map_mod_outcome(status, &body, cached, Utc::now());
    if let Some(file) = file {
        if let Err(e) = write_json(&path, &file) {
            eprintln!("could not save map mod data: {e}");
        }
    }
    Ok(result)
}

// --- Atlas tree data: game-data/atlas/index.json, game-data/atlas/<tag>/{data.json, assets/} ---

/// `game-data/atlas/index.json`: the server's atlas tag list as last fetched.
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AtlasIndex {
    checked_at: DateTime<Utc>,
    versions: Vec<AtlasVersion>,
}

/// One atlas tag's files on disk. `data_json` is GGG's data.json as served; sprites are in `asset_dir`.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AtlasPatchFiles {
    pub tag: String,
    pub data_json: String,
    pub asset_dir: String,
}

/// One tag downloads at a time: a cold tag is ~42 requests against the server's 120/minute read limit.
// ponytail: also makes on-disk reads of another tag wait behind a running download; per-tag locks if that is noticeable.
static ATLAS_DOWNLOAD: Mutex<()> = Mutex::const_new(());

/// GGG release tags are `X.Y.Z`; nothing else is used as a directory name.
fn is_atlas_tag(tag: &str) -> bool {
    let parts: Vec<&str> = tag.split('.').collect();
    parts.len() == 3 && parts.iter().all(|p| !p.is_empty() && p.bytes().all(|b| b.is_ascii_digit()))
}

/// `<game-data>/atlas/<tag>`
fn atlas_dir(root: &Path, tag: &str) -> PathBuf {
    root.join("atlas").join(tag)
}

/// Plain file names only: these come from downloaded JSON and become paths.
fn is_safe_filename(name: &str) -> bool {
    !name.is_empty() && !name.starts_with('.') && name.bytes().all(|b| b.is_ascii_alphanumeric() || b"-_.".contains(&b))
}

/// Sprite sheet files named in a GGG data.json: the last path segment of every `sprites.*.*.filename` URL, without its query.
fn sprite_files(data: &Value) -> Vec<String> {
    let mut names: Vec<String> = data["sprites"]
        .as_object()
        .into_iter()
        .flat_map(|categories| categories.values())
        .filter_map(|zooms| zooms.as_object())
        .flat_map(|zooms| zooms.values())
        .filter_map(|entry| entry["filename"].as_str())
        .filter_map(|url| url.split('?').next()?.rsplit('/').next())
        .filter(|name| is_safe_filename(name))
        .map(str::to_string)
        .collect();
    names.sort();
    names.dedup();
    names
}

/// The names not yet in `<dir>/assets`.
fn missing_assets(dir: &Path, names: &[String]) -> Vec<String> {
    names.iter().filter(|name| !dir.join("assets").join(name).is_file()).cloned().collect()
}

/// A stored data.json and its parsed value; `None` when it is missing or does not parse.
fn read_atlas_data(path: &Path) -> Option<(String, Value)> {
    let text = std::fs::read_to_string(path).ok()?;
    let value = serde_json::from_str(&text).ok()?;
    Some((text, value))
}

/// 404 bodies reuse a generic server error, so only the status is reported.
fn status_error(status: u16) -> Error {
    if status == 429 {
        Error::Network("game data server is busy, try again later".into())
    } else {
        Error::Network(format!("game data server returned HTTP {status}"))
    }
}

/// `write_atomic` with the crate error type (there is no `From<std::io::Error>`).
fn save(path: &Path, bytes: &[u8]) -> Result<()> {
    write_atomic(path, bytes).map_err(|e| Error::Validation(format!("could not save {}: {e}", path.display())))
}

/// GET on the community server, giving up after `timeout`. Errors when no server is configured or it is unreachable.
async fn fetch(state: &AppState, path: &str, timeout: Duration) -> Result<reqwest::Response> {
    request(state, Method::GET, path)
        .await?
        .timeout(timeout)
        .send()
        .await
        .map_err(|e| Error::Network(format!("game data server unreachable: {e}")))
}

async fn fetch_atlas_versions(state: &AppState) -> Result<Vec<AtlasVersion>> {
    let res = fetch(state, "/v1/data/atlas", SERVER_TIMEOUT).await?;
    if !res.status().is_success() {
        return Err(status_error(res.status().as_u16()));
    }
    res.json().await.map_err(|e| Error::Parse(format!("bad atlas tag list: {e}")))
}

/// The atlas tag list, newest first: the cached one, or with `refresh` the server's (saved as the new cache).
/// A refresh the server does not answer is an error, so the caller can tell it from an answer.
#[tauri::command]
pub async fn atlas_versions(app: AppHandle, state: State<'_, AppState>, refresh: bool) -> Result<Vec<AtlasVersion>> {
    let path = game_data_dir(&app)?.join("atlas").join("index.json");
    if refresh {
        let index = AtlasIndex { checked_at: Utc::now(), versions: fetch_atlas_versions(&state).await? };
        if let Err(e) = write_json(&path, &index) {
            eprintln!("could not save the atlas tag list: {e}");
        }
        return Ok(index.versions);
    }
    Ok(read_json::<AtlasIndex>(&path).map(|index| index.versions).unwrap_or_default())
}

/// Makes sure a tag's data.json and sprites are on disk, downloading only what is missing.
/// `None` when the tag is neither on disk nor on the server.
#[tauri::command]
pub async fn atlas_data(app: AppHandle, state: State<'_, AppState>, tag: String) -> Result<Option<AtlasPatchFiles>> {
    if !is_atlas_tag(&tag) {
        return Err(Error::Validation(format!("invalid atlas tag: {tag}")));
    }
    let _one_tag_at_a_time = ATLAS_DOWNLOAD.lock().await;
    let dir = atlas_dir(&game_data_dir(&app)?, &tag);
    let data_path = dir.join("data.json");
    let (data_json, data) = match read_atlas_data(&data_path) {
        Some(stored) => stored,
        None => {
            let res = fetch(&state, &format!("/v1/data/atlas/{tag}"), ATLAS_DOWNLOAD_TIMEOUT).await?;
            match res.status().as_u16() {
                200 => {}
                404 => return Ok(None),
                status => return Err(status_error(status)),
            }
            let text = res.text().await.map_err(|e| Error::Network(format!("failed to read atlas data: {e}")))?;
            let value: Value = serde_json::from_str(&text)?;
            save(&data_path, text.as_bytes())?;
            (text, value)
        }
    };
    // Files already written stay when a download fails (429 included); the next call fetches only the rest.
    for name in missing_assets(&dir, &sprite_files(&data)) {
        let res = fetch(&state, &format!("/v1/data/atlas/{tag}/assets/{name}"), ATLAS_DOWNLOAD_TIMEOUT).await?;
        if !res.status().is_success() {
            return Err(status_error(res.status().as_u16()));
        }
        let bytes = res.bytes().await.map_err(|e| Error::Network(format!("failed to read atlas asset {name}: {e}")))?;
        save(&dir.join("assets").join(&name), &bytes)?;
    }
    let asset_dir = dir.join("assets").to_string_lossy().into_owned();
    Ok(Some(AtlasPatchFiles { tag, data_json, asset_dir }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use std::path::PathBuf;

    fn scratch_dir() -> PathBuf {
        std::env::temp_dir().join(format!("niko-game-data-{}", uuid::Uuid::new_v4()))
    }

    fn at(s: &str) -> DateTime<Utc> {
        s.parse().unwrap()
    }

    fn map_mods(sha256: &str) -> MapModData {
        MapModData {
            patch: "3.30.0.1".into(),
            sha256: sha256.into(),
            tokens: vec![serde_json::json!({ "id": 1, "regex": "r", "rawText": "t" })],
            optimization_table: serde_json::json!({}),
            aliases: HashMap::from([("5".to_string(), 7)]),
        }
    }

    fn cached(sha256: &str, checked_at: DateTime<Utc>) -> CachedMapMods {
        let data = map_mods(sha256);
        CachedMapMods { patch: data.patch.clone(), sha256: data.sha256.clone(), checked_at, data }
    }

    fn unchanged(now: DateTime<Utc>) -> MapModRefresh {
        MapModRefresh { status: RefreshStatus::Unchanged, data: None, checked_at: Some(now) }
    }

    #[test]
    fn atomic_write_creates_dirs_replaces_the_file_and_leaves_no_tmp() {
        let dir = scratch_dir();
        let path = dir.join("nested").join("file.json");
        write_atomic(&path, b"one").unwrap();
        write_atomic(&path, b"two").unwrap();
        assert_eq!(std::fs::read(&path).unwrap(), b"two");
        assert!(!path.with_file_name("file.json.tmp").exists());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn missing_or_corrupt_cache_reads_as_none() {
        let dir = scratch_dir();
        let path = dir.join(MAP_MODS_FILE);
        assert_eq!(read_json::<CachedMapMods>(&path), None);
        write_atomic(&path, b"{ not json").unwrap();
        assert_eq!(read_json::<CachedMapMods>(&path), None);
        let saved = cached("aaa", at("2026-11-12T10:00:00Z"));
        write_json(&path, &saved).unwrap();
        assert_eq!(read_json::<CachedMapMods>(&path), Some(saved));
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn cache_file_uses_camel_case_fields() {
        let json = serde_json::to_value(cached("aaa", at("2026-11-12T10:00:00Z"))).unwrap();
        assert_eq!(json["checkedAt"], "2026-11-12T10:00:00Z");
        assert_eq!(json["data"]["optimizationTable"], serde_json::json!({}));
        let failed = serde_json::to_value(MapModRefresh::failed()).unwrap();
        assert_eq!(failed, serde_json::json!({ "status": "failed" }));
    }

    #[test]
    fn new_data_is_saved_and_reported_as_updated() {
        let now = at("2026-11-12T10:00:00Z");
        let body = serde_json::to_string(&map_mods("bbb")).unwrap();
        let (file, result) = map_mod_outcome(200, &body, Some(cached("aaa", at("2026-11-11T10:00:00Z"))), now);
        assert_eq!(file, Some(cached("bbb", now)));
        assert_eq!(
            result,
            MapModRefresh { status: RefreshStatus::Updated, data: Some(map_mods("bbb")), checked_at: Some(now) }
        );
        // First run: nothing cached yet.
        assert_eq!(map_mod_outcome(200, &body, None, now).0, Some(cached("bbb", now)));
    }

    #[test]
    fn not_modified_or_same_hash_only_moves_checked_at() {
        let earlier = at("2026-11-11T10:00:00Z");
        let now = at("2026-11-12T10:00:00Z");
        assert_eq!(
            map_mod_outcome(304, "", Some(cached("aaa", earlier)), now),
            (Some(cached("aaa", now)), unchanged(now))
        );
        let same = serde_json::to_string(&map_mods("aaa")).unwrap();
        assert_eq!(
            map_mod_outcome(200, &same, Some(cached("aaa", earlier)), now),
            (Some(cached("aaa", now)), unchanged(now))
        );
    }

    #[test]
    fn errors_and_bad_bodies_fail_without_touching_the_cache() {
        let now = at("2026-11-12T10:00:00Z");
        let not_found = r#"{"error":"not_found","message":"strategy not found"}"#;
        for (status, body) in [(503, "{}"), (429, ""), (404, not_found), (200, "{ nope"), (304, "")] {
            assert_eq!(map_mod_outcome(status, body, None, now), (None, MapModRefresh::failed()), "HTTP {status}");
        }
    }
}

#[cfg(test)]
mod atlas_tests {
    use super::*;

    fn temp_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("niko-atlas-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn atlas_tags_are_plain_versions() {
        assert!(is_atlas_tag("3.30.0"));
        assert!(is_atlas_tag("10.0.12"));
        assert!(!is_atlas_tag("3.30"));
        assert!(!is_atlas_tag("3.30.0-rc1"));
        assert!(!is_atlas_tag("../3.30.0"));
        assert!(!is_atlas_tag("3..0"));
    }

    #[test]
    fn atlas_files_live_under_their_tag() {
        let root = Path::new("game-data");
        assert_eq!(atlas_dir(root, "3.30.0"), root.join("atlas").join("3.30.0"));
    }

    #[test]
    fn sprite_files_are_unique_safe_basenames() {
        let data = serde_json::json!({ "sprites": {
            "frame": {
                "0.1246": { "filename": "https://web.poecdn.com/image/passive-skill/atlas-frame-0.png?a1" },
                "0.2109": { "filename": "https://web.poecdn.com/image/passive-skill/atlas-frame-1.png?b2" }
            },
            "mastery": { "0.1246": { "filename": "https://web.poecdn.com/image/passive-skill/atlas-frame-0.png?a1" } },
            "line": { "0.1246": { "filename": "https://web.poecdn.com/image/passive-skill/.hidden.png" } },
            "startNode": { "0.1246": { "filename": "https://web.poecdn.com/image/passive-skill/a%2F..%2Fb.png" } }
        }});
        assert_eq!(sprite_files(&data), vec!["atlas-frame-0.png", "atlas-frame-1.png"]);
        assert!(sprite_files(&serde_json::json!({})).is_empty());
    }

    #[test]
    fn only_missing_assets_are_downloaded() {
        let dir = temp_dir();
        std::fs::create_dir_all(dir.join("assets")).unwrap();
        std::fs::write(dir.join("assets").join("a.png"), b"x").unwrap();
        let names = vec!["a.png".to_string(), "b.png".to_string()];
        assert_eq!(missing_assets(&dir, &names), vec!["b.png".to_string()]);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn corrupt_atlas_data_counts_as_missing() {
        let dir = temp_dir();
        let path = dir.join("data.json");
        assert!(read_atlas_data(&path).is_none());
        std::fs::write(&path, "{\"tree\":").unwrap();
        assert!(read_atlas_data(&path).is_none());
        std::fs::write(&path, "{\"tree\":\"Atlas\"}").unwrap();
        let (text, value) = read_atlas_data(&path).unwrap();
        assert_eq!(text, "{\"tree\":\"Atlas\"}");
        assert_eq!(value["tree"], "Atlas");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn rate_limited_downloads_say_try_again_later() {
        assert!(matches!(status_error(429), Error::Network(m) if m.contains("try again later")));
        assert!(matches!(status_error(500), Error::Network(m) if m.contains("500")));
    }
}
