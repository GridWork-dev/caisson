# ADR-0425 — Bind release audit to the reviewed parent

- Date: 2026-09-16
- Status: Accepted — operator R370 / EST-ASK-328
- Scope: R4 audit and release readiness
- Supersedes: R359 CR-06 exact final-SHA field inside the tagged audit

## Decision

The audit uses schema_version 2 and reviewed_sha equal to the tag candidate single parent.
It retains the exact previous release base, release tag, clean verdict, zero blockers,
non-empty reviewed scope and completed code-review/security identities and timestamps.
Readiness derives the parent using rev-parse <tag_sha>^, derives the previous release from
that parent, reads the audit blob from the candidate commit, and independently rejects
any successor change outside the exact tag-specific audit and checklist paths. The two
path templates live in one constant. Both artifacts must be regular Git blobs. Merge
successors are rejected because the reviewed parent must be unambiguous.

Review product candidate A, then commit only its audit (naming A) and release checklist
as B. The workflow still passes B, and full required CI still binds B. No product, policy,
other audit or arbitrary documentation changes can enter B without a new reviewed parent.
This avoids asking a commit to contain its own hash and does not relax the reviewed-byte
boundary. The signed release tag and publication remain separately authorized acts.

## Verification

Scratch repositories construct the real A-to-B lifecycle. Tests accept the two-file
attestation successor and reject product bytes, neighboring audit/checklist paths and
an audit naming another real commit. Dirty working-tree audit bytes cannot substitute
for B. Named guard mutations and byte-identical restoration are recorded in RUN-NOTES.
