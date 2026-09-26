# @caisson/access-review

Audit-prep access-review campaigns — a reviewer attests, per user, that access is still
appropriate, and every decision is WORM-logged so an auditor can prove the review actually
happened. ADR-0371 (module lock).

Apache-2.0. Install it on its own, or alongside the rest of the compliance modules.

## What it gives you

- **A WORM-logged decision record, not a plain log.** Every `approve`/`revoke` decision appends to
  the tenant's existing `@caisson/audit-worm` chain — no new anchoring primitive. A dropped or
  patched decision is tamper-evident: `chain.verify` catches it, the same guarantee every other
  WORM-logged module in this repo carries.
- **A typed `MembershipSnapshotSource` port.** One shape (`{ reviewerId, reviewees }`) three trivial
  adapters implement: `createCsvMembershipSnapshotSource`, `createJsonMembershipSnapshotSource`,
  `createInMemoryMembershipSnapshotSource`. Same shape discipline
  `@caisson/compliance-core`'s `EvidenceCollector` uses — `read()` is pure, the loader's own I/O
  stays outside the typed boundary.
- **Flag-never-guess close.** A campaign closes only when it is COMPLETE (every reviewee decided)
  or DUE (past its deadline) — never both, never neither. At close, every undecided reviewee lands
  in `unresolved`; it is never counted as approved.
- **A jobs-riding schedule.** `defineCampaignOpenTask` / `defineCampaignCloseTask` are
  `@caisson/jobs` `TaskDefinition`s — register them on a `JobQueue` (the shipped in-memory driver
  in dev/test; Trigger.dev in prod) and enqueue through `enqueueCampaignOpen` /
  `enqueueCampaignClose`, which set an overlap-safe `singletonKey`. Which reviewers are due for a
  fresh cycle, and which open campaigns are past their deadline, is the caller's own recurring
  scheduler's concern — this package only runs the operation once told who.

## Use

```ts
import {
  createCsvMembershipSnapshotSource,
  openCampaign,
  recordDecision,
  closeCampaign,
} from "@caisson/access-review";
import { AuditChainStore, LocalArtifactStore } from "@caisson/audit-worm";

const chain = new AuditChainStore({
  db,
  store: new LocalArtifactStore(wormDir),
});
const deps = { db, chain };

const snapshot = createCsvMembershipSnapshotSource(
  csvText,
  "reviewer-9",
).read();
const campaign = await openCampaign(deps, {
  accountId,
  reviewerId: snapshot.reviewerId,
  reviewees: snapshot.reviewees,
  deadlineMs: 30 * 24 * 60 * 60 * 1000, // 30-day review window
});

await recordDecision(deps, {
  accountId,
  campaignId: campaign.id,
  revieweeId: snapshot.reviewees[0],
  decision: "approve",
});

// Closes once every reviewee has decided, or once the deadline passes — whichever comes first.
const closed = await closeCampaign(deps, {
  accountId,
  campaignId: campaign.id,
});
closed.unresolved; // reviewees with no recorded decision — never treated as approved
```

## Scheduling

```ts
import { createInMemoryQueue } from "@caisson/jobs";
import {
  defineCampaignOpenTask,
  defineCampaignCloseTask,
  enqueueCampaignOpen,
  enqueueCampaignClose,
} from "@caisson/access-review";

const queue = createInMemoryQueue([
  defineCampaignOpenTask(deps),
  defineCampaignCloseTask(deps),
]);

// A recurring cadence (cron / your own scheduler) enqueues one open per reviewer due for a cycle:
await enqueueCampaignOpen(queue, {
  accountId,
  reviewerId,
  reviewees,
  deadlineMs: 30 * 24 * 60 * 60 * 1000,
});

// A deadline sweep enqueues a close attempt for every open campaign it finds past its window;
// `closeCampaign` refuses a premature close, so an eager or redundant poll is harmless.
await enqueueCampaignClose(queue, { accountId, campaignId });
```

## Migration

`src/migrations/0001_access_review_campaign.sql` — the roster table. `closed_at` is the only
app-updatable column after insert (the reviewer, roster, and deadline are immutable once opened);
the decision trail itself lives entirely on the audit chain, never in this table.

## Roadmap (v2, named — not built here)

A GitHub org/team connector implementing the SAME `MembershipSnapshotSource` port, pulling a live
roster instead of an imported CSV/JSON file. No live IdP/SaaS connector ships in this package.

## Out of scope

No reviewer-facing UI/portal — this is a data model plus a scheduling task; rendering a review
queue or an attestation screen is a consuming app's job. No live IdP/SaaS connectors. No HR/
personnel data beyond the decision record itself.
