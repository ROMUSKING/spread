# External Integration Runbook v0.14

## Common incidents

| Incident | Immediate action |
|---|---|
| Outbound delivery backlog | Pause low-priority routes, inspect retry/dead-letter counts, verify outbox lag. |
| External webhook signature failures | Reject payload, rotate secret if suspicious, alert Security if spike. |
| Duplicate inbound event | Return dedupe result; do not create second command. |
| Mapping conflict | Stage event, block command, request operator/domain review. |
| Secret expired | Suspend connector, rotate credential, replay from checkpoint after recovery. |
| External connector outage | Continue core command commits; retry/dead-letter externally. |
| Regulated export attempt | Block route and page Compliance/Security if unexpected. |

## Operator loop

```text
1. Check integration route health dashboard.
2. Review backlog, retry, and dead-letter counts.
3. Inspect top error classes.
4. Verify no command commit latency regression.
5. Reconcile external checkpoints against ERP high-watermarks.
6. Process mapping conflicts with domain owner.
7. Record waiver or replay action in decision log.
```

## Required metrics

```text
erp_integration_inbound_events_total
erp_integration_inbound_dedupe_total
erp_integration_outbound_delivery_lag_seconds
erp_integration_delivery_attempts_total
erp_integration_dead_letter_total
erp_integration_mapping_conflict_total
erp_integration_regulated_export_block_total
erp_integration_connector_outage_seconds
```

## Required traces

```text
integration.inbound.receive
integration.inbound.validate
integration.inbound.map
integration.inbound.command_submit
integration.outbound.dispatch
integration.outbound.transform
integration.outbound.deliver
integration.reconcile.window
```
