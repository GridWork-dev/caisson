// resolveAccountEntitlements end to end (ADR-0071): stored purchased ids → expanded member slugs,
// over PGlite + real withTenant RLS and a synthetic registry index. Proves the wiring (store read →
// index expansion) — the expansion correctness itself is golden-tested in @caisson/registry-schema.
// Asserts: an edition resolves to ONLY its index-derived members (not base); the bundle resolves to
// everything; no entitlement resolves to the empty set; a stored id absent from the index fails closed
// (the resolver propagates expandEntitlements' throw — never a silent drop, threat TM-E).
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  type RegistryIndex,
  loadRegistryIndex,
} from "@caisson/registry-schema";
import { type TestPg, newTestPg } from "@caisson/testing";
import { withTenant } from "@caisson/tenancy-rls";
import {
  ENTITLEMENT_GRANT_LINE_ITEM_MIGRATION_SQL,
  ENTITLEMENT_GRANT_UPDATES_WINDOW_MIGRATION_SQL,
  RENEWAL_EXTENSION_SCHEMA_SQL,
  ENTITLEMENT_SCHEMA_SQL,
  grantEntitlements,
} from "./entitlement-store.ts";
import { resolveAccountEntitlements } from "./resolve-entitlements.ts";

/** A module entry for the synthetic index. Base = oss/Apache (no price); an edition member = a
 *  commercial paid module tagged into the edition (license⟺tier refine, ADR-0094). */
function entry(
  id: string,
  editions: readonly ("compliance" | "ai-kit" | "local-ai" | "agent-dev")[],
): RegistryIndex["modules"][number] {
  const open = editions.length === 0;
  return {
    id,
    latest: "1.0.0",
    versions: [
      {
        version: "1.0.0",
        publishedAt: "2026-01-01T00:00:00.000Z",
        gateAttestation: "ci-run-1@deadbeef",
        manifest: {
          id,
          version: "1.0.0",
          kind: "base",
          tier: open ? "oss" : "paid",
          license: open ? "Apache-2.0" : "LicenseRef-Caisson-Commercial",
          priceCents: open ? null : 4900,
          editions: [...editions],
          description: id,
        },
      },
    ],
  } as RegistryIndex["modules"][number];
}

const index = loadRegistryIndex({
  schemaVersion: 1,
  modules: [
    entry("@caisson/kernel", []), // base
    entry("@caisson/compliance", ["compliance"]),
    entry("@caisson/ai-kit", ["ai-kit"]),
    entry("@caisson/audit-worm", []), // per-module bare-slug purchase target below
  ],
});

let tp: TestPg;

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(ENTITLEMENT_SCHEMA_SQL);
  await tp.exec(ENTITLEMENT_GRANT_LINE_ITEM_MIGRATION_SQL);
  await tp.exec(ENTITLEMENT_GRANT_UPDATES_WINDOW_MIGRATION_SQL);
  await tp.exec(RENEWAL_EXTENSION_SCHEMA_SQL);
});

afterAll(async () => {
  await tp.close();
});

describe("resolveAccountEntitlements (ADR-0071)", () => {
  test("an edition resolves to exactly its index-derived members (server-side: no base)", async () => {
    const acct = "acct_comp";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "in_1",
        source: { kind: "subscription", subscriptionId: "sub_1" },
      }),
    );
    const resolved = await withTenant(tp.pg, acct, (tx) =>
      resolveAccountEntitlements(tx, acct, index),
    );
    expect([...resolved].sort()).toEqual(["@caisson/compliance"]);
  });

  test("the everything bundle resolves to every module (base ∪ all editions)", async () => {
    const acct = "acct_bundle";
    // ADR-0270: the legacy `bundle` sentinel is purged; the whole catalog is bought as `everything`,
    // which on an index without an explicit everything bundle entry derives base ∪ every edition.
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["everything"],
        sourceEventId: "in_b",
        source: { kind: "one_time", purchaseId: "pi_b" },
      }),
    );
    const resolved = await withTenant(tp.pg, acct, (tx) =>
      resolveAccountEntitlements(tx, acct, index),
    );
    expect([...resolved].sort()).toEqual([
      "@caisson/ai-kit",
      "@caisson/audit-worm",
      "@caisson/compliance",
      "@caisson/kernel",
    ]);
  });

  test("no entitlement resolves to the empty set (no access)", async () => {
    const acct = "acct_none";
    const resolved = await withTenant(tp.pg, acct, (tx) =>
      resolveAccountEntitlements(tx, acct, index),
    );
    expect(resolved.size).toBe(0);
  });

  test("a stored id absent from the index fails closed (resolver propagates the throw)", async () => {
    const acct = "acct_stale";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["not-an-edition"],
        sourceEventId: "in_s",
        source: { kind: "subscription", subscriptionId: "sub_s" },
      }),
    );
    await expect(
      withTenant(tp.pg, acct, (tx) =>
        resolveAccountEntitlements(tx, acct, index),
      ),
    ).rejects.toThrow();
  });

  test("a bare-slug per-module purchase resolves to exactly that module (P6-store track)", async () => {
    const acct = "acct_module";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["audit-worm"], // the bare package slug, not @caisson/audit-worm
        sourceEventId: "in_m",
        source: { kind: "one_time", purchaseId: "pi_m" },
      }),
    );
    const resolved = await withTenant(tp.pg, acct, (tx) =>
      resolveAccountEntitlements(tx, acct, index),
    );
    expect([...resolved]).toEqual(["@caisson/audit-worm"]);
  });

  test("a graduated bare-slug purchase resolves to its real indexed grant (no longer reserved)", async () => {
    // "alerting" graduated: it left RESERVED_MODULE_ENTITLEMENT_IDS once its package shipped and got
    // indexed, so a purchase now resolves to the real @caisson/alerting grant rather than fail-softing
    // to nothing. Index that carries it (as the real registry index does) → both members resolve.
    const acct = "acct_graduated";
    const indexWithAlerting = loadRegistryIndex({
      schemaVersion: 1,
      modules: [
        entry("@caisson/kernel", []),
        entry("@caisson/audit-worm", []),
        entry("@caisson/alerting", []),
      ],
    });
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["audit-worm", "alerting"],
        sourceEventId: "in_r",
        source: { kind: "one_time", purchaseId: "pi_r" },
      }),
    );
    const resolved = await withTenant(tp.pg, acct, (tx) =>
      resolveAccountEntitlements(tx, acct, indexWithAlerting),
    );
    expect([...resolved].sort()).toEqual([
      "@caisson/alerting",
      "@caisson/audit-worm",
    ]);
  });

  test("a member added AFTER the buyer's entitledSince is snapshot-filtered out; a later buyer gets it (ADR-0257 §1.2 wiring)", async () => {
    // A compliance bundle whose members carry REAL pricebook join dates: audit-worm joined at
    // GENESIS (2026-06-01), compliance-core at the catalog rework (2026-07-06). The gate injects
    // the pricebook timeline + the buyer's `entitledSince` (= their grant's granted_at).
    const snapIndex = loadRegistryIndex({
      schemaVersion: 1,
      modules: [
        entry("@caisson/kernel", []),
        entry("@caisson/audit-worm", ["compliance"]),
        entry("@caisson/compliance-core", ["compliance"]),
      ],
    });

    // EARLY buyer — bought 2026-06-15, before compliance-core joined the bundle.
    const early = "acct_snap_early";
    await withTenant(tp.pg, early, (tx) =>
      grantEntitlements(tx, {
        accountId: early,
        entitlementIds: ["compliance"],
        sourceEventId: "pi_early",
        source: { kind: "one_time", purchaseId: "pi_early" },
      }),
    );
    await tp.query(
      `UPDATE entitlement_grant SET granted_at = $2 WHERE account_id = $1`,
      [early, "2026-06-15T00:00:00.000Z"],
    );
    expect(
      [
        ...(await withTenant(tp.pg, early, (tx) =>
          resolveAccountEntitlements(tx, early, snapIndex),
        )),
      ].sort(),
    ).toEqual(["@caisson/audit-worm"]); // compliance-core joined later → NOT expanded

    // LATE buyer — bought 2026-07-10, after compliance-core joined → gets it.
    const late = "acct_snap_late";
    await withTenant(tp.pg, late, (tx) =>
      grantEntitlements(tx, {
        accountId: late,
        entitlementIds: ["compliance"],
        sourceEventId: "pi_late",
        source: { kind: "one_time", purchaseId: "pi_late" },
      }),
    );
    await tp.query(
      `UPDATE entitlement_grant SET granted_at = $2 WHERE account_id = $1`,
      [late, "2026-07-10T00:00:00.000Z"],
    );
    expect(
      [
        ...(await withTenant(tp.pg, late, (tx) =>
          resolveAccountEntitlements(tx, late, snapIndex),
        )),
      ].sort(),
    ).toEqual(["@caisson/audit-worm", "@caisson/compliance-core"]);
  });
});
