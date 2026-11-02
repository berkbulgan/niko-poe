// ABOUTME: Tauri IPC commands for stash snapshot configs, snapshot capture, and retrieval.
// ABOUTME: Provides config CRUD, take_snapshot (fetch+price+store), and dashboard recent snapshots.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use sqlx::Row;
use tauri::State;
use uuid::Uuid;

use crate::error::{Error, Result};
use crate::state::AppState;

// ── Structs ─────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotConfig {
    pub id: String,
    pub name: String,
    pub league: String,
    pub tab_ids: Vec<String>,
    pub strategy_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSnapshotConfigInput {
    pub name: String,
    pub league: String,
    pub tab_ids: Vec<String>,
    pub strategy_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSnapshotConfigInput {
    pub name: Option<String>,
    pub tab_ids: Option<Vec<String>>,
    pub strategy_id: Option<Option<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotItem {
    pub id: String,
    pub item_name: String,
    pub type_line: String,
    pub stack_size: i32,
    pub chaos_value: Option<f64>,
    pub frame_type: Option<i32>,
    pub icon: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StashSnapshot {
    pub id: String,
    pub config_id: String,
    pub label: Option<String>,
    pub total_chaos: f64,
    pub total_items: i32,
    pub unpriced_count: i32,
    pub divine_rate: f64,
    pub created_at: String,
    pub items: Vec<SnapshotItem>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotSummary {
    pub id: String,
    pub config_id: String,
    pub label: Option<String>,
    pub total_chaos: f64,
    pub total_items: i32,
    pub unpriced_count: i32,
    pub divine_rate: f64,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentSnapshot {
    pub id: String,
    pub config_name: String,
    pub total_chaos: f64,
    pub divine_rate: f64,
    pub total_items: i32,
    pub unpriced_count: i32,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TakeSnapshotInput {
    pub config_id: String,
    pub label: Option<String>,
}

// ── Row converters ──────────────────────────────────────────────────────────

fn row_to_config(row: &sqlx::sqlite::SqliteRow) -> Result<SnapshotConfig> {
    let tab_ids_json: String = row.get("tab_ids");
    let tab_ids: Vec<String> =
        serde_json::from_str(&tab_ids_json).map_err(|e| Error::Parse(e.to_string()))?;

    Ok(SnapshotConfig {
        id: row.get("id"),
        name: row.get("name"),
        league: row.get("league"),
        tab_ids,
        strategy_id: row.get("strategy_id"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    })
}

fn row_to_summary(row: &sqlx::sqlite::SqliteRow) -> SnapshotSummary {
    SnapshotSummary {
        id: row.get("id"),
        config_id: row.get("config_id"),
        label: row.get("label"),
        total_chaos: row.get("total_chaos"),
        total_items: row.get("total_items"),
        unpriced_count: row.get("unpriced_count"),
        divine_rate: row.get("divine_rate"),
        created_at: row.get("created_at"),
    }
}

fn row_to_item(row: &sqlx::sqlite::SqliteRow) -> SnapshotItem {
    SnapshotItem {
        id: row.get("id"),
        item_name: row.get("item_name"),
        type_line: row.get("type_line"),
        stack_size: row.get("stack_size"),
        chaos_value: row.get("chaos_value"),
        frame_type: row.get("frame_type"),
        icon: row.get("icon"),
    }
}

// ── Config CRUD ─────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_snapshot_configs(state: State<'_, AppState>) -> Result<Vec<SnapshotConfig>> {
    let rows = sqlx::query(
        "SELECT id, name, league, tab_ids, strategy_id, created_at, updated_at
         FROM snapshot_configs
         ORDER BY updated_at DESC",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    rows.iter().map(row_to_config).collect()
}

#[tauri::command]
pub async fn create_snapshot_config(
    state: State<'_, AppState>,
    input: CreateSnapshotConfigInput,
) -> Result<SnapshotConfig> {
    if input.name.trim().is_empty() {
        return Err(Error::Validation("name is required".into()));
    }
    if input.tab_ids.is_empty() {
        return Err(Error::Validation("at least one tab must be selected".into()));
    }

    let id = Uuid::new_v4().to_string();
    let tab_ids_json = serde_json::to_string(&input.tab_ids)?;

    sqlx::query(
        "INSERT INTO snapshot_configs (id, name, league, tab_ids, strategy_id) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&input.name)
    .bind(&input.league)
    .bind(&tab_ids_json)
    .bind(&input.strategy_id)
    .execute(&state.pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    let row = sqlx::query(
        "SELECT id, name, league, tab_ids, strategy_id, created_at, updated_at
         FROM snapshot_configs WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    row_to_config(&row)
}

#[tauri::command]
pub async fn update_snapshot_config(
    state: State<'_, AppState>,
    id: String,
    input: UpdateSnapshotConfigInput,
) -> Result<SnapshotConfig> {
    if let Some(ref name) = input.name {
        if name.trim().is_empty() {
            return Err(Error::Validation("name cannot be empty".into()));
        }
    }
    if let Some(ref tab_ids) = input.tab_ids {
        if tab_ids.is_empty() {
            return Err(Error::Validation("at least one tab must be selected".into()));
        }
    }

    let tab_ids_json = input
        .tab_ids
        .as_ref()
        .map(|ids| serde_json::to_string(ids))
        .transpose()?;

    // Flatten Option<Option<String>> for strategy_id binding
    let strategy_update = input.strategy_id.as_ref();

    if input.name.is_some() || tab_ids_json.is_some() || strategy_update.is_some() {
        let mut sets = Vec::new();
        let mut binds: Vec<Option<String>> = Vec::new();

        if let Some(ref name) = input.name {
            sets.push("name = ?");
            binds.push(Some(name.clone()));
        }
        if let Some(ref json) = tab_ids_json {
            sets.push("tab_ids = ?");
            binds.push(Some(json.clone()));
        }
        if let Some(ref strategy_id) = input.strategy_id {
            sets.push("strategy_id = ?");
            binds.push(strategy_id.clone());
        }
        sets.push("updated_at = datetime('now')");

        let sql = format!(
            "UPDATE snapshot_configs SET {} WHERE id = ?",
            sets.join(", ")
        );

        let mut query = sqlx::query(&sql);
        for bind in &binds {
            query = query.bind(bind);
        }
        query = query.bind(&id);

        query
            .execute(&state.pool)
            .await
            .map_err(|e| Error::Database(e.to_string()))?;
    }

    let row = sqlx::query(
        "SELECT id, name, league, tab_ids, strategy_id, created_at, updated_at
         FROM snapshot_configs WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    row_to_config(&row)
}

#[tauri::command]
pub async fn delete_snapshot_config(state: State<'_, AppState>, id: String) -> Result<()> {
    // CASCADE will handle snapshots + items deletion
    let result = sqlx::query("DELETE FROM snapshot_configs WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err(Error::NotFound(format!("snapshot config {id}")));
    }
    Ok(())
}

// ── Take Snapshot ───────────────────────────────────────────────────────────

#[tauri::command]
pub async fn take_snapshot(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    input: TakeSnapshotInput,
) -> Result<StashSnapshot> {
    // 1. Load the config
    let config_row = sqlx::query(
        "SELECT id, name, league, tab_ids, strategy_id, created_at, updated_at
         FROM snapshot_configs WHERE id = ?",
    )
    .bind(&input.config_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?
    .ok_or_else(|| Error::NotFound(format!("snapshot config {}", input.config_id)))?;

    let config = row_to_config(&config_row)?;

    // 2. Prices must be loaded for this config's league, otherwise the snapshot would be
    //    stored with another league's prices (or silently valued at 0).
    let ninja_cache = {
        let cache = state.ninja_prices.lock().await;
        if cache.league.as_deref() != Some(config.league.as_str()) || cache.prices.is_empty() {
            return Err(Error::Validation(format!(
                "prices for {} are not loaded yet — wait for prices to finish loading and try again",
                config.league
            )));
        }
        cache.prices.clone()
    };

    // 3. Fetch items from all configured tabs
    let access_token = crate::commands::auth::access_token(&app, &state).await?;
    let mut all_items: Vec<crate::commands::stash::StashItem> = Vec::new();
    for tab_id in &config.tab_ids {
        let items =
            crate::commands::stash::fetch_tab_items(&config.league, tab_id, &access_token).await?;
        all_items.extend(items);
    }

    // 4. Filter out rare items (frameType=2) and aggregate by display name
    let mut aggregated: HashMap<String, AggregatedItem> = HashMap::new();

    for item in &all_items {
        if item.frame_type == Some(2) {
            continue;
        }

        let display_name = if !item.name.is_empty() {
            &item.name
        } else {
            &item.type_line
        };

        let entry = aggregated.entry(display_name.to_string()).or_insert_with(|| {
            AggregatedItem {
                item_name: display_name.to_string(),
                type_line: item.type_line.clone(),
                stack_size: 0,
                frame_type: item.frame_type.map(|v| v as i32),
                icon: item.icon.clone(),
            }
        });
        entry.stack_size += item.stack_size.unwrap_or(1) as i32;
    }

    // 5. Look up prices from ninja cache
    let mut snapshot_items: Vec<SnapshotItem> = Vec::new();
    let mut total_chaos: f64 = 0.0;
    let mut unpriced_count: i32 = 0;

    for (_name, agg) in &aggregated {
        let key = agg.item_name.to_lowercase();
        let chaos_value = ninja_cache
            .get(&key)
            .and_then(|entries| {
                entries
                    .iter()
                    .max_by_key(|e| e.listing_count.unwrap_or(0))
                    .map(|e| e.chaos_value)
            });

        if let Some(price) = chaos_value {
            total_chaos += price * agg.stack_size as f64;
        } else {
            unpriced_count += 1;
        }

        snapshot_items.push(SnapshotItem {
            id: Uuid::new_v4().to_string(),
            item_name: agg.item_name.clone(),
            type_line: agg.type_line.clone(),
            stack_size: agg.stack_size,
            chaos_value,
            frame_type: agg.frame_type,
            icon: agg.icon.clone(),
        });
    }

    // 6. Get divine rate from ninja cache
    let divine_rate = ninja_cache
        .get("divine orb")
        .and_then(|entries| entries.first().map(|e| e.chaos_value))
        .unwrap_or(0.0);

    // 7. Write to database in one transaction so a failure can't leave a partial snapshot.
    let snapshot_id = Uuid::new_v4().to_string();
    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
    let total_items = snapshot_items.len() as i32;

    sqlx::query(
        "INSERT INTO stash_snapshots (id, config_id, label, total_chaos, total_items, unpriced_count, divine_rate)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&snapshot_id)
    .bind(&input.config_id)
    .bind(&input.label)
    .bind(total_chaos)
    .bind(total_items)
    .bind(unpriced_count)
    .bind(divine_rate)
    .execute(&mut *tx)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    for item in &snapshot_items {
        sqlx::query(
            "INSERT INTO snapshot_items (id, snapshot_id, item_name, type_line, stack_size, chaos_value, frame_type, icon)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&item.id)
        .bind(&snapshot_id)
        .bind(&item.item_name)
        .bind(&item.type_line)
        .bind(item.stack_size)
        .bind(item.chaos_value)
        .bind(item.frame_type)
        .bind(&item.icon)
        .execute(&mut *tx)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
    }

    // 8. Return the full snapshot
    let created_at: String = sqlx::query_scalar("SELECT created_at FROM stash_snapshots WHERE id = ?")
        .bind(&snapshot_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    tx.commit()
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    Ok(StashSnapshot {
        id: snapshot_id,
        config_id: input.config_id,
        label: input.label,
        total_chaos,
        total_items,
        unpriced_count,
        divine_rate,
        created_at,
        items: snapshot_items,
    })
}

// ── Query Snapshots ─────────────────────────────────────────────────────────

/// Returns snapshot summaries (without items) for a given config, ordered newest first.
#[tauri::command]
pub async fn get_snapshots(
    state: State<'_, AppState>,
    config_id: String,
) -> Result<Vec<SnapshotSummary>> {
    let rows = sqlx::query(
        "SELECT id, config_id, label, total_chaos, total_items, unpriced_count, divine_rate, created_at
         FROM stash_snapshots
         WHERE config_id = ?
         ORDER BY created_at DESC",
    )
    .bind(&config_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    Ok(rows.iter().map(row_to_summary).collect())
}

/// Returns a single snapshot with all its items.
#[tauri::command]
pub async fn get_snapshot_detail(
    state: State<'_, AppState>,
    snapshot_id: String,
) -> Result<StashSnapshot> {
    let row = sqlx::query(
        "SELECT id, config_id, label, total_chaos, total_items, unpriced_count, divine_rate, created_at
         FROM stash_snapshots WHERE id = ?",
    )
    .bind(&snapshot_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?
    .ok_or_else(|| Error::NotFound(format!("snapshot {snapshot_id}")))?;

    let item_rows = sqlx::query(
        "SELECT id, item_name, type_line, stack_size, chaos_value, frame_type, icon
         FROM snapshot_items WHERE snapshot_id = ?
         ORDER BY chaos_value DESC NULLS LAST",
    )
    .bind(&snapshot_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    let summary = row_to_summary(&row);
    let items: Vec<SnapshotItem> = item_rows.iter().map(row_to_item).collect();

    Ok(StashSnapshot {
        id: summary.id,
        config_id: summary.config_id,
        label: summary.label,
        total_chaos: summary.total_chaos,
        total_items: summary.total_items,
        unpriced_count: summary.unpriced_count,
        divine_rate: summary.divine_rate,
        created_at: summary.created_at,
        items,
    })
}

/// Returns the 5 most recent snapshots across all configs, for the dashboard.
#[tauri::command]
pub async fn get_recent_snapshots(state: State<'_, AppState>) -> Result<Vec<RecentSnapshot>> {
    let rows = sqlx::query(
        "SELECT s.id, c.name AS config_name, s.total_chaos, s.divine_rate,
                s.total_items, s.unpriced_count, s.created_at
         FROM stash_snapshots s
         JOIN snapshot_configs c ON s.config_id = c.id
         ORDER BY s.created_at DESC
         LIMIT 5",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    Ok(rows
        .iter()
        .map(|row| RecentSnapshot {
            id: row.get("id"),
            config_name: row.get("config_name"),
            total_chaos: row.get("total_chaos"),
            divine_rate: row.get("divine_rate"),
            total_items: row.get("total_items"),
            unpriced_count: row.get("unpriced_count"),
            created_at: row.get("created_at"),
        })
        .collect())
}

#[tauri::command]
pub async fn delete_snapshot(state: State<'_, AppState>, snapshot_id: String) -> Result<()> {
    let result = sqlx::query("DELETE FROM stash_snapshots WHERE id = ?")
        .bind(&snapshot_id)
        .execute(&state.pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err(Error::NotFound(format!("snapshot {snapshot_id}")));
    }
    Ok(())
}

// ── Internal helpers ────────────────────────────────────────────────────────

struct AggregatedItem {
    item_name: String,
    type_line: String,
    stack_size: i32,
    frame_type: Option<i32>,
    icon: String,
}
