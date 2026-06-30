# apps/api

**Version:** 0.17.0  
**Status:** Phase 0 stub package.

This package is part of the TypeScript-first Phase 0 monorepo skeleton. Implement only the work order assigned to the PR. Do not introduce post-MVP runtimes into the Phase 0 edit path.

## Current business command surface

The API now exposes Phase 0 business handlers for product creation, party setup, inventory adjustment, sales-order creation, sales-order confirmation, purchase-order creation, and purchase-order receiving. These handlers stay inside the shared command processor, transaction boundary, and outbox-driven delivery model.

Canonical guidance:

```text
docs/snapshot-v0.17.0.md
AGENTS.md
docs/implementation/phase0-agent-work-orders.md
```
