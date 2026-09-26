// Data-lint for the /stack-fit adapter surface: every sellable module carries an honest DB posture,
// and the posture groups + axes are well-formed. Pins the posture map to MODULES so a new
// module can never ship without a truthful "does it need a database" classification.
import { describe, expect, test } from "bun:test";

import { MODULES } from "./catalog";
import {
  MODULE_DB_POSTURE,
  POSTURE_GROUPS,
  STACK_AXES,
  type DbPosture,
} from "./stack-fit";

describe("MODULE_DB_POSTURE", () => {
  test("every sellable module has exactly one posture (bijection with MODULES)", () => {
    const priced = MODULES.map((m) => m.id).sort();
    const classified = Object.keys(MODULE_DB_POSTURE).sort();
    expect(classified).toEqual(priced);
  });

  test("every posture is a valid bucket", () => {
    const valid = new Set<DbPosture>(["postgres", "sqlite", "none"]);
    for (const [id, posture] of Object.entries(MODULE_DB_POSTURE)) {
      expect(valid.has(posture)).toBe(true);
      expect(typeof id).toBe("string");
    }
  });

  test("the Postgres-by-design set is pinned postgres (a regression to 'none' is a public misclaim)", () => {
    // Verified against the package sources: field-crypto ships the field_keys key-version tables
    // (src/migrations/0001/0002 + PgKeyVersionStore), alerting ships the alert_audit tables,
    // audit-worm/org-controls build on RLS'd tables, retention-runner schedules via pg-boss.
    for (const id of [
      "audit-worm",
      "field-crypto",
      "alerting",
      "retention-runner",
      "org-controls",
    ]) {
      expect(MODULE_DB_POSTURE[id]).toBe("postgres");
    }
  });

  test("the on-device modules are pinned sqlite", () => {
    for (const id of ["local-store", "local-sync"]) {
      expect(MODULE_DB_POSTURE[id]).toBe("sqlite");
    }
  });
});

describe("POSTURE_GROUPS + STACK_AXES", () => {
  test("the three posture buckets are each represented exactly once", () => {
    const buckets = POSTURE_GROUPS.map((g) => g.posture).sort();
    expect(buckets).toEqual(["none", "postgres", "sqlite"]);
    // Every classified module falls into one of the three groups (no orphan posture).
    const groupSet = new Set(POSTURE_GROUPS.map((g) => g.posture));
    for (const posture of Object.values(MODULE_DB_POSTURE)) {
      expect(groupSet.has(posture)).toBe(true);
    }
  });

  test("each posture group has a heading and a note", () => {
    for (const g of POSTURE_GROUPS) {
      expect(g.heading.length).toBeGreaterThan(0);
      expect(g.note.length).toBeGreaterThan(0);
    }
  });

  test("each stack axis carries a title, a fit line, supported options, and a note", () => {
    expect(STACK_AXES.length).toBeGreaterThan(0);
    for (const a of STACK_AXES) {
      expect(a.title.length).toBeGreaterThan(0);
      expect(a.fit.length).toBeGreaterThan(0);
      expect(a.supported.length).toBeGreaterThan(0);
      expect(a.note.length).toBeGreaterThan(0);
    }
  });
});
