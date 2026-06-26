---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "kickoff-ready baseline"
---

# Owner Sign-off Template

Use this template in PRs, gate reviews, and kickoff decisions.

```markdown
## Owner sign-off

- Artifact or gate:
- Version:
- Owner:
- Date:
- Evidence URIs:
- SLO references:
- Invariants covered:
- Open risks:
- Waivers requested: yes/no
- Expiry date for any waiver:

### Decision

- [ ] Approved
- [ ] Approved with recorded waiver
- [ ] Blocked

### Notes

<owner notes>
```

## Required sign-offs by topic

| Topic | Required sign-off |
|---|---|
| Command idempotency and ambiguous recovery | API/Client Owner, Engineering Lead |
| Command privacy/redaction | Security Owner |
| Outbox/SSE delivery | Platform/SRE Owner |
| Regulated pilot data | Compliance Owner |
| Transactional batch policy | Backend/Domain Owner, Security Owner |
| Rate-limit hot path | Platform/API Owner, SRE Lead |
| Numeric ledger and TigerBeetle migration | Domain Ledger Owner, Platform/SRE Owner, Security Owner |
