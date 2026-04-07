# Roadmap: C.A.D.I.R.O. — Tauri Desktop Migration

## Overview

Migrating C.A.D.I.R.O. from a Next.js web app to a native Tauri v2 desktop application. The journey moves in five dependency-ordered phases: first the Tauri shell and platform abstraction that replaces the browser runtime, then the SQLite data layer that replaces Prisma + PostgreSQL, then the Trade API in Rust that replaces Next.js API proxy routes, then GGG OAuth and stash integration, and finally packaging and distribution for public release. Existing React components, TypeScript types, and Tailwind theme survive unchanged throughout.

## Phases

- [ ] **Phase 1: Tauri Shell** - Native desktop window with platform abstraction and React Router
- [ ] **Phase 2: SQLite Data Layer** - Local database replaces PostgreSQL; all CRUD via IPC commands
- [ ] **Phase 3: Trade API** - PoE Trade API and poe.watch via Rust HTTP client with rate limiting
- [ ] **Phase 4: GGG OAuth + Stash** - PKCE login, token storage, stash tab integration
- [ ] **Phase 5: Distribution** - Windows installer, auto-updater, CSP, production build

## Phase Details

### Phase 1: Tauri Shell
**Goal**: The app runs as a native desktop window with working navigation and no browser-API leakage
**Depends on**: Nothing (first phase)
**Requirements**: TAURI-01, TAURI-02, TAURI-03, TAURI-04
**Success Criteria** (what must be TRUE):
  1. App launches as a native Tauri v2 window showing the PoE-themed dark UI — no browser required
  2. All four routes (dashboard, filters, strategies, atlas tree) are reachable via React Router HashRouter
  3. `lib/platform.ts` wraps localStorage, external links, and clipboard so no raw `window.*` calls exist in feature code
  4. `tauri dev` starts the Vite dev server with hot reload; changes in React are visible immediately
**Plans**: 3 plans

Plans:
- [ ] 1/01-PLAN.md — Tauri v2 scaffold + Vite build tooling (src-tauri/, vite.config.ts, package.json)
- [ ] 1/01-PLAN.md — Platform abstraction layer (platform.ts, auth-context stub, league-context adapt)
- [ ] 1/01-PLAN.md — React Router migration + Next.js cleanup (pages/, router.tsx, delete src/app/)

### Phase 2: SQLite Data Layer
**Goal**: All user data lives in a local SQLite database accessible via typed Tauri IPC commands; no regression from web version
**Depends on**: Phase 1
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07
**Success Criteria** (what must be TRUE):
  1. App creates a SQLite database file on first launch; subsequent launches load existing data
  2. Schema migrations run automatically on startup without manual intervention
  3. User can create, edit, delete, and list regex filters — same capability as the web version
  4. User can create, edit, delete, and list filter presets, strategies, and atlas trees — no regression
  5. TanStack Query hooks call `invoke()` instead of `fetch()`; server state management behavior is unchanged
**Plans**: 3 plans

Plans:
- [ ] 2/02-01-PLAN.md — SQLite plugin setup, migrations (4 tables), AppState, unified error type
- [ ] 2/02-02-PLAN.md — 16 Rust CRUD commands (filters, presets, strategies, atlas_trees)
- [ ] 2/02-03-PLAN.md — lib/ipc.ts typed wrappers + TanStack Query hook adaptation + human verify

### Phase 3: Trade API
**Goal**: PoE Trade search and poe.watch price data are served from the Rust backend with rate limiting enforced
**Depends on**: Phase 2
**Requirements**: TRADE-01, TRADE-02, TRADE-03, TRADE-04, TRADE-05
**Success Criteria** (what must be TRUE):
  1. User can search PoE Trade from the app; results arrive without hitting the Next.js proxy
  2. App never sends more than the allowed PoE API rate (enforced in Rust, not the frontend)
  3. poe.watch prices are available with a TTL-based cache; repeated reads do not re-fetch until stale
  4. Trade mod stats and base-type static data are served from a Rust-side cache, no per-call API hit
  5. User can select the active league from a cached list that refreshes periodically
**Plans**: 5 plans

Plans:
- [ ] 3/PLAN.md (Plan 01) — AppState trade fields + Cargo dependencies (reqwest, tokio, once_cell, urlencoding)
- [ ] 3/PLAN.md (Plan 02) — Rate limiter: 1500ms base gap + X-Rate-Limit-* header-driven backoff
- [ ] 3/PLAN.md (Plan 03) — commands/trade.rs: search_trade, fetch_trade_results, get_leagues, get_trade_stats, proxy_search
- [ ] 3/PLAN.md (Plan 04) — commands/prices.rs: get_prices with 15-min TTL cache + virtual categories
- [ ] 3/PLAN.md (Plan 05) — Frontend: ipc.ts trade/price wrappers + hook migration (use-trade-stats, use-prices, use-leagues)

### Phase 4: GGG OAuth + Stash
**Goal**: User can log in with their GGG account via PKCE flow; tokens persist across launches; stash tabs are readable if scope allows
**Depends on**: Phase 3
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, STASH-01, STASH-02, STASH-03
**Success Criteria** (what must be TRUE):
  1. User can initiate GGG OAuth login from the app; browser opens, callback returns to the app via localhost
  2. Access and refresh tokens survive app restart (stored encrypted via tauri-plugin-store)
  3. Expired tokens are refreshed automatically without requiring the user to log in again
  4. Logged-in user sees their GGG account profile (character name or account name)
  5. App remains fully functional (filters, trade, strategies) when the user has not logged in
  6. Stash tab list and contents are visible in the app if `account:stashes` scope is confirmed available for public clients (scope availability verified via STASH-01 spike)
**Plans**: TBD

### Phase 5: Distribution
**Goal**: A signed Windows installer ships to users and keeps itself up to date automatically
**Depends on**: Phase 4
**Requirements**: DIST-01, DIST-02, DIST-03, DIST-04
**Success Criteria** (what must be TRUE):
  1. A Windows NSIS installer (.exe) is generated from `tauri build` and installs the app cleanly
  2. Auto-updater checks for and applies updates without requiring the user to re-download the installer
  3. The updater signing keypair exists, is documented, and is vaulted before the first production build
  4. Production CSP allows requests to PoE Trade API and poe.watch domains; no console errors on launch
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Tauri Shell | 0/3 | Planned | - |
| 2. SQLite Data Layer | 0/3 | Planned | - |
| 3. Trade API | 0/5 | Planned | - |
| 4. GGG OAuth + Stash | 0/TBD | Not started | - |
| 5. Distribution | 0/TBD | Not started | - |
