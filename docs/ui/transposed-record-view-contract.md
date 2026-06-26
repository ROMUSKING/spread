---
version: "0.14.2"
last-reviewed: "2026-06-26"
status: "post-MVP UI strategy; Phase 0 preparedness only"
---

# Transposed Record View Contract

A transposed detail tile maps `object_id + field_id` to the same command as a grid cell. Hidden fields remain hidden, permissions match grid permissions, validation uses canonical coordinates, audit/outbox behavior is identical to grid edits, and regulated fields use the same redaction policy.

## v0.16.1 mutation guard

Before `P1-UX-001` is green, transposed views may be used only as command-safe field renderings. Any editable transposed field must produce the same `command_api` request shape as the equivalent grid cell. A separate mutation endpoint, direct table write, local-only persistence path, or hidden command bypass is prohibited.

Evidence:

```text
ci://tests/ui/no-tile-transpose-mutation-before-p1-ux
```
