# AGENTS — @caisson-sh/access-review

Agent-facing authoring/usage contract (ADR-0020 `agents`). What a generation agent or a downstream
bundle must know to wire access-review campaigns correctly.

## Invariants (do not violate)

- **Never invent a second WORM/anchoring mechanism.** Every decision append goes through the
  injected `CampaignChainStore` port (`append` + `load`), structurally satisfied by the real
  `@caisson-sh/audit-worm` `AuditChainStore`. Do not write decisions to a plain table, and do not add
  a new hash-chain implementation to this package.
- **`closeCampaign` decides due/complete itself — never trust a caller-supplied verdict.** The
  `CloseCampaignInput` boundary carries only `accountId`/`campaignId` on purpose; there is no
  "force close" or "mark approved" input anywhere in this package.
- **Unresolved is never approved.** `scanCampaignDecisions`'s `unresolved` list is reported as-is
  into the `campaign.closed` chain record. Do not add logic that defaults an undecided reviewee to
  `approve` under any condition (a "grace" mode, a bulk-approve helper, etc.) — that is precisely
  the failure mode this module exists to prevent.
- **The roster is frozen at open time.** `reviewees` is snapshotted into the campaign row when
  `openCampaign` runs; a later membership change never mutates an in-flight campaign.
  `recordDecision` refuses (`ValidationError`) a reviewee outside that frozen list.
- **Inject `now`/`newId`.** `CampaignDeps.now`/`newId` default to the wall clock / `randomUUID` —
  never assume wall-clock time in a caller that needs deterministic replay or tests.
- **The real DB/chain client is a seam, never a dependency.** This package does not depend on
  `@caisson-sh/audit-worm` at runtime (only as a devDependency, for the integration test) — the
  consuming app composes the real `AuditChainStore` + `Transactor` and injects them via
  `CampaignDeps`.

## Choosing a snapshot adapter

- **`createInMemoryMembershipSnapshotSource`** — an already-typed roster (tests, programmatic
  callers).
- **`createJsonMembershipSnapshotSource`** — an already-read JSON string, `{ reviewerId, reviewees }`.
- **`createCsvMembershipSnapshotSource(csv, reviewerId)`** — an already-read CSV string, single
  `reviewee_id` header column. The reviewer is supplied out of band; a CSV export is per-reviewer,
  not self-describing.

All three are pure `read()` — no I/O happens inside this package. Whatever I/O a real source needs
(reading a file, calling an API) is the caller's job, done before construction.

## Scheduling

`defineCampaignOpenTask(deps)` / `defineCampaignCloseTask(deps)` return `@caisson-sh/jobs`
`TaskDefinition`s. Always enqueue through `enqueueCampaignOpen` / `enqueueCampaignClose` — never
call `queue.enqueue(CAMPAIGN_OPEN_TASK, …)` / `queue.enqueue(CAMPAIGN_CLOSE_TASK, …)` directly,
since the `enqueue*` helpers set the overlap-safe `singletonKey`. Which reviewers/campaigns are due
is this package's caller's concern (its own recurring scheduler) — this package only runs the
operation once told who.

## Out of scope (v1)

No reviewer-facing UI/portal — a data model plus a scheduling task only; rendering a review queue
is a consuming app's job. No live IdP/SaaS connector (the GitHub org/team connector is a named v2
milestone, not built here — see README "Roadmap"). No HR/personnel data beyond the decision record.
