# Revalidation and Outbox Implementation Readiness Diagrams

**Version:** 0.13.3  
**Last-reviewed:** 2026-06-26  
**Status:** Compatibility pointer

The active v0.13.3 implementation-readiness diagrams are maintained in:

```text
docs/diagrams/v0133-implementation-flows.md
```

This compatibility document exists so older review-closure links remain stable while the canonical diagram file carries the versioned name.

## Included flows

- Command transaction boundary.
- RetrievalRevalidator middleware flow.
- Outbox polling and retention-gap fallback.
- TigerBeetle strict-shadow loop.
