# Changelog

All notable changes to N.I.K.O. are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- **Measured community results** — After you stop a tracked run, the overlay offers to share its result (maps, time and profit only, anonymous) with the community strategy you played; strategies imported from the community or published by you qualify while unchanged
- Community strategies show median div/hr, maps/hr and profit per map from players' shared runs, and can be sorted by "Most profitable"

## [0.6.1] - 2026-11-09

### Changed
- Prices and the league list are fetched through the N.I.K.O. community server (cached), falling back to poe.ninja directly if it can't be reached
- The league list now comes from poe.ninja, so new leagues show up without an app update

### Fixed
- Trade requests send the proper GGG User-Agent

## [0.6.0] - 2026-11-02

### Added
- **Map tracking** — N.I.K.O. watches the game's Client.txt and asks "Track?" when you enter a map; a run takes a stash snapshot at start and end and records every map with its time
- **Overlay** — Small always-on-top window to start, stop or switch strategy mid-run (switching takes a fresh snapshot); can be turned off in Settings
- **Per-strategy results** — Strategies page shows profit per map, profit per hour and a run history chart; maps can be moved to another strategy or runs deleted
- Settings: Client.txt path (auto-detected for the standalone and Steam clients)

## [0.5.0] - 2026-11-02

### Added
- **Community strategies** — Publish a saved strategy (with its linked filter preset and atlas tree) to the N.I.K.O. community server with name, tags, league, patch, budget, difficulty, video link and markdown notes; update or unpublish it later from the same install
- **Community page** — Browse published strategies by search, league, tag and newest/most favourited; preview notes and items repriced with live poe.ninja prices, then import, favourite or report
- Import accepts a community strategy ID next to share codes and Pastebin links
- Settings: optional custom community server address

## [0.4.1] - 2026-11-02

### Fixed
- Prices load again — poe.ninja moved its economy API, so every price request failed and stash snapshots could not be taken
- League list updated to Allflame
- The Astrolabe picker lists astrolabes instead of all currency

## [0.4.0] - 2026-11-02

### Added
- **Automatic updates** — The app checks for a new release on startup and offers to install it
- **Daily game data sync** — Atlas tree and map mod regex data are checked daily and shipped as patch releases when they change

### Changed
- Atlas tree data updated to 3.29.1 (+45 / -3 nodes); now follows GGG's main atlas tree export
- Map mod regex data updated from poe.re (1 added, 1 removed, 92 changed); 46 saved mod ids remapped
- The app window comes to the front after GGG login; the callback page no longer promises to close itself

### Fixed
- Saved filter presets keep their mods when upstream data changes mod ids

## [0.3.0] - 2026-11-02

### Added
- **Share Code Export/Import** — PoB-inspired encoding pipeline (JSON → deflate → base64) for filter presets, atlas trees, and strategies
- Strategy export bundles linked FilterPreset and AtlasTree inline
- Import with content-hash dedup (SHA256) prevents duplicate entities
- Pastebin URL import support (fetches raw paste, no API key needed)
- Name collision handling with " (2)", " (3)" suffixes
- **Stash Snapshots** — Take point-in-time snapshots of selected stash tabs with automatic poe.ninja pricing
- **Snapshot Configs** — Save reusable tab selections (e.g. "Dump Tabs", "Currency Only") with optional strategy linking
- **ROI Tracking** — Link a config to a strategy, take before/after snapshots, see gross profit minus strategy cost
- **Net Worth History** — SVG line chart showing stash value over time per config
- **Dashboard Snapshots Widget** — Last 5 snapshots with config name, value, and delta from previous
- **Divine/Chaos Toggle** — Currency display toggle (default divine) shared across all pages via Zustand store
- **Unpriced Item Tracking** — Items without poe.ninja price shown separately with count indicator
- **Advanced Item Matching** — Gem level/quality/corruption, unique links/variant, map tier matching for accurate pricing
- **Shared PricedItemTable** — Reusable sortable item table used by both stash browse and snapshot detail
- **OAuth Callback Page** — Styled browser callback page for GGG OAuth login with auto-close
- **GGG Disclaimer** — Added to OAuth callback, Settings > About, and NSIS installer preinstall hook
- **Unsaved Changes Indicator** — Shows next to Save button when current state differs from saved config
- **Shared UI Components** — Extracted EditorToolbar, SaveEntityModal, SidebarEntityRow, EntitySidebar
- **Developer Credits** — Settings > About with social links and Buy Me a Coffee donation button
- **Toast notifications** — Failed saves/deletes/snapshots and login errors are reported; successful saves confirmed
- **Update to current prices** — Refresh a strategy's saved item prices from poe.ninja
- Confirmation before deleting presets, strategies, trees, snapshots and snapshot configs
- Unsaved-changes prompt when loading or duplicating another entity
- Dashboard recent presets/snapshots open the matching preset or snapshot config
- Currency unit (divine/chaos) setting in Settings > General, persisted across restarts
- Ctrl+Z undo in the atlas tree

### Changed
- **Pricing source migrated from poe.watch to poe.ninja** — 29 categories (up from 5), 1-hour cache
- **Prices fetch on league change** — No more startup blocking; fetches when league is selected
- **League selector** — Hardcoded to 4 poe.ninja-supported leagues (Mirage, HC Mirage, Standard, Hardcore)
- **Total column display** — Divine is primary (bigger font) when value >= 1 div, chaos shown below
- **Sidebar loading indicator** — "Fetching prices..." pulse animation during price fetch
- Nightmare checkboxes moved into Map Stats box header
- State persistence across navigation via Zustand stores (filters, strategies, atlas tree)
- Astrolabe mapsPerUse corrected from 8 to 5
- PoeIcon: added `rarity`, `corrupted`, `currency`, `tier` aliases
- Expired GGG sessions refresh automatically; login verifies the OAuth `state` parameter
- Stash requests handle 401/403/429 with clear messages
- Narrow-screen menu shows full navigation and closes on navigation
- Higher contrast for muted text; icon buttons have accessible labels

### Fixed
- Page state lost when navigating between tabs (Zustand stores replace local useState)
- Selected preset/strategy/tree not preserved on tab switch
- Divine Orb price accuracy (use `min` field over unreliable `mean`)
- Strategy builder mapsPerUse not applied correctly on config load
- Line chart Y-axis labels clipped on left side
- Snapshots could be priced with another league's prices or with an empty price cache
- Price cache race when switching leagues quickly; Chaos Orb missing from currency prices
- Trade search and result fetch sent wrong IPC arguments
- Strategy items of the same category could not be edited or removed independently
- Snapshot ROI used a different strategy cost than the Strategies page
- Stash low-listings warning, tab colours and empty/error states
- Filters page unusable at small window heights

## [0.2.0] - 2026-04-07

### Added
- **Atlas Tree Planner** — Canvas renderer using official GGG sprite sheets (5 zoom levels, 41 assets)
- Shortest-path allocation: click any node to auto-fill the path from root
- Deallocation pruning: removing a node also removes disconnected branches
- Hover previews: gold glow for path-to-allocate, red glow for nodes-to-prune
- Mastery group highlighting: hover a mastery to see all related clusters blink
- Wormhole visualization: dashed purple links visible on hover or when allocated
- Orbit arc connections for same-orbit nodes, straight lines for cross-orbit
- Search with blinking highlights and off-screen directional arrows
- Accordion stats panel: Keystones, Notables, Small Passives (collapsible)
- Over-limit allocation with warning toast
- Collapsible navigation sidebar (icons-only below 1280px)
- Edge-to-edge layout across all pages
- Strategy builder: linked atlas tree shows point count + keystone/notable badges with tooltips
- Auto-release workflow: semver labels on dev→main PRs trigger version bump + tag + build
- Branch protection on main and dev with CODEOWNERS
- CONTRIBUTING.md with branch naming, release flow, and code style guidelines

### Changed
- Atlas tree data source: hand-built JSON → GGG official `league.json` export
- Page sidebars compacted (w-64 → w-48)
- Hub nodes treated as transparent connectors (never rendered, always traversable)

### Fixed
- Float precision in stat aggregation (0.2% × 3 = 0.6%, not 0.6000000001%)
- GGG profile username not displaying (missing serde `rename_all = "camelCase"`)
- Strategy builder `allocatedNodes` → `allocatedNodeIds` property reference

## [0.1.2] - 2026-04-07

### Fixed
- Trade search not returning results (API URL correction)
- Layout overflow on strategy page

## [0.1.1] - 2026-04-07

### Added
- Loading screen with bulk price fetch from poe.watch (~54k items)
- Expandable folder tabs and sortable table view in stash
- Divine conversion display for high-value items
- Settings page shell with General and Stash Ignore List tabs
- Atlas tree linking in strategies
- Default league persistence

### Fixed
- Database tables not created (migrations ran on wrong DB handle)
- Strategy/filter save not persisting to sidebar list
- Chisels and astrolabes not appearing in item picker
- Price matching against poe.watch data

## [0.1.0] - 2026-04-07

### Added
- Native Tauri v2 desktop app with React frontend
- Local SQLite database, 32 Rust IPC commands
- GGG OAuth2 PKCE login with secure token storage
- Stash tab viewer with pricing (requires login)
- PoE Trade search with rate-limited Rust proxy
- poe.watch price cache with 15-min TTL
- Atlas tree helper (SVG-based, pre-overhaul)
- Strategy cost calculator with live pricing
- Regex filter builder with 313 optimization patterns
- Map mod picker with avoid/prefer columns
