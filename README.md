# N.I.K.O.

**Path of Exile 1 trade helper** — a native desktop app for regex-powered item filtering, trade search, strategy cost calculation, and GGG account integration.

## Features

- **Regex Filter Builder** — Create and test regex patterns against PoE mod database, organize with categories
- **Map Mod Picker** — Two-column avoid/prefer selection with danger values (data from [poe-vendor-string](https://github.com/veiset/poe-vendor-string))
- **Regex Optimization** — 313 precomputed patterns for shorter stash search strings (250 char limit)
- **Trade Search** — Search PoE Trade API with rate limiting, view results with pricing
- **Strategy Calculator** — Pick scarabs, delirium orbs, chisels with live prices from [poe.watch](https://poe.watch)
- **Atlas Tree Helper** — Interactive passive tree viewer
- **Filter Presets** — Save and load full filter configurations
- **GGG Account Login** — OAuth2 PKCE integration for account features
- **Stash Viewer** — Browse stash tabs with item details and pricing (requires GGG login)
- **League Selector** — Auto-fetches PC leagues from PoE API

## Tech Stack

| Layer | Stack |
|-------|-------|
| Desktop Shell | Tauri v2 (Rust) |
| Frontend | React 19, React Router v6, TanStack Query, Tailwind CSS |
| Database | SQLite (local, via sqlx) |
| Trade API | pathofexile.com/api/trade (rate limited, Rust proxy) |
| Prices | poe.watch API (15min cache) |
| Auth | GGG OAuth2 PKCE (tauri-plugin-oauth) |

## Getting Started

### Prerequisites

- Node.js 20+
- Rust toolchain (rustup)
- Platform build tools (Visual Studio Build Tools on Windows)

### Setup

```bash
git clone git@github.com:berkbulgan/niko-poe.git
cd niko-poe

npm install

# Development (launches Vite + Tauri window)
npm run dev
```

### Build

```bash
# Full production build (outputs Windows installer)
npm run build
```

## Project Structure

```
niko-poe/
├── src/                        # React frontend
│   ├── pages/                  # Route pages (Dashboard, Filters, Strategies, AtlasTree, Stash)
│   ├── components/             # UI + feature components
│   ├── lib/
│   │   ├── ipc.ts              # Typed Tauri IPC wrappers
│   │   ├── platform.ts         # Browser API abstraction
│   │   ├── auth-context.tsx    # GGG OAuth state
│   │   ├── league-context.tsx  # Active league selection
│   │   └── hooks/              # TanStack Query data hooks
│   └── types/                  # Shared TypeScript types
├── src-tauri/                  # Rust backend
│   └── src/
│       ├── commands/           # IPC command handlers (CRUD, trade, auth, stash)
│       ├── db/                 # SQLite migrations
│       ├── state.rs            # Shared app state (DB, caches, tokens)
│       └── lib.rs              # Plugin registration
├── .github/workflows/          # Release CI/CD
└── scripts/                    # Updater key generation
```

## Roadmap

- [x] Regex filter builder + presets
- [x] Trade search with rate limiting
- [x] Strategy cost calculator
- [x] Atlas passive tree helper
- [x] Tauri v2 desktop migration
- [x] GGG OAuth2 PKCE login
- [x] Stash tab viewer
- [ ] Filter push to PoE account (account:item_filter)
- [ ] Stash snapshots + ROI tracking
- [ ] Net worth estimation
- [ ] macOS / Linux builds

## License

Private — Not affiliated with Grinding Gear Games.
