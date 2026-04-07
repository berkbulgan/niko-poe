// ABOUTME: Tauri IPC commands for the filter_presets table.
// ABOUTME: Provides full CRUD: list, get, create, update, delete.

use serde::{Deserialize, Serialize};
use sqlx::Row;
use tauri::State;
use uuid::Uuid;

use crate::error::{Error, Result};
use crate::state::AppState;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilterPreset {
    pub id: String,
    pub name: String,
    pub config: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFilterPresetInput {
    pub name: String,
    pub config: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFilterPresetInput {
    pub name: Option<String>,
    pub config: Option<String>,
}

fn row_to_filter_preset(row: &sqlx::sqlite::SqliteRow) -> FilterPreset {
    FilterPreset {
        id: row.get("id"),
        name: row.get("name"),
        config: row.get("config"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

#[tauri::command]
pub async fn get_filter_presets(state: State<'_, AppState>) -> Result<Vec<FilterPreset>> {
    let rows = sqlx::query(
        "SELECT id, name, config, created_at, updated_at
         FROM filter_presets
         ORDER BY created_at DESC",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    Ok(rows.iter().map(row_to_filter_preset).collect())
}

#[tauri::command]
pub async fn get_filter_preset(state: State<'_, AppState>, id: String) -> Result<FilterPreset> {
    let row = sqlx::query(
        "SELECT id, name, config, created_at, updated_at
         FROM filter_presets
         WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?
    .ok_or_else(|| Error::NotFound(format!("filter_preset {id}")))?;

    Ok(row_to_filter_preset(&row))
}

#[tauri::command]
pub async fn create_filter_preset(
    state: State<'_, AppState>,
    input: CreateFilterPresetInput,
) -> Result<FilterPreset> {
    if input.name.trim().is_empty() {
        return Err(Error::Validation("name is required".into()));
    }
    if input.config.trim().is_empty() {
        return Err(Error::Validation("config is required".into()));
    }

    let id = Uuid::new_v4().to_string();

    sqlx::query("INSERT INTO filter_presets (id, name, config) VALUES (?, ?, ?)")
        .bind(&id)
        .bind(&input.name)
        .bind(&input.config)
        .execute(&state.pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    get_filter_preset(state, id).await
}

#[tauri::command]
pub async fn update_filter_preset(
    state: State<'_, AppState>,
    id: String,
    input: UpdateFilterPresetInput,
) -> Result<FilterPreset> {
    get_filter_preset(state.clone(), id.clone()).await?;

    if let Some(ref name) = input.name {
        if name.trim().is_empty() {
            return Err(Error::Validation("name cannot be empty".into()));
        }
    }

    sqlx::query(
        "UPDATE filter_presets
         SET name       = COALESCE(?, name),
             config     = COALESCE(?, config),
             updated_at = datetime('now')
         WHERE id = ?",
    )
    .bind(&input.name)
    .bind(&input.config)
    .bind(&id)
    .execute(&state.pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    get_filter_preset(state, id).await
}

#[tauri::command]
pub async fn delete_filter_preset(state: State<'_, AppState>, id: String) -> Result<()> {
    let result = sqlx::query("DELETE FROM filter_presets WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err(Error::NotFound(format!("filter_preset {id}")));
    }

    Ok(())
}
