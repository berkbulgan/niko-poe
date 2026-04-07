// ABOUTME: Tauri IPC commands for the atlas_trees table.
// ABOUTME: Provides full CRUD: list, get, create, update, delete.

use serde::{Deserialize, Serialize};
use sqlx::Row;
use tauri::State;
use uuid::Uuid;

use crate::error::{Error, Result};
use crate::state::AppState;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AtlasTree {
    pub id: String,
    pub name: String,
    pub config: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAtlasTreeInput {
    pub name: String,
    pub config: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAtlasTreeInput {
    pub name: Option<String>,
    pub config: Option<String>,
}

fn row_to_atlas_tree(row: &sqlx::sqlite::SqliteRow) -> AtlasTree {
    AtlasTree {
        id: row.get("id"),
        name: row.get("name"),
        config: row.get("config"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

#[tauri::command]
pub async fn get_atlas_trees(state: State<'_, AppState>) -> Result<Vec<AtlasTree>> {
    let rows = sqlx::query(
        "SELECT id, name, config, created_at, updated_at
         FROM atlas_trees
         ORDER BY created_at DESC",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    Ok(rows.iter().map(row_to_atlas_tree).collect())
}

#[tauri::command]
pub async fn get_atlas_tree(state: State<'_, AppState>, id: String) -> Result<AtlasTree> {
    let row = sqlx::query(
        "SELECT id, name, config, created_at, updated_at
         FROM atlas_trees
         WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?
    .ok_or_else(|| Error::NotFound(format!("atlas_tree {id}")))?;

    Ok(row_to_atlas_tree(&row))
}

#[tauri::command]
pub async fn create_atlas_tree(
    state: State<'_, AppState>,
    input: CreateAtlasTreeInput,
) -> Result<AtlasTree> {
    if input.name.trim().is_empty() {
        return Err(Error::Validation("name is required".into()));
    }
    if input.config.trim().is_empty() {
        return Err(Error::Validation("config is required".into()));
    }

    let id = Uuid::new_v4().to_string();

    sqlx::query("INSERT INTO atlas_trees (id, name, config) VALUES (?, ?, ?)")
        .bind(&id)
        .bind(&input.name)
        .bind(&input.config)
        .execute(&state.pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    get_atlas_tree(state, id).await
}

#[tauri::command]
pub async fn update_atlas_tree(
    state: State<'_, AppState>,
    id: String,
    input: UpdateAtlasTreeInput,
) -> Result<AtlasTree> {
    get_atlas_tree(state.clone(), id.clone()).await?;

    if let Some(ref name) = input.name {
        if name.trim().is_empty() {
            return Err(Error::Validation("name cannot be empty".into()));
        }
    }

    sqlx::query(
        "UPDATE atlas_trees
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

    get_atlas_tree(state, id).await
}

#[tauri::command]
pub async fn delete_atlas_tree(state: State<'_, AppState>, id: String) -> Result<()> {
    let result = sqlx::query("DELETE FROM atlas_trees WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err(Error::NotFound(format!("atlas_tree {id}")));
    }

    Ok(())
}
