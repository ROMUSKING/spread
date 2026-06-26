# Critical Review v0.14

**Status:** Internal self-review for external integration strategy baseline

## Assessment

v0.14 correctly keeps external integration out of the MVP edit path. The strongest design choice is treating integrations as governed command/outbox consumers and producers rather than allowing point-to-point writes.

## Remaining risks

| Risk | Mitigation |
|---|---|
| Connector code bypasses command handlers | EXT-001, P1-INTEGRATION-001, validation grep, code review checklist. |
| External schema drift | schema_version, payload_hash, connector policy version, replay tests. |
| Secret leakage | secret_ref only, no payload/log secrets, security tests. |
| Regulated export | data_classification ceiling and Compliance sign-off. |
| Mapping conflict | external_object_mapping conflict state and operator review. |
| Derived-plane authority creep | RetrievalRevalidator and manifest lineage. |

## Recommendation

Proceed with v0.14 as planning baseline. Do not implement connector runtime until P0 vertical slice is green.
