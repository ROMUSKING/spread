-- Phase 0 Canonical DDL Schema
-- Combined from docs/data/command-outbox-retention-partitioning.md and docs/data/numeric-ledger-contract.md

-- =========================================================================
-- SECTION 1: Command and Outbox
-- =========================================================================

CREATE TABLE command_log (
  tenant_id UUID NOT NULL,
  command_id UUID NOT NULL,
  trace_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  workbook_id UUID NULL,
  command_type TEXT NOT NULL,
  command_status TEXT NOT NULL CHECK (
    command_status IN ('received','committed','rejected','failed','ambiguous')
  ),
  request_hash TEXT NOT NULL,
  request_body_hash TEXT NOT NULL,
  response_body_redacted JSONB NULL,
  response_ref TEXT NULL,
  response_body_redacted_hash TEXT NULL,
  client_ip INET NULL,
  committed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, command_id)
);

CREATE INDEX idx_command_log_expires_at
  ON command_log (expires_at);

CREATE INDEX idx_command_log_user_recent
  ON command_log (tenant_id, user_id, created_at DESC);

CREATE INDEX idx_command_log_trace
  ON command_log (trace_id);


CREATE TABLE outbox_events (
  outbox_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id UUID NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  tenant_id UUID NOT NULL,
  workbook_id UUID NULL,
  command_id UUID NULL,
  command_event_seq INTEGER NULL CHECK (command_event_seq IS NULL OR command_event_seq > 0),
  event_type TEXT NOT NULL,
  event_source TEXT NOT NULL,
  event_subject TEXT NULL,
  aggregate_type TEXT NULL,
  aggregate_id UUID NULL,
  route_key TEXT NOT NULL,
  partition_key TEXT NOT NULL,
  target_planes TEXT[] NOT NULL DEFAULT ARRAY['sse']::TEXT[],
  schema_version INTEGER NOT NULL DEFAULT 1,
  data_schema TEXT NOT NULL,
  payload_content_type TEXT NOT NULL DEFAULT 'application/json',
  payload JSONB NULL,
  payload_ref TEXT NULL,
  payload_hash TEXT NOT NULL,
  payload_size_bytes INTEGER NOT NULL CHECK (payload_size_bytes >= 0),
  visibility_scope TEXT NOT NULL DEFAULT 'tenant',
  data_classification TEXT NOT NULL DEFAULT 'internal',
  permission_scope_hash TEXT NULL,
  trace_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (payload IS NOT NULL OR payload_ref IS NOT NULL)
);

CREATE INDEX idx_outbox_events_poll_cover
  ON outbox_events (outbox_id)
  INCLUDE (
    event_id, tenant_id, workbook_id, event_type, schema_version,
    target_planes, data_classification, permission_scope_hash,
    payload_size_bytes, payload_hash, created_at, trace_id, route_key
  );

CREATE INDEX idx_outbox_events_tenant_poll
  ON outbox_events (tenant_id, outbox_id)
  INCLUDE (event_id, workbook_id, event_type, schema_version, target_planes, payload_size_bytes, payload_hash, created_at);

CREATE INDEX idx_outbox_events_tenant_workbook_poll_cover
  ON outbox_events (tenant_id, workbook_id, outbox_id)
  INCLUDE (
    event_id, event_type, schema_version, target_planes,
    data_classification, permission_scope_hash, payload_size_bytes,
    payload_hash, created_at, trace_id, route_key
  );

CREATE UNIQUE INDEX ux_outbox_events_command_seq
  ON outbox_events (tenant_id, command_id, command_event_seq)
  WHERE command_id IS NOT NULL AND command_event_seq IS NOT NULL;

CREATE INDEX idx_outbox_events_route_poll ON outbox_events (route_key, outbox_id);
CREATE INDEX idx_outbox_events_target_planes ON outbox_events USING GIN (target_planes);
CREATE INDEX idx_outbox_events_created_at ON outbox_events (created_at);


CREATE TABLE outbox_consumer_checkpoints (
  consumer_id TEXT NOT NULL,
  consumer_group TEXT NOT NULL,
  consumer_version TEXT NOT NULL,
  tenant_id UUID NULL,
  tenant_bucket INTEGER NULL,
  last_outbox_id BIGINT NOT NULL DEFAULT 0,
  last_event_id UUID NULL,
  last_success_at TIMESTAMPTZ NULL,
  last_error_at TIMESTAMPTZ NULL,
  failure_count INTEGER NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer_id, consumer_group, consumer_version, tenant_id, tenant_bucket)
);

CREATE INDEX idx_outbox_consumer_checkpoints_lag ON outbox_consumer_checkpoints (consumer_group, last_outbox_id);


CREATE TABLE outbox_dispatch_attempts (
  event_id UUID NOT NULL,
  consumer_group TEXT NOT NULL,
  attempt_no INTEGER NOT NULL CHECK (attempt_no > 0),
  dispatch_status TEXT NOT NULL CHECK (dispatch_status IN ('claimed','published','acked','failed','dead_lettered')),
  effect_hash TEXT NULL,
  error_code TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, consumer_group, attempt_no)
);

CREATE INDEX idx_outbox_dispatch_attempts_status ON outbox_dispatch_attempts (consumer_group, dispatch_status, created_at);


CREATE TABLE event_schema_registry (
  event_type TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  data_schema TEXT NOT NULL,
  compatibility_window_until TIMESTAMPTZ NULL,
  deprecated_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_type, schema_version)
);


CREATE TABLE app_instance_heartbeats (
  instance_id TEXT PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sse_connection_count INTEGER NOT NULL DEFAULT 0 CHECK (sse_connection_count >= 0),
  command_inflight_count INTEGER NOT NULL DEFAULT 0 CHECK (command_inflight_count >= 0)
);

CREATE INDEX idx_app_instance_heartbeats_last_seen
  ON app_instance_heartbeats (last_seen_at);


CREATE TABLE rate_limit_minute_observations (
  tenant_id UUID NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  risk_class TEXT NOT NULL,
  command_type TEXT NOT NULL,
  observed_count INTEGER NOT NULL DEFAULT 0 CHECK (observed_count >= 0),
  PRIMARY KEY (tenant_id, window_start, risk_class, command_type)
);

CREATE INDEX idx_rate_limit_minute_observations_window
  ON rate_limit_minute_observations (window_start, tenant_id);


-- =========================================================================
-- SECTION 2: Numeric Ledger
-- =========================================================================

CREATE TABLE numeric_ledger_catalog (
  tenant_id UUID NOT NULL,
  ledger_code BIGINT NOT NULL CHECK (ledger_code > 0 AND ledger_code <= 4294967295),
  ledger_key TEXT NOT NULL,
  asset_code TEXT NOT NULL,
  asset_kind TEXT NOT NULL CHECK (asset_kind IN ('money','stock','credit','quota','capacity')),
  scale SMALLINT NOT NULL CHECK (scale >= 0 AND scale <= 12),
  authoritative_engine TEXT NOT NULL DEFAULT 'postgres_mvp'
    CHECK (authoritative_engine IN ('postgres_mvp','tigerbeetle_shadow','tigerbeetle')),
  migration_stage TEXT NOT NULL DEFAULT 'mvp'
    CHECK (migration_stage IN ('mvp','model_freeze','historical_replay','passive_shadow','strict_shadow','cutover','rollback')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deprecated_at TIMESTAMPTZ NULL,
  PRIMARY KEY (tenant_id, ledger_code),
  UNIQUE (tenant_id, ledger_key)
);

CREATE TABLE numeric_accounts (
  tenant_id UUID NOT NULL,
  account_id_dec TEXT NOT NULL CHECK (account_id_dec ~ '^[0-9]+$' AND account_id_dec::numeric > 0 AND account_id_dec::numeric < 340282366920938463463374607431768211455),
  ledger_code BIGINT NOT NULL CHECK (ledger_code > 0 AND ledger_code <= 4294967295),
  account_key TEXT NOT NULL,
  account_kind TEXT NOT NULL,
  normal_balance TEXT NOT NULL CHECK (normal_balance IN ('debit','credit')),
  balance_constraint TEXT NOT NULL DEFAULT 'none'
    CHECK (balance_constraint IN ('none','debits_must_not_exceed_credits','credits_must_not_exceed_debits')),
  dimensions JSONB NOT NULL,
  tigerbeetle_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ NULL,
  PRIMARY KEY (tenant_id, account_id_dec),
  UNIQUE (tenant_id, ledger_code, account_key),
  CHECK (account_id_dec ~ '^[0-9]+$'),
  CHECK (account_id_dec::numeric > 0 AND account_id_dec::numeric < 340282366920938463463374607431768211455),
  FOREIGN KEY (tenant_id, ledger_code)
    REFERENCES numeric_ledger_catalog (tenant_id, ledger_code)
);

CREATE TABLE numeric_transfers (
  tenant_id UUID NOT NULL,
  transfer_id_dec TEXT NOT NULL CHECK (transfer_id_dec ~ '^[0-9]+$' AND transfer_id_dec::numeric > 0 AND transfer_id_dec::numeric < 340282366920938463463374607431768211455),
  transfer_payload_hash TEXT NOT NULL,
  ledger_code BIGINT NOT NULL CHECK (ledger_code > 0 AND ledger_code <= 4294967295),
  debit_account_id_dec TEXT NOT NULL CHECK (debit_account_id_dec ~ '^[0-9]+$' AND debit_account_id_dec::numeric > 0 AND debit_account_id_dec::numeric < 340282366920938463463374607431768211455),
  credit_account_id_dec TEXT NOT NULL CHECK (credit_account_id_dec ~ '^[0-9]+$' AND credit_account_id_dec::numeric > 0 AND credit_account_id_dec::numeric < 340282366920938463463374607431768211455),
  amount_minor NUMERIC(39,0) NOT NULL CHECK (amount_minor > 0 AND amount_minor = floor(amount_minor)),
  transfer_code INTEGER NOT NULL CHECK (transfer_code >= 1 AND transfer_code <= 65535),
  command_id UUID NOT NULL,
  command_line_index INTEGER NOT NULL CHECK (command_line_index >= 0),
  ledger_group_id UUID NOT NULL,
  linked_group_index INTEGER NULL CHECK (linked_group_index IS NULL OR linked_group_index >= 0),
  linked_group_size INTEGER NULL CHECK (linked_group_size IS NULL OR linked_group_size > 0),
  movement_kind TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('single_phase','pending','post_pending','void_pending')),
  status TEXT NOT NULL CHECK (status IN ('posted','pending','voided','rejected','expired')),
  pending_transfer_id_dec TEXT NULL CHECK (pending_transfer_id_dec IS NULL OR (pending_transfer_id_dec ~ '^[0-9]+$' AND pending_transfer_id_dec::numeric > 0 AND pending_transfer_id_dec::numeric < 340282366920938463463374607431768211455)),
  domain_object_ref JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  original_business_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  posted_at TIMESTAMPTZ NULL,
  expires_at TIMESTAMPTZ NULL,
  PRIMARY KEY (tenant_id, transfer_id_dec),
  UNIQUE (tenant_id, command_id, command_line_index, movement_kind),
  CHECK (transfer_id_dec ~ '^[0-9]+$'),
  CHECK (transfer_id_dec::numeric > 0 AND transfer_id_dec::numeric < 340282366920938463463374607431768211455),
  CHECK (pending_transfer_id_dec IS NULL OR (pending_transfer_id_dec ~ '^[0-9]+$' AND pending_transfer_id_dec::numeric > 0 AND pending_transfer_id_dec::numeric < 340282366920938463463374607431768211455)),
  CHECK (debit_account_id_dec <> credit_account_id_dec),
  CHECK ((linked_group_index IS NULL) = (linked_group_size IS NULL)),
  CHECK (linked_group_index IS NULL OR linked_group_index < linked_group_size),
  FOREIGN KEY (tenant_id, ledger_code)
    REFERENCES numeric_ledger_catalog (tenant_id, ledger_code),
  FOREIGN KEY (tenant_id, debit_account_id_dec)
    REFERENCES numeric_accounts (tenant_id, account_id_dec),
  FOREIGN KEY (tenant_id, credit_account_id_dec)
    REFERENCES numeric_accounts (tenant_id, account_id_dec)
);

CREATE INDEX idx_numeric_transfers_command
  ON numeric_transfers (tenant_id, command_id);

CREATE INDEX idx_numeric_transfers_group
  ON numeric_transfers (tenant_id, ledger_group_id, linked_group_index);

CREATE INDEX idx_numeric_transfers_accounts
  ON numeric_transfers (tenant_id, ledger_code, debit_account_id_dec, credit_account_id_dec);

CREATE TABLE numeric_balance_projection (
  tenant_id UUID NOT NULL,
  account_id_dec TEXT NOT NULL CHECK (account_id_dec ~ '^[0-9]+$' AND account_id_dec::numeric > 0 AND account_id_dec::numeric < 340282366920938463463374607431768211455),
  ledger_code BIGINT NOT NULL CHECK (ledger_code > 0 AND ledger_code <= 4294967295),
  debits_posted_minor NUMERIC(39,0) NOT NULL DEFAULT 0,
  credits_posted_minor NUMERIC(39,0) NOT NULL DEFAULT 0,
  debits_pending_minor NUMERIC(39,0) NOT NULL DEFAULT 0,
  credits_pending_minor NUMERIC(39,0) NOT NULL DEFAULT 0,
  rebuilt_from_transfer_id_dec TEXT NULL,
  projection_version BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, account_id_dec),
  FOREIGN KEY (tenant_id, account_id_dec)
    REFERENCES numeric_accounts (tenant_id, account_id_dec)
);

CREATE TABLE numeric_ledger_migration_state (
  tenant_id UUID NOT NULL,
  ledger_code BIGINT NOT NULL CHECK (ledger_code > 0 AND ledger_code <= 4294967295),
  stage TEXT NOT NULL CHECK (stage IN ('mvp','model_freeze','historical_replay','passive_shadow','strict_shadow','cutover','rollback')),
  tigerbeetle_cluster_ref TEXT NULL,
  last_replayed_transfer_id_dec TEXT NULL,
  shadow_lag_seconds INTEGER NULL,
  last_reconciliation_at TIMESTAMPTZ NULL,
  reconciliation_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (reconciliation_status IN ('not_started','passing','failing','waived')),
  owner_signoff JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, ledger_code),
  FOREIGN KEY (tenant_id, ledger_code)
    REFERENCES numeric_ledger_catalog (tenant_id, ledger_code)
);
