---
version: "0.13.3"
last-reviewed: "2026-06-26"
status: "refined baseline"
---

# Pack Maintenance Process

## Cadence

- Review weekly during Phase 0.
- Review immediately after any gate waiver, incident, benchmark regression, compliance decision, or SLO change.
- Version bump for every externally shared baseline.

## Change order

1. Edit the main spec first.
2. Update affected gate cards, ADRs, runbooks, developer docs, API contracts, and observability docs.
3. Update `docs/slo-baseline.yml` if targets changed.
4. Update `tests/manifest.yml` and invariant evidence.
5. Update `docs/review/critical-review-v0.13.md` or create the next review note.
6. Run `scripts/validate-pack.sh`.
7. Attach validation output to the PR.

## Drift rules

- Do not maintain duplicate standalone copies of the spec inside and outside the pack.
- Do not leave placeholder files that say stub-only language.
- Do not copy long normative sections into gates; link to the spec instead.
- Do not allow gates to reference missing ADRs, docs, benchmark IDs, or SLO keys.
- Do not change benchmark targets without updating SLO baseline and waiver rules.
- Do not add command/outbox retention rules without checking legal hold and compliance retention.


## v0.13 maintenance additions

- New contributors should start with `docs/onboarding/engineer-onramp-day1.md`.
- PRs must attach the `scripts/validate-pack.sh` output, including health score.
- Waivers must be entered in `docs/process/decision-waiver-log.md` before merge.
- Owner sign-off should use `docs/process/owner-signoff-template.md`.
- Large normative blocks should live in the spec or dedicated contract docs, not repeated across gate cards.

## Numeric ledger maintenance rule

Any change to financial, stock, reservation, credit, quota, or capacity movement must update the numeric ledger contract and TigerBeetle field assignment policy if it changes account dimensions, transfer codes, deterministic ID derivation, TigerBeetle `ledger`/`code`/`user_data_*` assignments, balance constraints, migration stages, or reconciliation behavior. TigerBeetle remains a post-MVP target until P1-LEDGER-001 is signed.


## v0.13.3 canonical-edit workflow

1. Start with `docs/maintenance/normative-source-map.md` and identify the canonical file for the contract you are changing.
2. Edit the canonical file first. Non-canonical files may only link or summarize.
3. Add or update one test manifest entry for every new release-blocking rule.
4. Add or update one invariant if the rule is correctness/security/privacy critical.
5. Update `scripts/validate-pack.sh` only for structural checks that can be enforced cheaply.
6. Run `scripts/validate-pack.sh` and attach the output to the PR.
7. Record any waiver in `docs/process/decision-waiver-log.md`.

Avoid adding strategy summaries to README, pack-index, and spec simultaneously. Prefer one canonical source plus links.
