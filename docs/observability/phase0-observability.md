---
version: "0.14.3"
last-reviewed: "2026-06-26"
status: "refined baseline"
---

# Phase 0 Observability Contract

## Purpose

Make command, audit, domain, outbox, SSE, batch, formula, and rate-limiter behavior traceable enough to debug ambiguous outcomes and enforce gate evidence.

## Required propagation

| Field | Source | Must appear in |
|---|---|---|
| `trace_id` | W3C `traceparent` / OpenTelemetry or local fallback | API ingress, command log, business transaction span, audit events, domain events, outbox events, SSE metadata or lookup key. |
| `correlation_id` | Client header or server-generated fallback | Problem responses, command log, audit/domain/outbox records, logs, support tooling. |
| `command_id` | Client-generated UUID | Command log, audit/domain/outbox correlation, command-status API, mutation logs. |
| `tenant_id_hash` | Server-side hash | Metrics and logs where raw tenant ID is not needed. |

## Required OpenTelemetry spans

| Span name | Required attributes |
|---|---|
| `erp.command.receive` | `tenant_id_hash`, `command_type`, `command_id`, `trace_id`, `correlation_id` |
| `erp.command.idempotency_check` | `command_status`, `request_hash_match`, `duplicate_inflight` |
| `erp.command.execute` | `command_type`, `workbook_id_hash`, `risk_class` |
| `erp.db.business_tx.commit` | `audit_event_count`, `domain_event_count`, `outbox_event_count` |
| `erp.outbox.poll` | `last_watermark`, `events_seen`, `events_delivered`, `bytes_fetched` |
| `erp.sse.initial_sync` | `mode`, `server_watermark`, `snapshot_bytes` |
| `erp.sse.deliver` | `connection_count`, `workbook_id_hash`, `delivery_lag_ms` |
| `erp.batch.partition` | `vertices`, `edges`, `components`, `duration_ms` |
| `erp.rate_limit.check` | `risk_class`, `allowed`, `overhead_ms` |
| `erp.formula.delta_recalc` | `node_count`, `payload_bytes`, `duration_ms`, `worker_state` |

## Required Prometheus metrics and alerts

| Metric | Type | Labels | Alert |
|---|---|---|---|
| `erp_command_duration_ms` | histogram | `command_type`, `status`, `risk_class` | p95 > 180 ms for 15m. |
| `erp_command_duplicate_inflight_total` | counter | `command_type` | Unexpected spike; investigate clients/network. |
| `erp_command_status_total` | counter | `status`, `command_type` | ambiguous rate > 0.1% for 15m. |
| `erp_outbox_poll_lag_seconds` | histogram | `instance`, `tenant_region` | p99 > 8s for 10m. |
| `erp_outbox_events_polled_total` | counter | `instance`, `event_type` | stalled poller for 2 intervals. |
| `erp_sse_initial_sync_seconds` | histogram | `mode` | p95 > 3s for 10m. |
| `erp_sse_delivery_lag_seconds` | histogram | `instance` | p99 > polling SLO for 10m. |
| `erp_rate_limiter_overhead_ms` | histogram | `risk_class` | p95 > 5 ms for 15m. |
| `erp_batch_partition_validation_ms` | histogram | `workbook_key`, `row_bucket` | p95 > 400 ms for 10k bucket. |
| `erp_formula_delta_recalc_ms` | histogram | `workbook_key` | p95 > 30 ms for warm deltas. |
| `erp_heartbeat_active_instances` | gauge | `tenant_region` | sudden zero or unexpected spike. |
| `erp_privacy_redaction_failures_total` | counter | `command_type` | any non-zero value blocks release. |

## Evidence

- `ci://tests/observability/trace-correlation-propagation`
- `ci://benchmarks/BENCH-OBS-001`
- `dashboard://phase0-command-outbox-sse`

## v0.13.2 concrete span and metric extensions

### Additional OpenTelemetry spans

| Span name | Required attributes | Trigger |
|---|---|---|
| `erp.outbox.poll_sql` | `last_watermark`, `tenant_count`, `limit`, `rows_returned`, `duration_ms`, `plan_hash`, `seq_scan_detected` | Every envelope metadata poll. |
| `erp.outbox.demand_filter` | `events_seen`, `events_deliverable`, `events_skipped_no_local_subscriber`, `payload_bytes_planned` | After local demand filtering. |
| `erp.outbox.payload_fetch` | `event_count`, `payload_bytes`, `payload_ref_count`, `duration_ms` | Only for deliverable event IDs. |
| `erp.outbox.full_refresh_decision` | `reason`, `workbook_id_hash`, `watermark`, `payload_bytes`, `schema_version` | Any `SYNC_REQUIRED` or full-refresh response. |
| `erp.ledger.id_derive` | `movement_kind`, `command_line_index`, `adapter`, `test_vector`, `reserved_id_retry` | Ledger adapter tests and shadow mode. |
| `erp.ledger.shadow_post` | `ledger_code`, `movement_kind`, `transfer_count`, `duration_ms`, `result_class` | TigerBeetle shadow adapter. |
| `erp.ledger.reconcile` | `ledger_code`, `window_start`, `window_end`, `mismatch_count`, `duration_ms` | Reconciliation job. |
| `erp.retrieval.revalidate` | `retrieval_mode`, `candidate_count`, `filtered_count`, `returned_count`, `regulated_block_count`, `duration_ms` | Every AI/analytics retrieval response. |
| `erp.cross_plane.answer` | `planes_used`, `deterministic_citation_count`, `stale_plane_count`, `mutation_proposal` | AI/analytics answer construction. |

### Additional Prometheus metrics and alert thresholds

| Metric | Type | Alert threshold |
|---|---|---|
| `erp_outbox_poll_sql_seconds` | histogram | p99 > 0.25s for 10m in staging/pilot. |
| `erp_outbox_poll_cycle_seconds` | histogram | p99 > 0.75s for 10m. |
| `erp_outbox_envelope_rows_scanned_total` | counter | sudden 5x increase without traffic change. |
| `erp_outbox_payload_bytes_fetched_total` | counter | p95 poll payload bytes > 2 MiB. |
| `erp_outbox_full_refresh_required_total` | counter | > baseline reconnect-window rate. |
| `erp_outbox_retention_gap_total` | counter | any unexpected non-test event. |
| `erp_outbox_seq_scan_detected_total` | counter | any non-zero value blocks P0-LIVE gate evidence. |
| `ledger_shadow_mismatch_count` | gauge/counter | any non-zero value blocks cutover. |
| `ledger_id_derivation_parity_failures_total` | counter | any non-zero value blocks P1-LEDGER. |
| `ledger_transfer_payload_hash_conflict_total` | counter | any non-zero value pages correctness owner. |
| `erp_retrieval_revalidation_duration_ms` | histogram | p95 > 30 ms for 15m. |
| `erp_retrieval_candidates_filtered_total` | counter | alert on abnormal spike by source plane. |
| `erp_retrieval_regulated_candidates_blocked_total` | counter | any production non-test event pages Security/Compliance. |
| `erp_cross_plane_direct_mutation_blocked_total` | counter | any event opens security review. |

### Dashboard minimum

`dashboard://phase0-command-outbox-sse` must include:

```text
command p95/p99
command ambiguous rate
outbox poll SQL p99
outbox poll cycle p99
outbox lag p99
SSE initial sync p95
retention gaps
full-refresh count
seq-scan detected count
```

`dashboard://post-mvp-derived-planes` must include:

```text
ledger shadow mismatch count
ledger ID parity failures
DuckDB artifact freshness
pgvector embedding job lag
RetrievalRevalidator filtered/returned counts
cross-plane deterministic citation count
```


## v0.13.3 concrete instrumentation examples

### Command mutation span example

```json
{
  "name": "erp.command.execute",
  "attributes": {
    "tenant_id_hash": "tnt_8f1c",
    "command_type": "cell.update",
    "command_id": "018f-command",
    "business_tx_id": "742913",
    "numeric_ledger_transfer_count": 2,
    "audit_event_count": 1,
    "domain_event_count": 1,
    "outbox_event_count": 1,
    "terminalization_source": "business_tx_commit"
  },
  "events": [
    {"name": "command.reserved"},
    {"name": "command.domain_validated"},
    {"name": "command.ledger_port_posted"},
    {"name": "command.outbox_written"},
    {"name": "command.terminal_status_written"}
  ]
}
```

### Retrieval revalidation span example

```json
{
  "name": "erp.retrieval.revalidate",
  "attributes": {
    "retrieval_mode": "hybrid_ai_answer",
    "candidate_count": 50,
    "filtered_count": 11,
    "returned_count": 8,
    "permission_cache_hit_count": 31,
    "regulated_block_count": 0,
    "duration_ms": 18
  }
}
```

Machine-readable examples live in `docs/observability/otel-reference.yml`.

## v0.13.3 concrete OpenTelemetry examples

### Command execution trace skeleton

```yaml
trace: erp.command.vertical_slice
spans:
  - name: erp.command.receive
    attributes:
      erp.tenant_hash: required
      erp.command_id: required
      erp.command_type: safe_cell_edit
      erp.request_hash: required
  - name: erp.command.claim
    attributes:
      erp.command_claim_result: claimed|pending_same_hash|terminal_same_hash|conflict_different_hash
  - name: erp.db.business_tx
    attributes:
      erp.tx.includes_current_state: true
      erp.tx.includes_numeric_ledger: true|false
      erp.tx.includes_audit: true
      erp.tx.includes_domain_events: true
      erp.tx.includes_outbox: true
```

### Outbox polling metric examples

```yaml
metrics:
  - name: erp_outbox_poll_sql_duration_ms
    type: histogram
    labels: [instance, tenant_region, plan_hash, seq_scan_detected]
    alert: p99 > 250ms for 10m or any seq_scan_detected=true in gate evidence
  - name: erp_outbox_poll_cycle_duration_ms
    type: histogram
    labels: [instance, subscriber_bucket]
    alert: p99 > 750ms for 10m
```

### Ledger shadow metric examples

```yaml
metrics:
  - name: erp_ledger_shadow_post_duration_ms
    type: histogram
    labels: [ledger_family, movement_kind, result_class]
    alert: p95 > 100ms in strict-shadow admission test
  - name: erp_ledger_shadow_mismatch_count
    type: counter
    labels: [ledger_family, mismatch_type]
    alert: any non-zero value blocks cutover
```

### Retrieval revalidation metric examples

```yaml
metrics:
  - name: erp_retrieval_revalidator_duration_ms
    type: histogram
    labels: [source_plane, candidate_bucket, cache_state]
    alert: p95 > 30ms for warm-cache gate evidence
  - name: erp_retrieval_revalidator_bypass_total
    type: counter
    labels: [endpoint]
    alert: any non-zero value is release-blocking
```


---

## v0.14 external integration note

External integration policies are canonical in `docs/data/external-integration-strategy-options.md` and `docs/data/external-integration-contract.md`. This document may reference those contracts but must not restate connector authority rules.

## v0.14.3 integration observability examples

Spans: `integration.inbound.receive`, `integration.inbound.scan`, `integration.inbound.schema_validate`, `integration.inbound.stage`, `integration.command_proposal.create`, `integration.outbound.dispatch_attempt`, `integration.dead_letter.create`.

Metrics: `integration_inbound_staging_latency_seconds`, `integration_malware_scan_latency_seconds`, `integration_schema_validation_latency_seconds`, `integration_import_rejected_total`, `integration_delivery_attempt_total`, `integration_dead_letter_depth`, `integration_credential_rotation_due_total`, `integration_secret_access_total`, `integration_payload_size_bytes`, `integration_rate_limit_rejected_total`.


## v0.14.3 integration observability thresholds

```yaml
metrics:
  - name: integration_inbound_staging_latency_seconds
    type: histogram
    labels: [tenant_id_hash, provider_key, validation_status]
    alert: p95 > 2s for 15m during P1-INTEGRATION evidence
  - name: integration_malware_scan_failed_total
    type: counter
    labels: [provider_key, failure_code]
    alert: sudden increase requires Security triage
  - name: integration_schema_validation_failed_total
    type: counter
    labels: [schema_key, schema_version]
    alert: >5% of inbound payloads over 15m
  - name: integration_dead_letter_depth
    type: gauge
    labels: [provider_key, source_kind]
    alert: depth > 100 or oldest > 1h in pilot
  - name: integration_command_proposal_blocked_total
    type: counter
    labels: [reason]
    alert: monitored during synthetic import spike
  - name: integration_credential_revocation_propagation_seconds
    type: histogram
    labels: [provider_key]
    alert: p95 > 60s
```

Required CI: `ci://tests/observability/integration-metrics-emitted`.


## v0.14.3 integration metric thresholds

| Metric | Type | Initial alert threshold |
|---|---|---|
| `integration_inbound_staging_latency_seconds` | histogram | p95 > 1.0s for 15m in staging/pilot |
| `integration_malware_scan_latency_seconds` | histogram | p95 > 2.0s for 15m or timeout rate > 1% |
| `integration_schema_validation_latency_seconds` | histogram | p95 > 500ms for 15m |
| `integration_import_rejected_total` | counter | sudden 5x baseline increase per connection |
| `integration_quarantined_payload_total` | counter | any regulated production payload quarantined pages Security Owner |
| `integration_delivery_attempt_total` | counter | success ratio < 99% over 30m for approved connector |
| `integration_dead_letter_depth` | gauge | > 0 for release-blocking connectors after 30m |
| `integration_credential_rotation_due_total` | gauge | > 0 for more than 7 days pages connector owner |
| `integration_credential_revoked_worker_block_total` | counter | any active worker using revoked ref pages SRE/Security |
| `integration_payload_size_bytes` | histogram | p99 within 10% of connection max_payload_bytes for 30m |
| `integration_rate_limit_rejected_total` | counter | track by tenant, connection, and source IP; 10x baseline pages SRE |

Required trace attributes:

```text
integration.connection_id
integration.service_account_id
integration.external_operation_id_hash
integration.payload_hash
integration.schema_version
integration.scan_status
integration.schema_validation_status
integration.command_proposal_id
integration.dead_letter_id
```



## v0.14.3 integration observability closure

Integration-specific telemetry must be emitted before `P1-INTEGRATION-001` can pass. Required examples:

```yaml
spans:
  - name: integration.inbound.stage
    attributes: [tenant_id_hash, connection_id, schema_key, content_type, payload_size_bucket, trace_id, correlation_id]
  - name: integration.inbound.scan
    attributes: [tenant_id_hash, connection_id, malware_scan_status, schema_validation_status, data_classification]
  - name: integration.command_proposal.evaluate
    attributes: [tenant_id_hash, connection_id, service_account_id_hash, proposed_command_type, eligibility_result]
  - name: integration.outbound.deliver
    attributes: [tenant_id_hash, connection_id, event_id, delivery_state, retry_count, credential_state]
metrics:
  - integration_inbound_staging_latency_seconds
  - integration_malware_scan_latency_seconds
  - integration_schema_validation_latency_seconds
  - integration_dead_letter_depth
  - integration_credential_revoked_worker_block_total
```

Alert baseline:

| Signal | Initial response |
|---|---|
| scan timeout or failure-rate spike | stop command proposal creation for the connection; page connector owner |
| `integration_dead_letter_depth > 0` for release-blocking connector after 30m | page integration owner |
| any active worker attempts a revoked credential | page SRE + Security |
| negative fixture creates a command proposal | release blocker |
