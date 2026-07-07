// RENEWAL_BOOK (ADR-0244/0251): fail-closed resolve, the branch predicate, placeholder hygiene, and
// the ONE-BOOK invariant — a provider price id lives in exactly one of PURCHASE_BOOK / PLAN_BOOK /
// RENEWAL_BOOK (a price id resolving in two books would double-fulfill a paid line).
import { describe, expect, test } from "bun:test";
import { PLAN_BOOK } from "./plans.ts";
import { PURCHASE_BOOK } from "./purchases.ts";
import {
  RENEWAL_BOOK,
  isRenewalPrice,
  parseRenewalBook,
  resolveRenewal,
} from "./renewals.ts";

describe("RENEWAL_BOOK (ADR-0251)", () => {
  test("a known renewal price resolves to the entitlement it renews", () => {
    expect(resolveRenewal("pri_01kwvz6kzh4h43aec3r5rs5je4")).toEqual({
      renewsEntitlement: "compliance",
    });
  });

  test("the four repointed bundle renewal rows resolve to their canonical id (ADR-0270 repoint)", () => {
    // These rows were REPOINTED from the dissolved edition ids to canonical bundle ids by the ADR-0270
    // edition-trace purge, so they store — and resolveRenewal returns — the canonical id directly (no
    // alias normalization; the spine is empty). The id the catalog + grants converge on.
    expect(
      resolveRenewal("pri_01kwvz6m46s5tj4k2a09kcaf9s").renewsEntitlement,
    ).toBe("ai-production");
    expect(
      resolveRenewal("pri_01kwvz6m791c1xb4wxbedzf9nt").renewsEntitlement,
    ).toBe("local-first");
    expect(
      resolveRenewal("pri_01kwvz6m9tr49rstw0x7s8nk5h").renewsEntitlement,
    ).toBe("agentic-dev");
    expect(
      resolveRenewal("pri_01kwvz6mcfzgjemqa72czdfkmq").renewsEntitlement,
    ).toBe("everything");
  });

  test("a module renewal row and a canonical bundle-id row resolve to their stored id verbatim", () => {
    // resolveRenewal returns the stored `renewsEntitlement` as-is (ADR-0270 dropped the normalize step).
    // A bare module slug resolves to itself.
    expect(
      resolveRenewal("pri_01kwvz6mf22rqfrx6reh4b88sm").renewsEntitlement,
    ).toBe("field-crypto");
    // A canonical bundle-id row (every row post-ADR-0270) resolves to that id verbatim.
    const newIdBook = {
      pri_01test000000000000000000new: { renewsEntitlement: "provenance" },
    };
    expect(
      resolveRenewal("pri_01test000000000000000000new", newIdBook)
        .renewsEntitlement,
    ).toBe("provenance");
  });

  test("an unknown price id THROWS (fail-closed — never a guessed extension)", () => {
    expect(() => resolveRenewal("pri_unknown_00000000000000000000")).toThrow(
      /no renewal-book entry/,
    );
  });

  test("an inherited object key never resolves (own-property check)", () => {
    expect(() => resolveRenewal("__proto__")).toThrow();
    expect(isRenewalPrice("constructor")).toBe(false);
  });

  test("isRenewalPrice is the branch predicate — true for renewal SKUs, false otherwise", () => {
    expect(isRenewalPrice("pri_01kwvz6mcfzgjemqa72czdfkmq")).toBe(true);
    expect(isRenewalPrice("pri_01kwd76be2eq96kff5nqw236c0")).toBe(false); // a PURCHASE_BOOK id
  });

  test("every row parses under the strict boundary schema", () => {
    expect(() => parseRenewalBook(RENEWAL_BOOK)).not.toThrow();
    expect(() =>
      parseRenewalBook({ pri_x: { renewsEntitlement: "x", extra: 1 } }),
    ).toThrow();
  });

  test("every row carries a real Paddle price id (no placeholder left behind)", () => {
    for (const id of Object.keys(RENEWAL_BOOK)) {
      expect(id).toMatch(/^pri_01[a-z0-9]{24}$/);
      expect(id).not.toContain("placeholder");
    }
  });

  test("a price id lives in EXACTLY ONE of PURCHASE_BOOK / PLAN_BOOK / RENEWAL_BOOK", () => {
    const books: [string, Record<string, unknown>][] = [
      ["PURCHASE_BOOK", PURCHASE_BOOK],
      ["PLAN_BOOK", PLAN_BOOK],
      ["RENEWAL_BOOK", RENEWAL_BOOK],
    ];
    const seen = new Map<string, string>();
    for (const [name, book] of books) {
      for (const priceId of Object.keys(book)) {
        const prior = seen.get(priceId);
        expect(
          prior === undefined
            ? null
            : `${priceId} is in both ${prior} and ${name}`,
        ).toBeNull();
        seen.set(priceId, name);
      }
    }
  });

  test("the W7 catalog rows resolve — every carve/new SKU and the Provenance bundle is renewable", () => {
    // The 12 net-new sandbox renewal prices created at the catalog big-bang (2026-07-06). With the
    // five legacy-keyed edition/bundle rows normalizing to the other five bundles, the full sellable
    // catalog is renewable: 22 modules + 6 bundles across 28 rows.
    const W7_RENEWAL_ROWS: Readonly<Record<string, string>> = {
      pri_01kwwqa4k2z4wx3b53nacbpd7w: "provenance",
      pri_01kwwqa4n21y7ah006yb9q07r1: "compliance-core",
      pri_01kwwqa4qc77j5f1pn61811ent: "frameworks-pack",
      pri_01kwwqa4sfhdbp2rn09s1kpsae: "signing-primitive",
      pri_01kwwqa4vaa99c75mbydysxc2d: "credits",
      pri_01kwwqa4xgef5bzfws498q31y0: "local-sync",
      pri_01kwwqa4zkwdfbxsefe7kveex2: "local-inference",
      pri_01kwwqa51khjcn3y79m7dwhm3z: "local-privacy",
      pri_01kwwqa5434re4xvzpd0y77s35: "tool-exec",
      pri_01kwwqa5634seyq4v05hmft4ws: "org-controls",
      pri_01kwwqa58355kq4t05rtk5v8qf: "billing-orchestration",
      pri_01kwwqa5a8z41s64x1fnfzqanj: "ui-pro",
    };
    for (const [priceId, ent] of Object.entries(W7_RENEWAL_ROWS)) {
      expect(resolveRenewal(priceId).renewsEntitlement).toBe(ent);
    }
    expect(Object.keys(RENEWAL_BOOK).length).toBe(28);
  });
});
