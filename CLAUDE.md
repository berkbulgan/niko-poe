# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

N.I.K.O. — a Tauri v2 desktop app for Path of Exile 1 players. Regex filter builder, trade search, strategy cost calculator, atlas tree helper, and GGG account integration (OAuth + stash reading).

## Build & Dev

```bash
npm run dev           # Tauri dev (launches Vite + native window together)
npm run dev:vite      # Vite dev server only (port 1420)
npm run build         # Full production build (Vite + Rust → installer)
npm run build:vite    # Vite build only (outputs to dist/)
npm run lint          # ESLint
npm test              # Vitest
cd src-tauri && cargo check   # Rust type check
cd src-tauri && cargo build   # Full Rust build
```

## Architecture

Two-process model: React frontend in a Tauri WebView communicates with a Rust backend via IPC. No HTTP server runs in production.

```
React Component → useQuery hook → ipc.ts invoke() → Rust #[tauri::command] → SQLite/HTTP
```

### Frontend (`src/`)

- **`lib/ipc.ts`** — THE single point of Tauri IPC contact. Every `invoke()` call lives here. 34 typed wrappers for all Rust commands.
- **`lib/platform.ts`** — Abstracts browser APIs (storage, clipboard, external links). No raw `window.*` or `localStorage` calls should exist outside this file.
- **`lib/auth-context.tsx`** — GGG OAuth state. App works fully without login; OAuth unlocks stash features only.
- **`lib/league-context.tsx`** — Active PoE league selection, persisted via platform.storage.
- **`lib/hooks/`** — TanStack Query hooks for each data domain. Pattern: `useQuery({ queryFn: () => ipc.commandName() })`.
- **`pages/`** — Route-level components. React Router v6 HashRouter (required for Tauri production builds).
- **`providers.tsx`** — Provider composition order matters: QueryClient → Auth → League.

### Backend (`src-tauri/src/`)

- **`lib.rs`** — Tauri builder, plugin registration, all commands registered in one `generate_handler!` call.
- **`state.rs`** — `AppState` singleton: SQLite pool, HTTP client, rate limiter, price/league/stat caches (Arc<Mutex<T>>), GGG token state.
- **`commands/`** — 8 modules, 32 commands total. CRUD for 4 entities + trade + prices + auth + stash.
- **`db/migrations.rs`** — 4 versioned SQLite migrations. Append-only, no down migrations.
- **`error.rs`** — `Error` enum with `serde::Serialize` (required for IPC boundary crossing).

### Key Patterns

- **IPC contract**: Rust structs use `#[serde(rename_all = "camelCase")]`, TypeScript interfaces use camelCase — field names match 1:1.
- **Config columns**: Complex objects stored as `TEXT` (JSON string) in SQLite. Hooks handle `JSON.parse/stringify` at the boundary.
- **Rate limiting**: Rust-side token bucket for PoE Trade API. Reads `X-Rate-Limit-Ip-State` headers for adaptive backoff.
- **Caching**: Two layers — TanStack Query in frontend (UI cache), `Arc<Mutex<Cache>>` in Rust (API response cache with TTL).
- **Auth is optional**: `isAuthenticated: false` does not block any route. Stash page shows login prompt; all other features work without OAuth.

## Adding a New Rust Command

1. Add function with `#[tauri::command]` in `src-tauri/src/commands/module.rs`
2. Register in `src-tauri/src/lib.rs` invoke_handler
3. Add typed wrapper in `src/lib/ipc.ts`
4. Create/update hook in `src/lib/hooks/`

## Adding a New Page

1. Create `src/pages/PageName.tsx` (named export, not default)
2. Add route in `src/router.tsx`
3. Add nav item in `src/pages/AppLayout.tsx`

## External APIs

- **PoE Trade**: `www.pathofexile.com/api/trade/` — rate limited, proxied through Rust (PoE 1 uses `/api/trade/`, NOT `/api/trade2/`)
- **poe.watch**: `poe.watch/api` — price data, 15-min cache
- **GGG OAuth**: `oauth.pathofexile.com` — PKCE flow, localhost callback via tauri-plugin-oauth
- **GGG Stash**: `api.pathofexile.com/stash/` — requires OAuth token

## Git Workflow

- **NEVER commit directly to `main`**. All work happens on `dev` branch.
- Release flow: `dev` → PR → `main` → tag.
- Default working branch: `dev`.

## Placeholders That Need Real Values

- `NIKO_CLIENT_ID` in `src-tauri/src/commands/auth.rs` — GGG OAuth client ID
- `REPLACE_WITH_PUBLIC_KEY_FROM_KEYGEN_SCRIPT` in `tauri.conf.json` — updater signing pubkey
- `YOUR_GITHUB_USERNAME` in `.github/workflows/release.yml`
- `src-tauri/icons/` — placeholder icons, need real 1024x1024 source PNG
