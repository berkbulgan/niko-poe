// ABOUTME: Tauri application builder and plugin registration.
// ABOUTME: AppState is managed here; commands are registered per phase.

pub mod client_log;
pub mod commands;
pub mod db;
pub mod error;
pub mod state;

use std::sync::Arc;
use sqlx::sqlite::SqlitePoolOptions;
use tauri::Manager;
use tauri::path::BaseDirectory;
use tokio::sync::Mutex;

use commands::{
    atlas_trees::{
        create_atlas_tree, delete_atlas_tree, get_atlas_tree, get_atlas_trees, update_atlas_tree,
    },
    auth::{get_ggg_profile, logout_ggg, refresh_ggg_token, start_oauth_login},
    community::{
        community_delete, community_favourite, community_get, community_list, community_publish,
        community_report, community_tags, community_update, set_community_base_url,
    },
    filter_presets::{
        create_filter_preset, delete_filter_preset, get_filter_preset, get_filter_presets,
        update_filter_preset,
    },
    prices::{
        fetch_all_prices, get_price_leagues, get_prices, is_prices_loading, lookup_item_prices,
        lookup_item_prices_advanced,
    },
    regex_filters::{
        create_regex_filter, delete_regex_filter, get_regex_filter, get_regex_filters,
        update_regex_filter,
    },
    sharing::{content_hash, decode_share_code, encode_share_code, import_from_pastebin},
    snapshots::{
        create_snapshot_config, delete_snapshot, delete_snapshot_config, get_recent_snapshots,
        get_snapshot_configs, get_snapshot_detail, get_snapshots, take_snapshot,
        update_snapshot_config,
    },
    stash::{get_stash_tab_contents, get_stash_tabs},
    strategies::{
        create_strategy, delete_strategy, get_strategy, get_strategies, update_strategy,
    },
    tracking::{
        get_tracker_state, start_tracking_run, switch_tracking_strategy, stop_tracking_run,
        dismiss_tracking_suggestion, get_tracking_history, reassign_map_runs, delete_tracking_run,
        get_tracker_settings, set_tracker_settings,
    },
    trade::{
        fetch_trade_results, get_leagues, get_trade_stats, proxy_search, search_trade,
    },
};
use state::AppState;

const DB_FILENAME: &str = "niko.db";

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_oauth::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .resolve("", BaseDirectory::AppData)
                .expect("failed to resolve app data dir");
            std::fs::create_dir_all(&app_data_dir)
                .expect("failed to create app data dir");

            let db_path = app_data_dir.join(DB_FILENAME);
            let db_url = format!("sqlite:{}?mode=rwc", db_path.display());

            let pool = tauri::async_runtime::block_on(async {
                let p = SqlitePoolOptions::new()
                    .max_connections(5)
                    .connect(&db_url)
                    .await
                    .expect("failed to open SQLite pool");

                db::migrations::run_migrations(&p)
                    .await
                    .expect("failed to run database migrations");

                p
            });

            let tracker =
                tauri::async_runtime::block_on(commands::tracking::load_tracker(app.handle(), &pool));

            let http_client = reqwest::Client::builder()
                .user_agent("NIKO-TradeHelper/0.1.0")
                .build()
                .expect("failed to build HTTP client");

            let app_state = AppState {
                pool,
                http_client,
                rate_limiter: Arc::new(Mutex::new(state::RateLimiter::new())),
                ninja_prices: Arc::new(Mutex::new(state::NinjaPriceCache::new())),
                league_cache: Arc::new(Mutex::new(state::LeagueCache::new())),
                stat_cache: Arc::new(Mutex::new(state::StatCache::new())),
                ggg_token: Arc::new(Mutex::new(None)),
                tracker: Arc::new(Mutex::new(tracker)),
                community_base_url: Arc::new(Mutex::new(commands::community::default_base_url())),
            };

            // Restore previously stored GGG tokens (silent — ignores missing/expired).
            commands::auth::try_load_tokens_from_store(app.handle(), &app_state);

            app.manage(app_state);
            commands::tracking::spawn_watcher(app.handle().clone());

            // The overlay is a second window; closing the main window must quit the app with it.
            if let Some(main) = app.get_webview_window("main") {
                let handle = app.handle().clone();
                main.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { .. } = event {
                        handle.exit(0);
                    }
                });
            }
            // Alt+F4 on the overlay would destroy it for the rest of the session; Settings hides it instead.
            if let Some(overlay) = app.get_webview_window("overlay") {
                overlay.on_window_event(|event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // regex_filters
            get_regex_filters,
            get_regex_filter,
            create_regex_filter,
            update_regex_filter,
            delete_regex_filter,
            // filter_presets
            get_filter_presets,
            get_filter_preset,
            create_filter_preset,
            update_filter_preset,
            delete_filter_preset,
            // strategies
            get_strategies,
            get_strategy,
            create_strategy,
            update_strategy,
            delete_strategy,
            // atlas_trees
            get_atlas_trees,
            get_atlas_tree,
            create_atlas_tree,
            update_atlas_tree,
            delete_atlas_tree,
            // trade (Phase 3)
            get_leagues,
            get_trade_stats,
            search_trade,
            fetch_trade_results,
            proxy_search,
            // prices (Phase 3)
            get_prices,
            lookup_item_prices,
            lookup_item_prices_advanced,
            fetch_all_prices,
            is_prices_loading,
            get_price_leagues,
            // auth (Phase 4)
            start_oauth_login,
            get_ggg_profile,
            logout_ggg,
            refresh_ggg_token,
            // stash (Phase 4)
            get_stash_tabs,
            get_stash_tab_contents,
            // sharing
            encode_share_code,
            decode_share_code,
            import_from_pastebin,
            content_hash,
            // snapshots
            get_snapshot_configs,
            create_snapshot_config,
            update_snapshot_config,
            delete_snapshot_config,
            take_snapshot,
            get_snapshots,
            get_snapshot_detail,
            get_recent_snapshots,
            delete_snapshot,
            // tracking
            get_tracker_state,
            start_tracking_run,
            switch_tracking_strategy,
            stop_tracking_run,
            dismiss_tracking_suggestion,
            get_tracking_history,
            reassign_map_runs,
            delete_tracking_run,
            get_tracker_settings,
            set_tracker_settings,
            // community
            community_list,
            community_get,
            community_tags,
            community_publish,
            community_update,
            community_delete,
            community_favourite,
            community_report,
            set_community_base_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
