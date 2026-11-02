// ABOUTME: Map session tracking — Client.txt watcher task, live tracker state, and tracking IPC commands.
// ABOUTME: A run owns a before/after snapshot pair; map_runs rows count its maps and their in-map time.

use std::collections::HashMap;
use std::path::PathBuf;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use tauri::{AppHandle, Emitter, Manager, State};
use uuid::Uuid;

use crate::client_log::{self, AreaEvent, AreaTracker, LogTail};
use crate::commands::snapshots::{take_snapshot_inner, StashSnapshot};
use crate::error::{Error, Result};
use crate::state::AppState;

const SETTINGS_STORE: &str = "niko-settings.json";
const KEY_LOG_PATH: &str = "client_log_path";
const KEY_OVERLAY: &str = "overlay_enabled";
const STATE_EVENT: &str = "tracker-state";
const OVERLAY_LABEL: &str = "overlay";

fn db(e: sqlx::Error) -> Error {
    Error::Database(e.to_string())
}

// ── State ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveRun {
    pub id: String,
    pub strategy_id: String,
    pub config_id: String,
    pub started_at: String,
    pub map_count: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrentMap {
    pub name: String,
    pub level: u32,
    #[serde(skip)]
    area_id: String,
    #[serde(skip)]
    seed: u64,
    /// map_runs row receiving this map's time; None when no run owns it.
    #[serde(skip)]
    db_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackerState {
    pub log_found: bool,
    pub log_active: bool,
    pub in_map: bool,
    pub current_map: Option<CurrentMap>,
    pub suggest_tracking: bool,
    pub busy: bool,
    pub active_run: Option<ActiveRun>,
}

#[derive(Default)]
pub struct Tracker {
    log_path_override: Option<PathBuf>,
    active_path: Option<PathBuf>,
    overlay_enabled: bool,
    overlay_visible: bool,
    log_found: bool,
    log_active: bool,
    current_map: Option<CurrentMap>,
    in_map_since: Option<Instant>,
    suggest: bool,
    busy: bool,
    run: Option<ActiveRun>,
}

impl Tracker {
    fn to_state(&self) -> TrackerState {
        TrackerState {
            log_found: self.log_found,
            log_active: self.log_active,
            in_map: self.in_map_since.is_some(),
            current_map: self.current_map.clone(),
            suggest_tracking: self.suggest,
            busy: self.busy,
            active_run: self.run.clone(),
        }
    }
}

/// Emits the state to both windows and shows the overlay once the game is writing to the log.
fn publish(app: &AppHandle, t: &mut Tracker) {
    let _ = app.emit(STATE_EVENT, t.to_state());
    let show = t.overlay_enabled && (t.log_active || t.run.is_some());
    if show != t.overlay_visible {
        if let Some(w) = app.get_webview_window(OVERLAY_LABEL) {
            let _ = if show { w.show() } else { w.hide() };
            t.overlay_visible = show;
        }
    }
}

/// Settings from the store plus any run left open when the app last closed.
pub async fn load_tracker(app: &AppHandle, pool: &SqlitePool) -> Tracker {
    use tauri_plugin_store::StoreExt;
    let mut t = Tracker { overlay_enabled: true, ..Default::default() };
    if let Ok(store) = app.store(SETTINGS_STORE) {
        t.log_path_override = store.get(KEY_LOG_PATH).and_then(|v| v.as_str().map(PathBuf::from));
        if let Some(enabled) = store.get(KEY_OVERLAY).and_then(|v| v.as_bool()) {
            t.overlay_enabled = enabled;
        }
    }
    let open_run = sqlx::query(
        "SELECT r.id, r.strategy_id, r.config_id, r.started_at,
                (SELECT COUNT(*) FROM map_runs m WHERE m.run_id = r.id) AS map_count
         FROM tracking_runs r WHERE r.ended_at IS NULL
         ORDER BY r.started_at DESC LIMIT 1",
    )
    .fetch_optional(pool)
    .await;
    if let Ok(Some(row)) = open_run {
        t.run = Some(ActiveRun {
            id: row.get("id"),
            strategy_id: row.get("strategy_id"),
            config_id: row.get("config_id"),
            started_at: row.get("started_at"),
            map_count: row.get::<i64, _>("map_count") as u32,
        });
    }
    t
}

// ── Watcher ─────────────────────────────────────────────────────────────────

pub fn spawn_watcher(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut tail: Option<LogTail> = None;
        let mut area = AreaTracker::default();
        let mut tick = tokio::time::interval(Duration::from_secs(1));
        loop {
            tick.tick().await;
            let state = app.state::<AppState>();

            let wanted = state
                .tracker
                .lock()
                .await
                .log_path_override
                .clone()
                .or_else(client_log::detect_log_path);
            if tail.as_ref().map(|t| t.path()) != wanted.as_deref() {
                tail = wanted.as_deref().and_then(|p| LogTail::open_at_end(p).ok());
                set_log_file(&app, &state, tail.as_ref().map(|t| t.path().to_path_buf())).await;
            }

            let Some(reader) = tail.as_mut() else { continue };
            let lines = match reader.read_lines() {
                Ok(lines) => lines,
                Err(_) => {
                    tail = None;
                    set_log_file(&app, &state, None).await;
                    continue;
                }
            };
            if lines.is_empty() {
                continue;
            }
            {
                let mut t = state.tracker.lock().await;
                if !t.log_active {
                    t.log_active = true;
                    publish(&app, &mut t);
                }
            }
            for line in lines {
                let Some(event) = client_log::parse_line(&line).and_then(|l| area.feed(l)) else {
                    continue;
                };
                if let Err(e) = handle_area_event(&app, &state, event).await {
                    eprintln!("[tracking] {e}");
                }
            }
        }
    });
}

async fn set_log_file(app: &AppHandle, state: &AppState, path: Option<PathBuf>) {
    let mut t = state.tracker.lock().await;
    let found = path.is_some();
    t.active_path = path;
    if t.log_found != found {
        t.log_found = found;
        publish(app, &mut t);
    }
}

async fn handle_area_event(app: &AppHandle, state: &AppState, event: AreaEvent) -> Result<()> {
    let mut t = state.tracker.lock().await;
    match event {
        AreaEvent::MapStarted { name, area_id, level, seed } => {
            flush_map_time(&mut t, &state.pool).await?;
            let mut map = CurrentMap { name, level, area_id, seed, db_id: None };
            if let Some(run) = t.run.as_mut() {
                map.db_id = Some(insert_map_run(&state.pool, &run.id, &map).await?);
                run.map_count += 1;
            }
            t.suggest = t.run.is_none();
            t.current_map = Some(map);
            t.in_map_since = Some(Instant::now());
        }
        AreaEvent::MapResumed => t.in_map_since = Some(Instant::now()),
        AreaEvent::LeftMap => {
            flush_map_time(&mut t, &state.pool).await?;
            t.suggest = false;
        }
    }
    publish(app, &mut t);
    Ok(())
}

/// Adds the time since the map was entered/resumed to its map_runs row and stops the clock.
async fn flush_map_time(t: &mut Tracker, pool: &SqlitePool) -> Result<()> {
    let Some(since) = t.in_map_since.take() else { return Ok(()) };
    if let Some(id) = t.current_map.as_ref().and_then(|m| m.db_id.as_deref()) {
        sqlx::query("UPDATE map_runs SET duration_secs = duration_secs + ? WHERE id = ?")
            .bind(since.elapsed().as_secs() as i64)
            .bind(id)
            .execute(pool)
            .await
            .map_err(db)?;
    }
    Ok(())
}

async fn insert_map_run(pool: &SqlitePool, run_id: &str, map: &CurrentMap) -> Result<String> {
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO map_runs (id, run_id, area_name, area_id, area_level, seed) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(run_id)
    .bind(&map.name)
    .bind(&map.area_id)
    .bind(map.level as i64)
    .bind(map.seed as i64)
    .execute(pool)
    .await
    .map_err(db)?;
    Ok(id)
}

async fn insert_run(pool: &SqlitePool, strategy_id: &str, config_id: &str, before_id: &str) -> Result<ActiveRun> {
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO tracking_runs (id, strategy_id, config_id, before_snapshot_id) VALUES (?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(strategy_id)
    .bind(config_id)
    .bind(before_id)
    .execute(pool)
    .await
    .map_err(db)?;
    let started_at: String = sqlx::query_scalar("SELECT started_at FROM tracking_runs WHERE id = ?")
        .bind(&id)
        .fetch_one(pool)
        .await
        .map_err(db)?;
    Ok(ActiveRun {
        id,
        strategy_id: strategy_id.to_string(),
        config_id: config_id.to_string(),
        started_at,
        map_count: 0,
    })
}

async fn close_run(pool: &SqlitePool, run_id: &str, after_id: Option<&str>) -> Result<()> {
    sqlx::query("UPDATE tracking_runs SET after_snapshot_id = ?, ended_at = datetime('now') WHERE id = ?")
        .bind(after_id)
        .bind(run_id)
        .execute(pool)
        .await
        .map_err(db)?;
    Ok(())
}

/// Marks the tracker busy for the duration of one snapshot.
fn begin_snapshot(app: &AppHandle, t: &mut Tracker) -> Result<()> {
    if t.busy {
        return Err(Error::Validation("a snapshot is already being taken".into()));
    }
    t.busy = true;
    publish(app, t);
    Ok(())
}

async fn snapshot(app: &AppHandle, state: &AppState, config_id: &str, label: &str) -> Result<StashSnapshot> {
    let result = take_snapshot_inner(app, state, config_id, Some(label.to_string())).await;
    let mut t = state.tracker.lock().await;
    t.busy = false;
    publish(app, &mut t);
    result
}

// ── Run commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_tracker_state(state: State<'_, AppState>) -> Result<TrackerState> {
    Ok(state.tracker.lock().await.to_state())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartRunInput {
    pub strategy_id: String,
    pub config_id: String,
}

#[tauri::command]
pub async fn start_tracking_run(app: AppHandle, state: State<'_, AppState>, input: StartRunInput) -> Result<()> {
    {
        let mut t = state.tracker.lock().await;
        if t.run.is_some() {
            return Err(Error::Validation("a tracking run is already active".into()));
        }
        if !t.log_found {
            return Err(Error::Validation("Client.txt was not found — set its path in Settings".into()));
        }
        begin_snapshot(&app, &mut t)?;
    }
    let before = snapshot(&app, &state, &input.config_id, "before").await?;
    let mut run = insert_run(&state.pool, &input.strategy_id, &input.config_id, &before.id).await?;

    let mut t = state.tracker.lock().await;
    if t.in_map_since.is_some() {
        if let Some(map) = t.current_map.as_mut() {
            map.db_id = Some(insert_map_run(&state.pool, &run.id, map).await?);
            run.map_count = 1;
        }
    }
    t.run = Some(run);
    t.suggest = false;
    publish(&app, &mut t);
    Ok(())
}

/// Closes the current run and opens one for `strategy_id`, sharing a single snapshot between them.
/// The map being played stays in the old run; the map log can move it.
#[tauri::command]
pub async fn switch_tracking_strategy(app: AppHandle, state: State<'_, AppState>, strategy_id: String) -> Result<()> {
    let (run_id, config_id) = {
        let mut t = state.tracker.lock().await;
        let Some(run) = t.run.as_ref() else {
            return Err(Error::Validation("no tracking run is active".into()));
        };
        if run.strategy_id == strategy_id {
            return Ok(());
        }
        let ids = (run.id.clone(), run.config_id.clone());
        begin_snapshot(&app, &mut t)?;
        ids
    };
    let shared = snapshot(&app, &state, &config_id, "switch").await?;
    close_run(&state.pool, &run_id, Some(&shared.id)).await?;
    let run = insert_run(&state.pool, &strategy_id, &config_id, &shared.id).await?;

    let mut t = state.tracker.lock().await;
    t.run = Some(run);
    publish(&app, &mut t);
    Ok(())
}

#[tauri::command]
pub async fn stop_tracking_run(app: AppHandle, state: State<'_, AppState>, skip_snapshot: bool) -> Result<()> {
    let (run_id, config_id) = {
        let mut t = state.tracker.lock().await;
        let Some(run) = t.run.as_ref() else {
            return Err(Error::Validation("no tracking run is active".into()));
        };
        let ids = (run.id.clone(), run.config_id.clone());
        if skip_snapshot {
            if t.busy {
                return Err(Error::Validation("a snapshot is already being taken".into()));
            }
        } else {
            begin_snapshot(&app, &mut t)?;
        }
        ids
    };
    let after_id = if skip_snapshot {
        None
    } else {
        Some(snapshot(&app, &state, &config_id, "after").await?.id)
    };
    close_run(&state.pool, &run_id, after_id.as_deref()).await?;

    let mut t = state.tracker.lock().await;
    let was_in_map = t.in_map_since.is_some();
    flush_map_time(&mut t, &state.pool).await?;
    if was_in_map {
        t.in_map_since = Some(Instant::now());
    }
    if let Some(map) = t.current_map.as_mut() {
        map.db_id = None;
    }
    t.run = None;
    publish(&app, &mut t);
    Ok(())
}

#[tauri::command]
pub async fn dismiss_tracking_suggestion(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    let mut t = state.tracker.lock().await;
    t.suggest = false;
    publish(&app, &mut t);
    Ok(())
}

// ── History ─────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MapRun {
    pub id: String,
    pub area_name: String,
    pub area_id: String,
    pub area_level: i64,
    pub seed: i64,
    pub entered_at: String,
    pub duration_secs: i64,
    pub strategy_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackingRunDetail {
    pub id: String,
    pub strategy_id: String,
    pub config_id: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub before_chaos: Option<f64>,
    pub after_chaos: Option<f64>,
    pub divine_rate: Option<f64>,
    pub maps: Vec<MapRun>,
}

/// All runs newest first, each with its maps (oldest first) and snapshot totals (None if deleted/missing).
#[tauri::command]
pub async fn get_tracking_history(state: State<'_, AppState>) -> Result<Vec<TrackingRunDetail>> {
    let mut maps: HashMap<String, Vec<MapRun>> = HashMap::new();
    let map_rows = sqlx::query(
        "SELECT id, run_id, area_name, area_id, area_level, seed, entered_at, duration_secs, strategy_id
         FROM map_runs ORDER BY entered_at, rowid",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(db)?;
    for row in &map_rows {
        maps.entry(row.get("run_id")).or_default().push(MapRun {
            id: row.get("id"),
            area_name: row.get("area_name"),
            area_id: row.get("area_id"),
            area_level: row.get("area_level"),
            seed: row.get("seed"),
            entered_at: row.get("entered_at"),
            duration_secs: row.get("duration_secs"),
            strategy_id: row.get("strategy_id"),
        });
    }

    let rows = sqlx::query(
        "SELECT r.id, r.strategy_id, r.config_id, r.started_at, r.ended_at,
                b.total_chaos AS before_chaos, a.total_chaos AS after_chaos, a.divine_rate AS divine_rate
         FROM tracking_runs r
         LEFT JOIN stash_snapshots b ON b.id = r.before_snapshot_id
         LEFT JOIN stash_snapshots a ON a.id = r.after_snapshot_id
         ORDER BY r.started_at DESC, r.rowid DESC",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(db)?;

    Ok(rows
        .iter()
        .map(|r| {
            let id: String = r.get("id");
            TrackingRunDetail {
                maps: maps.remove(&id).unwrap_or_default(),
                id,
                strategy_id: r.get("strategy_id"),
                config_id: r.get("config_id"),
                started_at: r.get("started_at"),
                ended_at: r.get("ended_at"),
                before_chaos: r.get("before_chaos"),
                after_chaos: r.get("after_chaos"),
                divine_rate: r.get("divine_rate"),
            }
        })
        .collect())
}

/// `strategy_id: None` puts the maps back on their run's strategy.
#[tauri::command]
pub async fn reassign_map_runs(
    state: State<'_, AppState>,
    map_ids: Vec<String>,
    strategy_id: Option<String>,
) -> Result<()> {
    let mut tx = state.pool.begin().await.map_err(db)?;
    for id in &map_ids {
        sqlx::query("UPDATE map_runs SET strategy_id = ? WHERE id = ?")
            .bind(&strategy_id)
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(db)?;
    }
    tx.commit().await.map_err(db)
}

/// Deletes a finished run and its maps; its snapshots stay on the Stash page.
#[tauri::command]
pub async fn delete_tracking_run(state: State<'_, AppState>, id: String) -> Result<()> {
    if state.tracker.lock().await.run.as_ref().is_some_and(|r| r.id == id) {
        return Err(Error::Validation("stop the run before deleting it".into()));
    }
    let mut tx = state.pool.begin().await.map_err(db)?;
    sqlx::query("DELETE FROM map_runs WHERE run_id = ?").bind(&id).execute(&mut *tx).await.map_err(db)?;
    sqlx::query("DELETE FROM tracking_runs WHERE id = ?").bind(&id).execute(&mut *tx).await.map_err(db)?;
    tx.commit().await.map_err(db)
}

// ── Settings ────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackerSettings {
    pub log_path: Option<String>,
    pub active_path: Option<String>,
    pub log_found: bool,
    pub overlay_enabled: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackerSettingsInput {
    pub log_path: Option<String>,
    pub overlay_enabled: bool,
}

#[tauri::command]
pub async fn get_tracker_settings(state: State<'_, AppState>) -> Result<TrackerSettings> {
    let t = state.tracker.lock().await;
    Ok(TrackerSettings {
        log_path: t.log_path_override.as_ref().map(|p| p.display().to_string()),
        active_path: t.active_path.as_ref().map(|p| p.display().to_string()),
        log_found: t.log_found,
        overlay_enabled: t.overlay_enabled,
    })
}

/// Persists the settings; the watcher switches to a new log path on its next tick.
#[tauri::command]
pub async fn set_tracker_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    input: TrackerSettingsInput,
) -> Result<()> {
    use tauri_plugin_store::StoreExt;
    let log_path = input.log_path.map(|p| p.trim().to_string()).filter(|p| !p.is_empty());
    let store = app
        .store(SETTINGS_STORE)
        .map_err(|e| Error::Validation(format!("settings store: {e}")))?;
    if let Some(path) = &log_path {
        store.set(KEY_LOG_PATH, path.clone());
    } else {
        store.delete(KEY_LOG_PATH);
    }
    store.set(KEY_OVERLAY, input.overlay_enabled);
    store.save().map_err(|e| Error::Validation(format!("settings store: {e}")))?;

    let mut t = state.tracker.lock().await;
    t.log_path_override = log_path.map(PathBuf::from);
    t.overlay_enabled = input.overlay_enabled;
    publish(&app, &mut t);
    Ok(())
}
