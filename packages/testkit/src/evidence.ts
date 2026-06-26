export type EvidenceUri = `ci://${string}` | `repo://${string}`;

export function evidence(name: EvidenceUri): EvidenceUri {
  return name;
}
