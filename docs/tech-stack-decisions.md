# Tech Stack and Repository Shape Snapshot

**Version:** 0.17.0  
**Status:** Provisional Phase 0 implementation baseline; update by ADR if changed  
**Purpose:** Give AI coding agents a concrete repository shape and implementation substrate before code is generated.

## Decision

Use a TypeScript-first monorepo. Keep Phase 0 simple and evidence-oriented.

```text
repo/
  apps/
    web/                 # spreadsheet UI and command-status client
    api/                 # command API, outbox reader, SSE, domain handlers
  packages/
    domain/              # command types, validation, domain services
    db/                  # migrations, query helpers, RLS tests
    contracts/           # OpenAPI/AsyncAPI/types shared by web/api/tests
    testkit/             # fixtures, property tests, benchmark harness helpers
    observability/       # trace/span/metric wrappers
  docs/
  invariants/
  tests/
  scripts/
```

## Phase 0 stack snapshot

| Layer | Provisional choice | Notes |
|---|---|---|
| Language | TypeScript | Default for app, API, workers, tests, and contracts. |
| Runtime | Node.js | Use worker threads only for formula-worker spike. |
| Package manager | pnpm workspace | Lockfile required in implementation repo. |
| API service | HTTP server with typed command handlers | Framework may be Fastify, Hono, or equivalent; command/outbox contracts matter more than framework. |
| UI | React-based grid shell | Use grid dependency DAR before committing to a grid library. |
| Client state | query/cache layer plus explicit command-status state | Do not hide command ambiguity behind optimistic cache. |
| Database | PostgreSQL | Operational control plane, command log, outbox, projections, integration staging. |
| Testing | unit + integration + e2e + property/fuzz where required | Every evidence URI must map to a test or benchmark job. |
| Observability | OpenTelemetry-compatible traces and Prometheus-style metrics | Use wrappers so implementation is swappable. |

## Explicit non-decisions

```text
No TigerBeetle runtime in Phase 0.
No pgvector runtime in Phase 0.
No DuckDB runtime in Phase 0.
No broker/CDC dependency in Phase 0.
No external connector runtime in the ordinary edit path.
No full tiling workspace before vertical slice completion.
```

## Code skeleton starting points

Agents must use these as starting contracts when their work order touches the relevant area:

```text
apps/api/src/commands/CommandHandlerBase.ts
apps/api/src/outbox/OutboxPoller.ts
packages/domain/src/ledger/NumericLedgerPort.ts
apps/api/src/retrieval/RetrievalRevalidator.middleware.ts
```

## Change control

Changing the stack requires:

```text
1. ADR or update to this file.
2. Updated AGENT work-order path allowances.
3. Updated validation checks if paths/tooling change.
4. Owner sign-off from Engineering + SRE + Security for runtime changes.
```


## v0.17.0 realized repository files

The planned layout now exists as source stubs. Agents must keep `pnpm-workspace.yaml`, `tsconfig.base.json`, `docs/implementation/project-directory-structure.md`, and scoped `AGENTS.md` files aligned when adding packages.

## Repository smoke

The active dependency-light smoke command is `bash scripts/smoke-typecheck.sh`. Real TypeScript typechecking becomes mandatory after dependencies are installed and locked by the first implementation PR.


## v0.17.0 repository smoke

The repository must pass:

```bash
bash scripts/smoke-typecheck.sh
```

This uses the TypeScript compiler available from `node_modules/.bin/tsc` or `PATH` and runs `tsc -p tsconfig.json --noEmit --pretty false`. It does not admit any post-MVP runtime into Phase 0.


## v0.17.0 runnable bootstrap files

The planned layout now exists as source stubs and passes the bootstrap smoke typecheck:

```bash
bash scripts/smoke-typecheck.sh
```

The smoke test uses:

```text
tsconfig.smoke.json
apps/**/*.ts
apps/**/*.tsx
packages/**/*.ts
packages/**/*.tsx
```

Agents must keep `pnpm-workspace.yaml`, `tsconfig.base.json`, `tsconfig.smoke.json`, `docs/implementation/project-directory-structure.md`, and scoped `AGENTS.md` files aligned when adding packages.


## v0.17.0 runnable repository files

The bootstrap now includes `tsconfig.smoke.json` and `scripts/smoke-typecheck.sh`. Agents must keep the root smoke typecheck green while preserving the Phase 0 runtime boundary.
