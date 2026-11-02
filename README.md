# N.I.K.O.

**Path of Exile 1 strategy helper & profit tracker** — a native desktop app for map strategy optimization, cost analysis, and stash-based profit tracking.

## Features

- **Strategy Calculator** — Build map strategies with scarabs, delirium orbs, chisels; calculate cost per map and total investment with live prices from [poe.ninja](https://poe.ninja)
- **Atlas Tree Planner** — Canvas-based interactive atlas passive tree with GGG sprite sheets, shortest-path allocation, deallocation pruning, mastery group highlighting, wormhole visualization, and saved build management
- **Regex Filter Builder** — Create and test regex patterns for stash tab searching with 313 precomputed optimization patterns (250 char limit)
- **Trade Search** — Search the PoE Trade API using your built map configurations; find maps matching your strategy filters with rate-limited queries
- **Map Mod Picker** — Two-column avoid/prefer selection with danger values (data from [poe.re](https://github.com/veiset/poe.re))
- **Stash Viewer** — Browse stash tabs with item details and pricing (requires GGG login)
- **Map Tracking** — An in-game overlay counts your maps from `Client.txt` and takes stash snapshots at start and stop; the Strategies page shows measured div/hr, maps/hr and profit per map for each strategy (Windowed Fullscreen, English client)
- **GGG Account Integration** — OAuth2 PKCE login for account-linked features
- **League Selector** — Auto-fetches PC leagues from PoE API

## Tech Stack

| Layer | Stack |
|-------|-------|
| Desktop Shell | Tauri v2 (Rust) |
| Frontend | React 19, React Router v6, TanStack Query, Tailwind CSS |
| Database | SQLite (local) |
| Prices | poe.ninja API (1hr cache) |
| Trade | pathofexile.com/api/trade (rate limited, Rust proxy) |
| Auth | GGG OAuth2 PKCE |

## Getting Started

### Prerequisites

- Node.js 20+
- Rust toolchain ([rustup](https://rustup.rs))
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
├── public/atlas/                       # GGG sprite sheets (5 zoom levels, ~10MB)
├── src/                                # React frontend
│   ├── pages/                          # Route pages (Dashboard, Filters, Strategies, AtlasTree, Stash)
│   ├── components/
│   │   ├── atlas-tree/                 # Canvas tree renderer + stats panel
│   │   ├── filters/                    # Map mod picker
│   │   ├── strategies/                 # Strategy cost builder
│   │   └── ui/                         # Shared UI primitives
│   ├── data/atlas-tree-data.json       # GGG atlas data.json (nodes, sprites, groups)
│   ├── lib/
│   │   ├── ipc.ts                      # Typed Tauri IPC wrappers
│   │   ├── platform.ts                 # Browser API abstraction
│   │   ├── atlas-canvas-renderer.ts    # Canvas rendering engine (6 layers)
│   │   ├── atlas-sprite-loader.ts      # Sprite sheet loading + caching
│   │   ├── atlas-tree-utils.ts         # Tree processing, BFS, pruning
│   │   ├── auth-context.tsx            # GGG OAuth state
│   │   ├── league-context.tsx          # Active league selection
│   │   └── hooks/                      # TanStack Query data hooks
│   └── types/                          # Shared TypeScript types
├── src-tauri/                          # Rust backend
│   └── src/
│       ├── commands/                   # IPC command handlers (CRUD, trade, auth, stash)
│       ├── db/                         # SQLite migrations
│       ├── state.rs                    # Shared app state (DB, caches, tokens)
│       └── lib.rs                      # Plugin registration
├── .github/workflows/                  # Release CI/CD
└── scripts/                            # Updater key generation
```

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a detailed list of changes per release.

## Contributing

Found a bug or have a feature request? Please [open an issue](https://github.com/berkbulgan/niko-poe/issues/new/choose) using one of our templates:

- **Bug Report** — Something isn't working as expected
- **Feature Request** — Suggest a new feature or improvement

## Roadmap

- [x] Strategy cost calculator with live pricing
- [x] Atlas passive tree planner (Canvas + GGG sprites)
- [x] Regex filter builder + presets
- [x] PoE Trade search with rate limiting
- [x] Tauri v2 desktop migration
- [x] GGG OAuth2 PKCE login
- [x] Stash tab viewer
- [x] Stash snapshots + ROI tracking per strategy
- [ ] Net worth estimation from stash contents
- [x] Strategy profit history over time
- [ ] macOS / Linux builds

## Support

If N.I.K.O. helps your mapping, consider buying me a coffee:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/berkbulgan)

## License

Private — Not affiliated with Grinding Gear Games.
