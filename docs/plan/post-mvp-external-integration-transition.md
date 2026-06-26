# Post-MVP External Integration Transition Plan v0.14.1

## Stage 0: Phase 0 preparedness

Prepare fields and contracts only:

```text
external_system_id
external_object mapping hooks
idempotency/correlation/trace metadata
classification and permission-scope fields
outbox target-plane routing fields
```

## Stage 1: Internal prototype

Build one outbound webhook from outbox and one inbound webhook to command proposal using synthetic data.

## Stage 2: Limited customer pilot

Enable one customer-specific connector with:

```text
sandbox credentials
field allow-list
data-classification ceiling
manual replay control
operator-visible dead-letter queue
```

## Stage 3: Reconciliation-first imports

Enable pull connectors that import to staging and compare against ERP projections before command-mediated acceptance.

## Stage 4: Identity and role provisioning

Consider SCIM/OIDC-based identity integration after Security Owner sign-off.

## Stage 5: Connector marketplace or partner API

Only after P1-INTEGRATION-001, P1-OUTBOX-001, and security/compliance evidence are green.

## Effects on other post-MVP planes

| Plane | Transition constraint |
|---|---|
| TigerBeetle | External financial/stock events must reconcile through command/domain flow before ledger transfer. |
| pgvector | External content must be classified/redacted and revalidated before retrieval. |
| DuckDB | External analytics must use snapshot manifests and source lineage. |
| Outbox | External fan-out must use outbox envelopes, not ad hoc domain queries. |
| Rate limiting | Public integration endpoints get separate high-risk quotas and bot controls. |


## Staged rollout ladder

| Stage | Scope | Exit evidence | Rollback |
|---|---|---|---|
| 0 synthetic adapter | internal webhook/import fixture | P1-INTEGRATION-001 synthetic path green | disable connection |
| 1 internal webhook | outbound to internal receiver | delivery attempts and dead letters green | pause connection |
| 2 single approved connector | one low-risk object family | mapping reconciliation and idempotency evidence | revoke connection and replay from outbox |
| 3 file/EDI bridge | SFTP/EDI staging | malware/schema/rate-limit evidence | quarantine |
| 4 event API | curated external feed | schema compatibility and route controls | disable route key |
| 5 connector marketplace | SDK-constrained partner adapters | import restrictions and signing evidence | revoke adapter package |
