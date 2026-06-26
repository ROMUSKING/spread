---
version: "0.14.2"
last-reviewed: "2026-06-26"
status: "post-MVP UI strategy; Phase 0 preparedness only"
---

# Tile Contract

`TileContract` declares tile kind, source, permissions, freshness, and mutation policy. Editable tiles use `command_only`; derived-plane tiles use `none` or `draft_command_only`.

## v0.16.1 UI-008 guard

Tiles are governed lenses. They may propose commands or render command-safe fields, but before `P1-UX-001` is green they must not add any mutation path outside `command_api`.
