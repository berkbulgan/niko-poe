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
- **`lib/atlas-sprite-loader.ts`** — Loads GGG sprite sheets by zoom level, caches images, provides drawSprite API for Canvas rendering.
- **`lib/atlas-canvas-renderer.ts`** — Canvas-based atlas tree renderer with 6 layers: background, group bg, start node, connections (orbit arcs + straight lines), node icons/frames, highlights. Handles hit testing, path/prune previews, mastery group highlights, blinking animations, off-screen arrows.
- **`lib/atlas-tree-utils.ts`** — Pure utility functions: node positioning, stat aggregation, BFS pathfinding, hub node detection, allocatable neighbor computation, connectivity pruning, connection building.
- **`pages/`** — Route-level components. React Router v6 HashRouter (required for Tauri production builds).
- **`providers.tsx`** — Provider composition order matters: QueryClient → Auth → League.

### Atlas Tree Data (`src/data/atlas-tree-data.json`)

GGG's official `data.json` export from [atlastree-export](https://github.com/grindinggear/atlastree-export) at its latest release tag, kept current by `scripts/sync-game-data.mjs` (map mod data in `src/data/` comes from [poe.re](https://github.com/veiset/poe.re) the same way; `src/data/sources.json` records the bundled versions and `mod-id-aliases.json` maps re-id'd mods for saved presets). Contains node definitions, group positions, sprite sheet coordinates, orbit constants, wormhole data, and tree bounds. Sprite assets served from `public/atlas/` (41 files, ~10MB).

### Atlas Tree Architecture

- **Canvas renderer** — Not SVG. Uses GGG sprite sheets with 5 zoom levels (0.1246–0.5).
- **Hub nodes** — Nameless structural connectors (root → hub → starting nodes). Treated as transparent bridges — never rendered or allocated.
- **Orbit arcs** — Same-group + same-orbit connections use arc geometry. Cross-orbit connections use straight lines.
- **Wormholes** — Gateway nodes connecting distant tree branches. Links visible only on hover or when allocated.
- **Path allocation** — Click any node to auto-allocate shortest path from current allocation (or from hub if nothing allocated).
- **Deallocation pruning** — Removing a node also removes all nodes disconnected from root.
- **Mastery group highlight** — Hovering a mastery highlights all same-name masteries across the tree with blinking animation.

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
- **poe.ninja**: `poe.ninja/api/data` — price data (currency + 27 item categories), 1-hour cache
- **GGG OAuth**: `oauth.pathofexile.com` — PKCE flow, localhost callback via tauri-plugin-oauth
- **GGG Stash**: `api.pathofexile.com/stash/` — requires OAuth token

## Git Workflow

- **NEVER commit directly to `main` or `dev`**. Both branches are protected (PR required, no direct push, no force push).
- Default working branch: `dev`.
- Branch naming: `feat/N-desc`, `fix/N-desc`, `chore/N-desc`, etc. (see CONTRIBUTING.md).

### Release Flow

```
feature branch → PR → dev → PR (with semver label) → main → auto tag + release
```

1. Feature branch from `dev` → PR → merge to `dev`
2. **Update `CHANGELOG.md`** with the new version's changes before opening the release PR
3. `dev` → `main` PR with semver label (`patch`/`minor`/`major`)
4. On merge: `auto-release.yml` bumps version in `package.json` + `tauri.conf.json` + `Cargo.toml`, commits, tags
5. Tag push triggers `release.yml` → Windows installer build → published GitHub Release (the in-app updater only sees published releases)

### CI/CD Workflows

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `auto-release.yml` | PR with semver label merged to `main` | Version bump → commit → tag push → merge `main` back into `dev` |
| `release.yml` | Tag push (`v*.*.*`) | Tauri build → NSIS installer → GitHub Release (published) |
| `data-sync.yml` | Daily 06:00 UTC + manual | Pulls atlas/regex data → PR (label `patch`) → auto-merge when checks pass |

## Placeholders That Need Real Values

- `NIKO_CLIENT_ID` in `src-tauri/src/commands/auth.rs` — GGG OAuth client ID
- `REPLACE_WITH_PUBLIC_KEY_FROM_KEYGEN_SCRIPT` in `tauri.conf.json` — updater signing pubkey
- `YOUR_GITHUB_USERNAME` in `.github/workflows/release.yml`
- `src-tauri/icons/` — placeholder icons, need real 1024x1024 source PNG
