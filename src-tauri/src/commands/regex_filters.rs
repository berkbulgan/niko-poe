// ABOUTME: Tauri IPC commands for the regex_filters table.
// ABOUTME: Provides full CRUD: list, get, create, update, delete.

use serde::{Deserialize, Serialize};
use sqlx::Row;
use tauri::State;
use uuid::Uuid;

use crate::error::{Error, Result};
use crate::state::AppState;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegexFilter {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub category: String,
    pub pattern: String,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRegexFilterInput {
    pub name: String,
    pub description: Option<String>,
    pub category: String,
    pub pattern: String,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRegexFilterInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub category: Option<String>,
    pub pattern: Option<String>,
    pub is_active: Option<bool>,
}

fn row_to_regex_filter(row: &sqlx::sqlite::SqliteRow) -> RegexFilter {
    let is_active_int: i64 = row.get("is_active");
    RegexFilter {
        id: row.get("id"),
        name: row.get("name"),
        description: row.get("description"),
        category: row.get("category"),
        pattern: row.get("pattern"),
        is_active: is_active_int != 0,
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

#[tauri::command]
pub async fn get_regex_filters(state: State<'_, AppState>) -> Result<Vec<RegexFilter>> {
    let rows = sqlx::query(
        "SELECT id, name, description, category, pattern, is_active, created_at, updated_at
         FROM regex_filters
         ORDER BY created_at DESC",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    Ok(rows.iter().map(row_to_regex_filter).collect())
}

#[tauri::command]
pub async fn get_regex_filter(state: State<'_, AppState>, id: String) -> Result<RegexFilter> {
    let row = sqlx::query(
        "SELECT id, name, description, category, pattern, is_active, created_at, updated_at
         FROM regex_filters
         WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?
    .ok_or_else(|| Error::NotFound(format!("regex_filter {id}")))?;

    Ok(row_to_regex_filter(&row))
}

#[tauri::command]
pub async fn create_regex_filter(
    state: State<'_, AppState>,
    input: CreateRegexFilterInput,
) -> Result<RegexFilter> {
    if input.name.trim().is_empty() {
        return Err(Error::Validation("name is required".into()));
    }
    if input.pattern.trim().is_empty() {
        return Err(Error::Validation("pattern is required".into()));
    }

    let id = Uuid::new_v4().to_string();
    let is_active = input.is_active.unwrap_or(true) as i64;

    sqlx::query(
        "INSERT INTO regex_filters (id, name, description, category, pattern, is_active)
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&input.name)
    .bind(&input.description)
    .bind(&input.category)
    .bind(&input.pattern)
    .bind(is_active)
    .execute(&state.pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    get_regex_filter(state, id).await
}

#[tauri::command]
pub async fn update_regex_filter(
    state: State<'_, AppState>,
    id: String,
    input: UpdateRegexFilterInput,
) -> Result<RegexFilter> {
    get_regex_filter(state.clone(), id.clone()).await?;

    if let Some(ref name) = input.name {
        if name.trim().is_empty() {
            return Err(Error::Validation("name cannot be empty".into()));
        }
    }

    sqlx::query(
        "UPDATE regex_filters
         SET name        = COALESCE(?, name),
             description = COALESCE(?, description),
             category    = COALESCE(?, category),
             pattern     = COALESCE(?, pattern),
             is_active   = COALESCE(?, is_active),
             updated_at  = datetime('now')
         WHERE id = ?",
    )
    .bind(&input.name)
    .bind(&input.description)
    .bind(&input.category)
    .bind(&input.pattern)
    .bind(input.is_active.map(|b| b as i64))
    .bind(&id)
    .execute(&state.pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;

    get_regex_filter(state, id).await
}

#[tauri::command]
pub async fn delete_regex_filter(state: State<'_, AppState>, id: String) -> Result<()> {
    let result = sqlx::query("DELETE FROM regex_filters WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err(Error::NotFound(format!("regex_filter {id}")));
    }

    Ok(())
}
