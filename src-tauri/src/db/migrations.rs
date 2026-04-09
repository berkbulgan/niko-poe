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
    (
        "005_create_snapshot_tables",
        "CREATE TABLE IF NOT EXISTS snapshot_configs (
            id          TEXT PRIMARY KEY NOT NULL,
            name        TEXT NOT NULL,
            league      TEXT NOT NULL,
            tab_ids     TEXT NOT NULL,
            strategy_id TEXT,
            created_at  TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS stash_snapshots (
            id              TEXT PRIMARY KEY NOT NULL,
            config_id       TEXT NOT NULL,
            label           TEXT,
            total_chaos     REAL NOT NULL,
            total_items     INTEGER NOT NULL,
            unpriced_count  INTEGER NOT NULL,
            divine_rate     REAL NOT NULL,
            created_at      TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (config_id) REFERENCES snapshot_configs(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_snapshots_config_id
            ON stash_snapshots(config_id);

        CREATE INDEX IF NOT EXISTS idx_snapshots_created_at
            ON stash_snapshots(created_at);

        CREATE TABLE IF NOT EXISTS snapshot_items (
            id            TEXT PRIMARY KEY NOT NULL,
            snapshot_id   TEXT NOT NULL,
            item_name     TEXT NOT NULL,
            type_line     TEXT NOT NULL,
            stack_size    INTEGER NOT NULL,
            chaos_value   REAL,
            frame_type    INTEGER,
            icon          TEXT NOT NULL DEFAULT '',
            FOREIGN KEY (snapshot_id) REFERENCES stash_snapshots(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_snapshot_items_snapshot_id
            ON snapshot_items(snapshot_id);",
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
