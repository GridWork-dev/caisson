// src/campaign.integration.test.ts — the access-review lifecycle over a REAL Postgres (ADR-0371).
//
// Runs the real migration set on PGlite (no Docker, no network) plus the REAL `AuditChainStore` +
// `LocalArtifactStore` from `@caisson-sh/audit-worm` — the same chain every other WORM-logged module
// rides, no new anchoring primitive. Proves the SPEC's three load-bearing behaviors:
//   1. round-trip — a membership snapshot opens a campaign, decisions record, and every row
//      verifies against the chain (`chain.verify`);
//   2. deadline — a campaign past its window closes with its undecided reviewee flagged
//      `unresolved`, never silently approved;
//   3. the schedule.ts tasks run the SAME operations end-to-end over a real `JobQueue`.
//
// Migration composition is test-only and hand-rolled rather than routed through the
// `@caisson-sh/migrate` package-layering composer: that composer earns its keep assembling an
// EDITION's multi-package migration DAG with global renumbering (see
// @caisson-sh/compliance/src/migrate/assemble.ts); this test only needs two known packages' raw SQL
// concatenated once, so it resolves audit-worm's `src/migrations` directory the same
// `fileURLToPath` + relative-join way that composer's own package-set declaration does.
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
// PGlite under CI runner load regularly crosses the 5s default; repo-wide standard treatment.
setDefaultTimeout(30_000);
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { newTestPg, type TestPg } from "@caisson-sh/testing";
import { ConflictError, ValidationError } from "@caisson-sh/kernel";
import { buildTenantPolicySql } from "@caisson-sh/tenancy-rls";
import { AuditChainStore, LocalArtifactStore } from "@caisson-sh/audit-worm";
import { createInMemoryQueue } from "@caisson-sh/jobs";
import {
  closeCampaign,
  openCampaign,
  recordDecision,
  type CampaignDeps,
} from "./campaign.ts";
import { createCsvMembershipSnapshotSource } from "./snapshot.ts";
import {
  CAMPAIGN_CLOSE_TASK,
  CAMPAIGN_OPEN_TASK,
  defineCampaignCloseTask,
  defineCampaignOpenTask,
} from "./schedule.ts";

const T0 = new Date("2026-07-19T12:00:00.000Z");
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const AUDIT_WORM_MIGRATIONS = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "audit-worm",
  "src",
  "migrations",
);

let tp: TestPg;
let tmpDir: string;
let chain: AuditChainStore;
let migrationSql: string;
/** Mutable injected clock — advanced per-test to prove deadline behavior without sleeping. */
let clock: Date;
let deps: CampaignDeps;

beforeAll(async () => {
  migrationSql =
    (await Bun.file(
      join(AUDIT_WORM_MIGRATIONS, "0001_audit_chain.sql"),
    ).text()) +
    (await Bun.file(join(AUDIT_WORM_MIGRATIONS, "0002_versions.sql")).text()) +
    (await Bun.file(
      join(AUDIT_WORM_MIGRATIONS, "0003_rls_nullif.sql"),
    ).text()) +
    (await Bun.file(
      join(AUDIT_WORM_MIGRATIONS, "0004_artifact_versions.sql"),
    ).text()) +
    (await Bun.file(
      new URL("./migrations/0001_access_review_campaign.sql", import.meta.url),
    ).text());
  tp = await newTestPg();
  await tp.exec(migrationSql);
  tmpDir = await mkdtemp(join(tmpdir(), "access-review-"));
  const store = new LocalArtifactStore(tmpDir);
  clock = T0;
  chain = new AuditChainStore({ db: tp.pg, store, now: () => clock });
  deps = { db: tp.pg, chain, now: () => clock };
}, 120_000); // PGlite WASM init can be slow under parallel CI load — generous hook timeout.

afterAll(async () => {
  await tp.close();
  await rm(tmpDir, { recursive: true, force: true });
});

describe("access-review campaign lifecycle — real Postgres + the real audit-worm chain", () => {
  test("round-trip: snapshot in -> campaign opened -> decisions recorded -> WORM rows verify", async () => {
    const account = randomUUID();
    const snapshot = createCsvMembershipSnapshotSource(
      "reviewee_id\nuser-1\nuser-2\nuser-3\n",
      "reviewer-9",
    ).read();

    const campaign = await openCampaign(deps, {
      accountId: account,
      reviewerId: snapshot.reviewerId,
      reviewees: snapshot.reviewees,
      deadlineMs: 7 * ONE_DAY_MS,
    });
    expect(campaign.reviewees).toEqual(["user-1", "user-2", "user-3"]);

    await recordDecision(deps, {
      accountId: account,
      campaignId: campaign.id,
      revieweeId: "user-1",
      decision: "approve",
    });
    await recordDecision(deps, {
      accountId: account,
      campaignId: campaign.id,
      revieweeId: "user-2",
      decision: "revoke",
    });
    await recordDecision(deps, {
      accountId: account,
      campaignId: campaign.id,
      revieweeId: "user-3",
      decision: "approve",
    });

    // Every reviewee decided (completion), so the close succeeds well before the 7-day deadline.
    const closed = await closeCampaign(deps, {
      accountId: account,
      campaignId: campaign.id,
    });
    expect(closed.unresolved).toEqual([]);

    // 1 open + 3 decisions + 1 close = 5 chain entries, every one hash-linked and verifying —
    // the real `AuditChainStore.verify`, no substitute algebra.
    const entries = await chain.load(account);
    expect(entries).toHaveLength(5);
    const verification = await chain.verify(account);
    expect(verification.valid).toBe(true);
  });

  test("deadline: an undecided campaign closes past its window with unresolved flagged, never approved", async () => {
    const account = randomUUID();
    const campaign = await openCampaign(deps, {
      accountId: account,
      reviewerId: "reviewer-1",
      reviewees: ["user-a", "user-b"],
      deadlineMs: ONE_DAY_MS,
    });
    await recordDecision(deps, {
      accountId: account,
      campaignId: campaign.id,
      revieweeId: "user-a",
      decision: "approve",
    });
    // user-b never decides.

    // Too early: neither complete nor due — refused, never a partial/forced close.
    await expect(
      closeCampaign(deps, { accountId: account, campaignId: campaign.id }),
    ).rejects.toThrow(ConflictError);

    clock = new Date(T0.getTime() + ONE_DAY_MS + 1);
    const closed = await closeCampaign(deps, {
      accountId: account,
      campaignId: campaign.id,
    });
    expect(closed.unresolved).toEqual(["user-b"]);
    clock = T0; // restore the shared module-level clock for later tests
  });

  test("a decision after close is refused, never silently appended", async () => {
    const account = randomUUID();
    const campaign = await openCampaign(deps, {
      accountId: account,
      reviewerId: "reviewer-2",
      reviewees: ["user-x"],
      deadlineMs: ONE_DAY_MS,
    });
    clock = new Date(T0.getTime() + ONE_DAY_MS + 1);
    await closeCampaign(deps, { accountId: account, campaignId: campaign.id });
    await expect(
      recordDecision(deps, {
        accountId: account,
        campaignId: campaign.id,
        revieweeId: "user-x",
        decision: "approve",
      }),
    ).rejects.toThrow(ConflictError);
    clock = T0;
  });

  test("a reviewee outside the frozen roster is refused", async () => {
    const account = randomUUID();
    const campaign = await openCampaign(deps, {
      accountId: account,
      reviewerId: "reviewer-3",
      reviewees: ["user-y"],
      deadlineMs: ONE_DAY_MS,
    });
    await expect(
      recordDecision(deps, {
        accountId: account,
        campaignId: campaign.id,
        revieweeId: "not-on-roster",
        decision: "approve",
      }),
    ).rejects.toThrow(ValidationError);
  });

  test("a substring of a roster entry is refused, never treated as a roster match", async () => {
    // Guards against the roster check degrading to substring matching (e.g. a driver that hands
    // back the jsonb column as a JSON string instead of a parsed array) — "user" must never be
    // accepted just because "user-1" is on the roster.
    const account = randomUUID();
    const campaign = await openCampaign(deps, {
      accountId: account,
      reviewerId: "reviewer-5",
      reviewees: ["user-1"],
      deadlineMs: ONE_DAY_MS,
    });
    await expect(
      recordDecision(deps, {
        accountId: account,
        campaignId: campaign.id,
        revieweeId: "user",
        decision: "approve",
      }),
    ).rejects.toThrow(ValidationError);
  });

  test("the schedule.ts tasks run open + close end-to-end over a real JobQueue", async () => {
    const account = randomUUID();
    const queue = createInMemoryQueue([
      defineCampaignOpenTask(deps),
      defineCampaignCloseTask(deps),
    ]);
    await queue.enqueue(CAMPAIGN_OPEN_TASK, {
      accountId: account,
      reviewerId: "reviewer-4",
      reviewees: ["user-z"],
      deadlineMs: ONE_DAY_MS,
    });
    const opened = await tp.query<{ id: string; closed_at: string | null }>(
      `SELECT id, closed_at FROM access_review_campaign WHERE account_id = $1`,
      [account],
    );
    expect(opened).toHaveLength(1);
    expect(opened[0]?.closed_at).toBeNull();

    clock = new Date(T0.getTime() + ONE_DAY_MS + 1);
    await queue.enqueue(CAMPAIGN_CLOSE_TASK, {
      accountId: account,
      campaignId: opened[0]?.id,
    });
    const after = await tp.query<{ closed_at: string | null }>(
      `SELECT closed_at FROM access_review_campaign WHERE id = $1`,
      [opened[0]?.id],
    );
    expect(after[0]?.closed_at).not.toBeNull();
    clock = T0;
  });

  test("migration RLS mirrors buildTenantPolicySql with the closed_at column-scoped grant", () => {
    for (const line of buildTenantPolicySql("access_review_campaign").split(
      "\n",
    )) {
      if (line.startsWith("GRANT ")) continue; // the grant is narrowed below.
      expect(migrationSql).toContain(line);
    }
    expect(migrationSql).toContain(
      "GRANT SELECT, INSERT, UPDATE (closed_at) ON access_review_campaign TO app;",
    );
  });
});
