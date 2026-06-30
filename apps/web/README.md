# apps/web

**Version:** 0.17.0  
**Status:** Phase 0 stub package.

This package is part of the TypeScript-first Phase 0 monorepo skeleton. Implement only the work order assigned to the PR. Do not introduce post-MVP runtimes into the Phase 0 edit path.

## Current business command surface

The web shell now includes a business-actions tile that routes product, party, inventory, sales-order creation, confirmation, and allocation, plus purchase-order setup and receiving, through `command_api`. It remains a command-first surface: no direct workbook table writes are introduced from the UI.

Canonical guidance:

```text
docs/snapshot-v0.18.0.md
AGENTS.md
docs/implementation/phase0-agent-work-orders.md
```
