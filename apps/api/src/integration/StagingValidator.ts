/**
 * AGENT-080 — Integration Staging Validator
 *
 * Implements inert schemas and the validation gate checks required to verify
 * staged payloads before they can generate command proposals.
 *
 * @see docs/data/external-integration-contract.md
 * @see docs/dev/external-integration-adapter.md
 * @see docs/security/integration-security-boundary.md
 */

export interface ServiceAccount {
  tenantId: string;
  serviceAccountId: string;
  displayName: string;
  accountStatus: "draft" | "active" | "paused" | "revoked" | "archived";
  allowedCommandTypes: string[];
  allowedObjectTypes: string[];
  allowedEventTypes: string[];
  dataClassificationMax: "public" | "internal" | "confidential" | "regulated" | "blocked";
  revokedAt?: string | null;
}

export interface IntegrationConnection {
  tenantId: string;
  integrationConnectionId: string;
  serviceAccountId: string;
  providerKey: string;
  connectionName: string;
  connectionType: "oauth2" | "api_key" | "webhook" | "sftp" | "edi" | "scim" | "ipaas" | "internal";
  connectionStatus: "draft" | "active" | "paused" | "revoked" | "failed" | "archived";
  credentialRef?: string | null;
  credentialRotationState: "not_required" | "current" | "rotation_due" | "rotating" | "expired" | "revoked";
  allowedObjectTypes: string[];
  allowedEventTypes: string[];
  allowedContentTypes: string[];
  maxPayloadBytes: number;
  dataClassificationMax: "public" | "internal" | "confidential" | "regulated" | "blocked";
  revokedAt?: string | null;
}

export interface StagedPayload {
  tenantId: string;
  integrationImportId: string;
  integrationConnectionId: string;
  externalOperationId: string;
  idempotencyKey: string;
  objectType: string;
  proposedCommandType: string;
  payloadHash: string;
  payloadSizeBytes: number;
  contentType: string;
  schemaKey: string;
  schemaVersion: number;
  malwareScanStatus: "pending" | "clean" | "quarantined" | "failed" | "skipped_not_allowed";
  schemaValidationStatus: "pending" | "valid" | "invalid" | "failed";
  validationStatus: "received" | "validated" | "rejected" | "needs_review" | 'command_created' | "dead_lettered";
  dataClassification: "public" | "internal" | "confidential" | "regulated" | "blocked";
  proposedCommandId?: string | null;
  rejectionReason?: string | null;
}

export const CLASSIFICATION_RANK = {
  public: 1,
  internal: 2,
  confidential: 3,
  regulated: 4,
  blocked: 5,
};

export type ValidationResult = {
  eligible: boolean;
  reason: string | null;
};

export function validateStagingToCommandGate(
  payload: StagedPayload,
  connection: IntegrationConnection,
  serviceAccount: ServiceAccount
): ValidationResult {
  if (connection.connectionStatus !== "active") {
    return { eligible: false, reason: "Connection status is not active" };
  }
  if (connection.revokedAt) {
    return { eligible: false, reason: "Connection has been revoked" };
  }

  if (serviceAccount.accountStatus !== "active") {
    return { eligible: false, reason: "Service account status is not active" };
  }
  if (serviceAccount.revokedAt) {
    return { eligible: false, reason: "Service account has been revoked" };
  }

  if (
    payload.tenantId !== connection.tenantId ||
    payload.tenantId !== serviceAccount.tenantId
  ) {
    return { eligible: false, reason: "Tenant binding mismatch between payload, connection, and service account" };
  }

  if (payload.integrationConnectionId !== connection.integrationConnectionId) {
    return { eligible: false, reason: "Payload integration connection does not match the staged connection" };
  }

  if (connection.serviceAccountId !== serviceAccount.serviceAccountId) {
    return { eligible: false, reason: "Connection service account does not match the staged service account" };
  }

  if (!isCredentialRefSafe(connection.credentialRef ?? "")) {
    return { eligible: false, reason: "Connection credential reference is not KMS-safe" };
  }

  const validRotationStates = ["not_required", "current", "rotating"];
  if (!validRotationStates.includes(connection.credentialRotationState)) {
    return { eligible: false, reason: `Invalid credential rotation state: ${connection.credentialRotationState}` };
  }

  if (payload.payloadSizeBytes > connection.maxPayloadBytes) {
    return { eligible: false, reason: "Payload size exceeds connection maximum size limit" };
  }

  if (!connection.allowedContentTypes.includes(payload.contentType)) {
    return { eligible: false, reason: `Content type "${payload.contentType}" is not allowed` };
  }

  if (payload.malwareScanStatus !== "clean") {
    return { eligible: false, reason: "Malware scan status is not clean" };
  }

  if (payload.schemaValidationStatus !== "valid") {
    return { eligible: false, reason: "Schema validation status is not valid" };
  }

  const validValidationStatuses = ["validated", "needs_review"];
  if (!validValidationStatuses.includes(payload.validationStatus)) {
    return { eligible: false, reason: `Invalid validation status: ${payload.validationStatus}` };
  }

  if (!serviceAccount.allowedCommandTypes.includes(payload.proposedCommandType)) {
    return { eligible: false, reason: `Command type "${payload.proposedCommandType}" is not allowed by service account` };
  }

  if (!serviceAccount.allowedObjectTypes.includes(payload.objectType)) {
    return { eligible: false, reason: `Object type "${payload.objectType}" is not allowed by service account` };
  }

  if (!connection.allowedObjectTypes.includes(payload.objectType)) {
    return { eligible: false, reason: `Object type "${payload.objectType}" is not allowed by connection` };
  }

  const connectionCeiling = CLASSIFICATION_RANK[connection.dataClassificationMax] ?? 0;
  const serviceAccountCeiling = CLASSIFICATION_RANK[serviceAccount.dataClassificationMax] ?? 0;
  const allowedCeiling = Math.min(connectionCeiling, serviceAccountCeiling);
  const payloadRank = CLASSIFICATION_RANK[payload.dataClassification] ?? 0;

  if (payloadRank > allowedCeiling) {
    return { eligible: false, reason: "Payload classification exceeds maximum allowed ceiling" };
  }

  return { eligible: true, reason: null };
}

/**
 * Checks if the connection credential reference is KMS-safe and does not store raw secrets.
 */
export function isCredentialRefSafe(ref: string): boolean {
  if (!ref) return true;

  const safeSchemes = ["kms://", "vault://", "arn:aws:secretsmanager:", "gcp:secretmanager:", "azure:keyvault:"];
  const isSchemeMatched = safeSchemes.some(scheme => ref.startsWith(scheme));
  if (!isSchemeMatched) {
    return false;
  }

  const lower = ref.toLowerCase();
  const containsRawIndicator = [
    "bearer ",
    "token=",
    "api_key=",
    "password=",
    "secret="
  ].some(ind => lower.includes(ind));

  if (containsRawIndicator) {
    return false;
  }

  return true;
}
