export type RetrievalCandidate = {
  tenantId: string;
  objectType: string;
  objectId: string;
  sourceVersion: string;
  permissionScopeHash: string;
  dataClassification: string;
};

export type RevalidationContext = {
  tenantId: string;
  allowedPermissionScopeHashes: Set<string>;
  maxDataClassification: string;
};

export type RevalidationResult =
  | { status: "allowed"; candidate: RetrievalCandidate }
  | { status: "denied"; code: string; message: string };

// Fail closed: candidates denied by default whenever tenant, permission, or classification checks fail.
export class RetrievalRevalidator {
  revalidate(candidate: RetrievalCandidate, context: RevalidationContext): RevalidationResult {
    if (candidate.tenantId !== context.tenantId) {
      return { status: "denied", code: "TENANT_MISMATCH", message: "Candidate tenant does not match request tenant." };
    }
    if (!context.allowedPermissionScopeHashes.has(candidate.permissionScopeHash)) {
      return { status: "denied", code: "PERMISSION_SCOPE_DENIED", message: "Candidate permission scope is not allowed." };
    }
    // Stub: AGENT work must replace with ordered classification comparison from the security policy catalog.
    if (candidate.dataClassification === "blocked") {
      return { status: "denied", code: "DATA_CLASSIFICATION_BLOCKED", message: "Blocked data cannot be surfaced." };
    }
    return { status: "allowed", candidate };
  }
}
