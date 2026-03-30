# C.A.D.I.R.O.

**Capture All Data, Identify Real Opportunities**

Path of Exile 1 trade helper — regex-powered map mod filtering, strategy cost calculator, and filter preset sharing.

## Features

- **Map Mod Picker** — Two-column avoid/prefer selection with scary danger values (data from [poe-vendor-string](https://github.com/veiset/poe-vendor-string))
- **Regex Optimization** — 313 precomputed patterns for shorter stash search strings (250 char limit)
- **Trade Search** — Proxy search via pathofexile.com/api/trade, opens results in new tab
- **Strategy Calculator** — Pick scarabs, delirium orbs, chisels with live prices from [poe.watch](https://poe.watch), calculate cost per map and total investment
- **Filter Presets** — Save/load full configurations with 8-digit share codes
- **League Selector** — Auto-fetches PC leagues from PoE API, cached 24h

## Tech Stack

| Layer | Stack |
|-------|-------|
| Backend | NestJS 10, TypeORM, PostgreSQL |
| Frontend | Next.js 15 (App Router), TanStack Query, Tailwind CSS |
| Prices | poe.watch API (15min cache) |
| Trade | pathofexile.com/api/trade (rate limited) |

## Getting Started

### Prerequisites

- Node.js 20+
- Docker (for PostgreSQL)

### Setup

```bash
# Clone
git clone git@github.com:berkbulgan/cadiro.git
cd cadiro

# Start PostgreSQL (port 9391)
docker compose up -d

# Install dependencies
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..

# Configure environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Seed database (test users + sample filters)
cd backend && npm run seed

# Run both backend (3001) and frontend (3000)
npm run dev
```

### Test Accounts

| Username | Password |
|----------|----------|
| test1 | 123456 |
| test2 | 123456 |

## Project Structure

```
cadiro/
├── backend/                 # NestJS API
│   └── src/
│       ├── auth/            # Placeholder JWT auth
│       ├── filter-presets/   # Saved filter configurations
│       ├── prices/          # poe.watch price cache
│       ├── regex-filters/   # Regex CRUD + validation
│       ├── strategies/      # Cost calculator strategies
│       └── trade/           # PoE trade API proxy + leagues
├── frontend/                # Next.js App
│   └── src/
│       ├── app/             # Pages (landing, login, filters, strategies)
│       ├── components/      # UI components + feature components
│       ├── data/            # Map mod data + optimization table
│       └── lib/             # API client, hooks, contexts
└── docker-compose.yml       # PostgreSQL on port 9391
```

## API Endpoints

### Auth
- `POST /auth/login` — Login
- `GET /auth/me` — Current user

### Filter Presets
- `GET/POST /filter-presets` — List / Create
- `GET/PATCH/DELETE /filter-presets/:id` — Read / Update / Delete
- `GET /filter-presets/share/:code` — Get by share code
- `POST /filter-presets/import/:code` — Import shared preset

### Strategies
- `GET/POST /strategies` — List / Create
- `GET/PATCH/DELETE /strategies/:id` — Read / Update / Delete
- `GET /strategies/share/:code` — Get by share code
- `POST /strategies/import/:code` — Import shared strategy

### Trade
- `POST /trade/search-by-mods` — Search trade by modifier texts
- `GET /trade/leagues` — Available leagues (24h cache)
- `GET /trade/stats/search?q=life` — Search stat IDs

### Prices
- `GET /prices/:category?league=X` — Item prices (scarab, deliriumOrb, chisel, currency)
- `POST /prices/refresh` — Force cache refresh

## Roadmap

- [ ] GGG OAuth integration (application submitted)
- [ ] Stash snapshots + ROI tracking
- [ ] Atlas passive tree viewer
- [ ] Community strategy sharing feed
- [ ] Cost per map history tracking

## License

Private — Not affiliated with Grinding Gear Games.
