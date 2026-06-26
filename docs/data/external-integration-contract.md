---
version: "0.14.2"
last-reviewed: "2026-06-26"
status: "canonical data contract"
---

# External Integration Contract

## Purpose

Canonical schema and behavior contract for post-MVP external-system integration. It is inert in Phase 0 unless a fixture or metadata registry is needed for P1 readiness.

## Core rules

1. Inbound external mutations become command proposals or explicit commands.
2. Outbound delivery originates from durable `outbox_events`.
3. Payloads are untrusted until authenticated, rate-limited, size-limited, content-type checked, malware-scanned or quarantined, schema-validated, classified, redacted, and mapped.
4. Credentials are secret references bound to scoped service accounts.
5. Marketplace adapters may emit DTOs and command proposals only.

## Inbound security pipeline

```text
receive -> authenticate -> rate-limit -> byte/content-type check -> payload hash -> malware scan/quarantine -> schema validation -> classification/redaction -> mapping lookup -> command proposal
```

## Canonical PostgreSQL schema

```sql
CREATE TABLE integration_service_accounts (
  tenant_id UUID NOT NULL,
  service_account_id UUID NOT NULL,
  display_name TEXT NOT NULL,
  account_status TEXT NOT NULL CHECK (account_status IN ('draft','active','paused','revoked','archived')),
  allowed_command_types TEXT[] NOT NULL DEFAULT '{}',
  allowed_object_types TEXT[] NOT NULL DEFAULT '{}',
  allowed_event_types TEXT[] NOT NULL DEFAULT '{}',
  data_classification_max TEXT NOT NULL CHECK (data_classification_max IN ('public','internal','confidential','regulated','blocked')),
  owner_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ NULL,
  PRIMARY KEY (tenant_id, service_account_id)
);

CREATE TABLE integration_connections (
  tenant_id UUID NOT NULL,
  integration_connection_id UUID NOT NULL,
  service_account_id UUID NOT NULL,
  provider_key TEXT NOT NULL,
  connection_name TEXT NOT NULL,
  connection_type TEXT NOT NULL CHECK (connection_type IN ('oauth2','api_key','webhook','sftp','edi','scim','ipaas','internal')),
  connection_status TEXT NOT NULL CHECK (connection_status IN ('draft','active','paused','revoked','failed','archived')),
  credential_ref TEXT NULL,
  kms_key_ref TEXT NULL,
  credential_secret_version TEXT NULL,
  credential_revocation_propagated_at TIMESTAMPTZ NULL,
  credential_rotation_state TEXT NOT NULL DEFAULT 'not_required' CHECK (credential_rotation_state IN ('not_required','current','rotation_due','rotating','expired','revoked')),
  credential_last_rotated_at TIMESTAMPTZ NULL,
  credential_expires_at TIMESTAMPTZ NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  allowed_object_types TEXT[] NOT NULL DEFAULT '{}',
  allowed_event_types TEXT[] NOT NULL DEFAULT '{}',
  allowed_content_types TEXT[] NOT NULL DEFAULT ARRAY['application/json']::TEXT[],
  max_payload_bytes INTEGER NOT NULL DEFAULT 10485760 CHECK (max_payload_bytes > 0),
  data_classification_max TEXT NOT NULL CHECK (data_classification_max IN ('public','internal','confidential','regulated','blocked')),
  redaction_policy_version INTEGER NOT NULL,
  owner_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ NULL,
  PRIMARY KEY (tenant_id, integration_connection_id),
  UNIQUE (tenant_id, provider_key, connection_name),
  FOREIGN KEY (tenant_id, service_account_id) REFERENCES integration_service_accounts (tenant_id, service_account_id)
);

CREATE TABLE external_object_mappings (
  tenant_id UUID NOT NULL,
  integration_connection_id UUID NOT NULL,
  object_type TEXT NOT NULL,
  object_id UUID NOT NULL,
  external_system_key TEXT NOT NULL,
  external_object_type TEXT NOT NULL,
  external_object_id TEXT NOT NULL,
  external_object_version TEXT NULL,
  mapping_status TEXT NOT NULL CHECK (mapping_status IN ('active','superseded','conflict','deleted','archived')),
  source_version BIGINT NOT NULL,
  last_seen_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, integration_connection_id, object_type, object_id, external_system_key),
  UNIQUE (tenant_id, integration_connection_id, external_object_type, external_object_id),
  FOREIGN KEY (tenant_id, integration_connection_id) REFERENCES integration_connections (tenant_id, integration_connection_id)
);

CREATE TABLE integration_payload_schema_registry (
  tenant_id UUID NOT NULL,
  integration_connection_id UUID NOT NULL,
  schema_key TEXT NOT NULL,
  schema_version INTEGER NOT NULL CHECK (schema_version > 0),
  payload_direction TEXT NOT NULL CHECK (payload_direction IN ('inbound','outbound')),
  json_schema_ref TEXT NOT NULL,
  compatibility_mode TEXT NOT NULL CHECK (compatibility_mode IN ('none','backward','forward','full')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deprecated_at TIMESTAMPTZ NULL,
  PRIMARY KEY (tenant_id, integration_connection_id, schema_key, schema_version),
  FOREIGN KEY (tenant_id, integration_connection_id) REFERENCES integration_connections (tenant_id, integration_connection_id)
);

CREATE TABLE integration_import_staging (
  tenant_id UUID NOT NULL,
  integration_import_id UUID NOT NULL,
  integration_connection_id UUID NOT NULL,
  external_operation_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  object_type TEXT NOT NULL,
  proposed_command_type TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  payload_ref TEXT NOT NULL,
  payload_size_bytes INTEGER NOT NULL CHECK (payload_size_bytes >= 0),
  content_type TEXT NOT NULL,
  schema_key TEXT NOT NULL,
  schema_version INTEGER NOT NULL CHECK (schema_version > 0),
  malware_scan_status TEXT NOT NULL DEFAULT 'pending' CHECK (malware_scan_status IN ('pending','clean','quarantined','failed','skipped_not_allowed')),
  schema_validation_status TEXT NOT NULL DEFAULT 'pending' CHECK (schema_validation_status IN ('pending','valid','invalid','failed')),
  validation_status TEXT NOT NULL CHECK (validation_status IN ('received','validated','rejected','needs_review','command_created','dead_lettered')),
  proposed_command_id UUID NULL,
  rejection_reason TEXT NULL,
  data_classification TEXT NOT NULL,
  permission_scope_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, integration_import_id),
  UNIQUE (tenant_id, integration_connection_id, idempotency_key),
  FOREIGN KEY (tenant_id, integration_connection_id) REFERENCES integration_connections (tenant_id, integration_connection_id),
  FOREIGN KEY (tenant_id, integration_connection_id, schema_key, schema_version) REFERENCES integration_payload_schema_registry (tenant_id, integration_connection_id, schema_key, schema_version),
  CHECK (validation_status <> 'command_created' OR (malware_scan_status = 'clean' AND schema_validation_status = 'valid'))
);

CREATE TABLE integration_sync_checkpoints (
  tenant_id UUID NOT NULL,
  integration_connection_id UUID NOT NULL,
  stream_key TEXT NOT NULL,
  checkpoint_value TEXT NOT NULL,
  checkpoint_hash TEXT NOT NULL,
  high_watermark_at TIMESTAMPTZ NULL,
  last_success_at TIMESTAMPTZ NULL,
  last_error_at TIMESTAMPTZ NULL,
  lag_seconds INTEGER NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, integration_connection_id, stream_key),
  FOREIGN KEY (tenant_id, integration_connection_id) REFERENCES integration_connections (tenant_id, integration_connection_id)
);

CREATE TABLE integration_delivery_attempts (
  tenant_id UUID NOT NULL,
  delivery_attempt_id UUID NOT NULL,
  integration_connection_id UUID NOT NULL,
  event_id UUID NOT NULL,
  idempotency_key TEXT NOT NULL,
  delivery_status TEXT NOT NULL CHECK (delivery_status IN ('scheduled','delivered','retrying','failed','dead_lettered','suppressed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NULL,
  last_attempt_at TIMESTAMPTZ NULL,
  response_status INTEGER NULL,
  response_hash TEXT NULL,
  error_code TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, delivery_attempt_id),
  UNIQUE (tenant_id, integration_connection_id, event_id),
  FOREIGN KEY (tenant_id, integration_connection_id) REFERENCES integration_connections (tenant_id, integration_connection_id)
);

CREATE TABLE integration_dead_letters (
  tenant_id UUID NOT NULL,
  dead_letter_id UUID NOT NULL,
  integration_connection_id UUID NOT NULL,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('import','delivery','checkpoint','schema','auth','scan')),
  source_id UUID NOT NULL,
  failure_code TEXT NOT NULL,
  failure_summary TEXT NOT NULL,
  payload_hash TEXT NULL,
  payload_ref TEXT NULL,
  operator_action TEXT NOT NULL CHECK (operator_action IN ('review','retry','suppress','repair_mapping','revoke_connection','rotate_credential')),
  resolved_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, dead_letter_id),
  FOREIGN KEY (tenant_id, integration_connection_id) REFERENCES integration_connections (tenant_id, integration_connection_id)
);
```

## Required indexes

```sql
CREATE INDEX idx_integration_connections_status ON integration_connections (tenant_id, connection_status, provider_key);
CREATE INDEX idx_integration_connections_credential_rotation ON integration_connections (tenant_id, credential_rotation_state, credential_expires_at) WHERE connection_status = 'active';
CREATE INDEX idx_external_object_mappings_local_lookup ON external_object_mappings (tenant_id, object_type, object_id, integration_connection_id) WHERE mapping_status = 'active';
CREATE INDEX idx_external_object_mappings_external_lookup ON external_object_mappings (tenant_id, integration_connection_id, external_object_type, external_object_id) WHERE mapping_status = 'active';
CREATE INDEX idx_integration_import_staging_status ON integration_import_staging (tenant_id, integration_connection_id, validation_status, created_at DESC);
CREATE INDEX idx_integration_import_staging_scan ON integration_import_staging (tenant_id, malware_scan_status, schema_validation_status, created_at DESC) WHERE validation_status IN ('received','needs_review');
CREATE INDEX idx_integration_delivery_attempts_retry ON integration_delivery_attempts (tenant_id, delivery_status, next_attempt_at) WHERE delivery_status IN ('scheduled','retrying');
CREATE INDEX idx_integration_dead_letters_open ON integration_dead_letters (tenant_id, integration_connection_id, created_at DESC) WHERE resolved_at IS NULL;
```

## Command proposal eligibility

```text
malware_scan_status = clean
schema_validation_status = valid
payload_size_bytes <= integration_connections.max_payload_bytes
content_type = ANY(integration_connections.allowed_content_types)
service account allows proposed_command_type and object_type
data_classification <= connection/service-account classification ceiling
```

## Idempotency properties

```text
same idempotency_key + same payload_hash -> same outcome
same idempotency_key + different payload_hash -> INTEGRATION_IDEMPOTENCY_CONFLICT
same event_id + same payload_hash -> same outbound logical delivery
same event_id + different payload_hash -> corruption/dead-letter, no delivery
```

`event_id` is the durable outbox event identity. Do not name this field `outbox_event_id`; `outbox_id` is the local replay cursor.


## v0.14.2 staging-to-command gate

A staged inbound payload may create a command proposal only if all predicates below are true:

```text
connection_status = active
service_account.account_status = active
credential_rotation_state IN (not_required, current, rotating)
payload_size_bytes <= integration_connections.max_payload_bytes
content_type = ANY(integration_connections.allowed_content_types)
malware_scan_status = clean
schema_validation_status = valid
validation_status IN (validated, needs_review)
proposed_command_type = ANY(service_account.allowed_command_types)
object_type = ANY(service_account.allowed_object_types)
data_classification <= LEAST(connection.data_classification_max, service_account.data_classification_max)
```

If any predicate fails, the row remains `rejected`, `needs_review`, `dead_lettered`, or quarantined and `proposed_command_id` must remain `NULL`.


## v0.14.2 command-proposal eligibility rule

A row in `integration_import_staging` is eligible for command proposal only when:

```text
authentication_status = accepted
rate_limit_status = accepted
malware_scan_status = clean
schema_validation_status = valid
payload_size_bytes <= max_payload_bytes
content_type is in allowed_content_types
credential_state in {current, rotating}
service_account_scope_status = allowed
data_classification <= connection.classification_ceiling
external_mapping_status in {matched, approved_new_mapping}
```

Any other state blocks command proposal. Quarantined payloads may be retained only as redacted `payload_ref` evidence according to retention policy.
