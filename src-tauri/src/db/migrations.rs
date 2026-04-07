// ABOUTME: SQLite migration definitions for N.I.K.O. data layer.
// ABOUTME: Runs directly on the sqlx pool at startup — no dependency on tauri-plugin-sql.

use sqlx::SqlitePool;

/// All migration SQL statements in order. Each runs inside a transaction.
const MIGRATIONS: &[(&str, &str)] = &[
    (
        "001_create_regex_filters",
        "CREATE TABLE IF NOT EXISTS regex_filters (
            id          TEXT PRIMARY KEY NOT NULL,
            name        TEXT NOT NULL,
            description TEXT,
            category    TEXT NOT NULL DEFAULT '',
            pattern     TEXT NOT NULL,
            is_active   INTEGER NOT NULL DEFAULT 1,
            created_at  TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_regex_filters_category
            ON regex_filters(category);",
    ),
    (
        "002_create_filter_presets",
        "CREATE TABLE IF NOT EXISTS filter_presets (
            id         TEXT PRIMARY KEY NOT NULL,
            name       TEXT NOT NULL,
            config     TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );",
    ),
    (
        "003_create_strategies",
        "CREATE TABLE IF NOT EXISTS strategies (
            id         TEXT PRIMARY KEY NOT NULL,
            name       TEXT NOT NULL,
            config     TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );",
    ),
    (
        "004_create_atlas_trees",
        "CREATE TABLE IF NOT EXISTS atlas_trees (
            id         TEXT PRIMARY KEY NOT NULL,
            name       TEXT NOT NULL,
            config     TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );",
    ),
];

/// Runs all pending migrations on the given pool.
/// Uses a simple _migrations tracking table to avoid re-running.
pub async fn run_migrations(pool: &SqlitePool) -> std::result::Result<(), sqlx::Error> {
    // Create tracking table
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS _migrations (
            name TEXT PRIMARY KEY NOT NULL,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
    )
    .execute(pool)
    .await?;

    for (name, sql) in MIGRATIONS {
        // Check if already applied
        let applied: bool = sqlx::query_scalar(
            "SELECT COUNT(*) > 0 FROM _migrations WHERE name = ?",
        )
        .bind(name)
        .fetch_one(pool)
        .await?;

        if applied {
            continue;
        }

        // Run migration statements
        for statement in sql.split(';') {
            let trimmed = statement.trim();
            if trimmed.is_empty() {
                continue;
            }
            sqlx::query(trimmed).execute(pool).await?;
        }

        // Record as applied
        sqlx::query("INSERT INTO _migrations (name) VALUES (?)")
            .bind(name)
            .execute(pool)
            .await?;
    }

    Ok(())
}
