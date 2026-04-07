# Changelog

All notable changes to N.I.K.O. are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/).

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
