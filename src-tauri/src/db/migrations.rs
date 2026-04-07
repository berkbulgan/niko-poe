// ABOUTME: SQLite migration definitions for N.I.K.O. data layer.
// ABOUTME: All migrations are append-only; no down migrations for desktop app.

use tauri_plugin_sql::{Migration, MigrationKind};

pub fn get_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_regex_filters",
            sql: "CREATE TABLE IF NOT EXISTS regex_filters (
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
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_filter_presets",
            sql: "CREATE TABLE IF NOT EXISTS filter_presets (
                id         TEXT PRIMARY KEY NOT NULL,
                name       TEXT NOT NULL,
                config     TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create_strategies",
            sql: "CREATE TABLE IF NOT EXISTS strategies (
                id         TEXT PRIMARY KEY NOT NULL,
                name       TEXT NOT NULL,
                config     TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "create_atlas_trees",
            sql: "CREATE TABLE IF NOT EXISTS atlas_trees (
                id         TEXT PRIMARY KEY NOT NULL,
                name       TEXT NOT NULL,
                config     TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );",
            kind: MigrationKind::Up,
        },
    ]
}
