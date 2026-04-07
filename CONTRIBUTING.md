# Contributing to N.I.K.O.

## Branch Strategy

```
feature branch → PR → dev → PR (with semver label) → main → auto tag + release
```

### Protected Branches

| Branch | Direct push | Force push | PR required | Merge by |
|--------|------------|------------|-------------|----------|
| `main` | Blocked | Blocked | Yes | Owner only |
| `dev` | Blocked | Blocked | Yes | Owner only |

### Branch Naming

All branches must use namespaced prefixes:

| Prefix | Use Case | Example |
|--------|----------|---------|
| `feat/N-desc` | New features | `feat/44-atlas-tree-overhaul` |
| `fix/N-desc` | Bug fixes | `fix/23-timer-crash-on-pause` |
| `hotfix/N-desc` | Urgent production fixes | `hotfix/67-critical-data-loss` |
| `chore/N-desc` | Maintenance, tooling, deps | `chore/12-update-dependencies` |
| `docs/N-desc` | Documentation | `docs/89-api-documentation` |
| `test/N-desc` | Test improvements | `test/45-integration-coverage` |
| `refactor/N-desc` | Code restructuring | `refactor/34-extract-service` |

`N` is the issue number when applicable. Use kebab-case for descriptions.

## Release Flow

1. Create a feature branch from `dev`
2. Open a PR to `dev` — describe changes, test locally
3. Merge to `dev`
4. When ready to release: open a PR from `dev` → `main`
5. Add a **semver label** to the PR:
   - `patch` (green) — bug fixes: `0.1.2` → `0.1.3`
   - `minor` (blue) — new features: `0.1.2` → `0.2.0`
   - `major` (red) — breaking changes: `0.1.2` → `1.0.0`
6. Merge the PR — auto-release workflow handles the rest:
   - Bumps version in `package.json`, `tauri.conf.json`, `Cargo.toml`
   - Creates a git tag (`v0.2.0`)
   - Triggers the release build (Windows NSIS installer)
   - Creates a draft GitHub Release

## Commit Messages

Write concise commit messages focused on **why**, not what. No strict format enforced, but prefer:

```
Fix float precision in atlas stat aggregation

Three identical 0.2% stats summed to 0.6000000001 due to IEEE 754.
Round at each accumulation step with 1e10 precision.
```

- Do **not** use `--no-verify` when committing
- Do **not** commit secrets, `.env` files, or credentials
- Do **not** commit directly to `main` or `dev`

## Code Style

- TypeScript strict mode, no `any`, no `@ts-ignore`
- Functional React components with named exports
- TanStack Query for server state, `useState`/`useReducer` for local state
- Tailwind CSS for styling, `cn()` for conditional classes
- All files start with a 2-line `ABOUTME:` comment
- Keep files under 500 lines

## Development

```bash
npm run dev           # Tauri dev (Vite + native window)
npm run build         # Full production build
npm run lint          # ESLint
npm test              # Vitest
cd src-tauri && cargo check   # Rust type check
```

## Reporting Issues

Use the [issue templates](https://github.com/berkbulgan/niko-poe/issues/new/choose):
- **Bug Report** — Something broken
- **Feature Request** — New idea or improvement
