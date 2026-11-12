// ABOUTME: Runtime game data from the N.I.K.O. community server, cached as JSON files under <app data>/game-data.
// ABOUTME: Map mod data: read the saved copy and refresh it with an ETag check. Files are written atomically.

use std::path::Path;

use chrono::{DateTime, Utc};
use niko_community_api::MapModData;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};

const MAP_MODS_FILE: &str = "map-mods.json";

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
