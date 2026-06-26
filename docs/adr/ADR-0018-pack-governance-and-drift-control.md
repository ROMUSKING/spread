# ADR-0018: Pack Governance and Drift Control

**Version:** 0.13  
**Last-reviewed:** 2026-06-26  
**Status:** Required for Phase 0

## Context

The Phase 0 pack has a normative spec plus derivative gates, ADRs, runbooks, benchmark manifests, and implementation docs. The externally integrated v0.12.1 archive showed the failure mode this ADR prevents: duplicate roots, placeholder files, mixed version labels, and references to absent artifacts.

## Decision

- Use one canonical documentation root.
- Treat the main spec as behavioral source of truth and `docs/pack-index.md` as entry point.
- Require every pack change to pass `scripts/validate-pack.sh`.
- Reject duplicate `src/docs`, `src/spec`, duplicate `(1).md` files, unresolved placeholders, stale version labels, and missing required artifacts.
- Keep changelog and review notes with every baseline bump.

## Consequences

- Documentation edits become more procedural.
- Teams get fewer contradictory copies.
- Future review packs can be validated before implementation teams consume them.
