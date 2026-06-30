# Scoped Agent Instructions

API package. Command handlers, outbox polling, SSE, command status, and integration staging must preserve command/outbox authority. Use `apps/api/src/commands/CommandHandlerBase.ts` and `apps/api/src/outbox/OutboxPoller.ts` as starting points.

First read: `docs/snapshot-v0.18.0.md` from repository root, then root `AGENTS.md`.
