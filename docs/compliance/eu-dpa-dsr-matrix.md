# EU DPA and DSR Pilot Readiness Matrix

**Version:** 0.13  
**Last-reviewed:** 2026-06-26  
**Scope:** EU pilot readiness for regulated and personal data.

## Pilot gate

Regulated data and customer personal data are blocked from pilot until the Compliance Owner signs this matrix and the Security Owner signs the related technical controls.

## Matrix

| Area | Required evidence | Owner | Pilot status |
|---|---|---|---|
| Data processing agreement | Signed DPA or approved internal equivalent | Compliance Owner | Required |
| Data residency | EU-only processing/storage default; non-EU subprocessors require legal sign-off | Compliance Owner | Required |
| Data subject requests | Export, correction, deletion, and restriction workflow documented | Compliance Owner | Required |
| Retention | Command log, audit, outbox, and benchmark log retention policy documented | SRE + Compliance | Required |
| Legal hold | Legal hold prevents deletion where required and is auditable | Compliance Owner | Required |
| Malware scanning | Import/export attachment scanning path documented | Security Owner | Required before imports |
| Regulated fields | Field classification blocks regulated data until owner approval | Product + Compliance | Required |
| Audit access | Audit log access is permissioned, logged, and reviewable | Security Owner | Required |
| DSR exception handling | Immutable audit/event records have documented redaction or tombstone policy | Compliance Owner | Required |

## DSR workflow requirements

1. Identify tenant, subject, workbook, and related operational rows.
2. Classify whether requested records are operational, audit, outbox, benchmark, or support data.
3. Export operational personal data in a portable format.
4. Correct current-state records through normal command path where correction is valid.
5. Delete or tombstone data only under the signed retention and legal-hold policy.
6. Record the DSR action as an audit event with `trace_id` and `correlation_id`.

## Do not proceed if

- Data residency is unresolved.
- DPA/subprocessor review is incomplete.
- A deletion request would conflict with accounting, audit, or legal-hold requirements and no exception policy is signed.
- Regulated data classification is absent for pilot workbook fields.
