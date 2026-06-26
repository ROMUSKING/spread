-- AUD-001: Command/audit/domain/outbox correlation invariant. CI query must return zero rows.
SELECT cl.tenant_id, cl.command_id FROM command_log cl WHERE cl.command_status = 'committed' AND NOT EXISTS (SELECT 1 FROM outbox_events oe WHERE oe.tenant_id = cl.tenant_id AND oe.command_id = cl.command_id);
