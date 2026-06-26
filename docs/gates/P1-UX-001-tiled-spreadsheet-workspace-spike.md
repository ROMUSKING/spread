---
version: "0.14.3"
last-reviewed: "2026-06-26"
status: "post-MVP evidence gate"
---

# P1-UX-001: Tiled Spreadsheet Workspace Spike

Evidence:

```text
ci://tests/ui/grid-and-transpose-same-command
ci://tests/ui/transposed-view-field-identity-permissions
ci://tests/ui/workspace-layout-state-not-domain-state
ci://tests/ui/tile-subscription-dedup
ci://tests/ui/derived-plane-tile-revalidation
ci://tests/ui/command-status-visible-in-tiles
ci://tests/ui/keyboard-navigation-grid-to-tile
ci://benchmarks/BENCH-UX-001
ci://benchmarks/BENCH-UX-002
ci://benchmarks/BENCH-UX-003
```


## Scope guard

This gate is **post-vertical-slice only**. It must not start until the Phase 0 vertical slice is green: command log, current-state write, audit/domain/outbox transaction, polling SSE delivery, and command-status recovery. Phase 0 may add metadata hooks and a minimal selected-record detail/transpose panel only if it reuses the same command handlers and does not delay P0-CMD-001 or P0-LIVE-001.

Additional evidence:

```text
ci://tests/ui/p1-ux-starts-only-after-vertical-slice-green
```


Scope note: Phase 0 must not implement broad tiling workspace behavior before the vertical slice is green.

## v0.16.1 Phase 0 guard

`P1-UX-001` remains post-vertical-slice. Before this gate is green, no tile or transposed view may contain a mutation path that is not routed through `command_api`.

Required evidence:

```text
ci://tests/ui/no-tile-transpose-mutation-before-p1-ux
```
