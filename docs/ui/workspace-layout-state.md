---
version: "0.14.2"
last-reviewed: "2026-06-26"
status: "post-MVP UI strategy; Phase 0 preparedness only"
---

# Workspace Layout State

Layout state records tile arrangement and bindings. It is not business state. Layout save/restore is user preference or role template; layout changes do not emit business audit events; layout cannot bypass permissions; canonical SQL DDL belongs in a future UI data contract only if P1-UX-001 is admitted.

## Subscription manifest

Tiles declare subscriptions before outbox payload fetch so the workspace can deduplicate demand.
