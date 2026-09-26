// Unit tests for the retention policy (ADR-0067): dedup-on-write, default sliding TTL, and the
// GC pass (expired / decayed / over-cap). Pure + deterministic — every case pins an explicit `now`, so
// there is no clock, randomness, or I/O (no live call anywhere). Offline and engine-neutral.
import { describe, expect, test } from "bun:test";
import { ValidationError } from "@caisson-sh/kernel";
import {
  applyTtlDefault,
  contentDigest,
  decideWrite,
  dedupKey,
  isExpired,
  parseGcConfig,
  planGc,
  retentionScore,
  type GcConfig,
} from "./gc.ts";
import { DEFAULT_SCOPE, type MemoryItem } from "./schema.ts";

const NOW = 1_000_000;

/**
 * Build a typed `MemoryItem` directly (label ids, not UUIDs — gc operates on the POST-boundary record
 * and never re-validates the id). Honors `exactOptionalPropertyTypes`: `expiresAt` is added only when set.
 */
function item(over: {
  id: string;
  text: string;
  scope?: string;
  createdAt?: number;
  expiresAt?: number;
}): MemoryItem {
  const base: MemoryItem = {
    id: over.id,
    text: over.text,
    scope: over.scope ?? DEFAULT_SCOPE,
    createdAt: over.createdAt ?? NOW,
  };
  return over.expiresAt === undefined
    ? base
    : { ...base, expiresAt: over.expiresAt };
}

describe("parseGcConfig (adopter-config boundary)", () => {
  test("fills the decayFloor default and accepts a bare config", () => {
    expect(parseGcConfig({})).toEqual({ decayFloor: 0.05 });
  });

  test("rejects an unknown field (strict boundary)", () => {
    expect(() => parseGcConfig({ ttl: 10 })).toThrow(ValidationError);
  });

  test("rejects a non-integer / non-positive TTL (fail-closed)", () => {
    expect(() => parseGcConfig({ defaultTtlMs: 1.5 })).toThrow(ValidationError);
    expect(() => parseGcConfig({ defaultTtlMs: 0 })).toThrow(ValidationError);
  });

  test("rejects a decayFloor outside 0..1", () => {
    expect(() => parseGcConfig({ decayFloor: 1.5 })).toThrow(ValidationError);
  });
});

describe("contentDigest / dedupKey", () => {
  test("digest is whitespace- and case-insensitive (near-duplicate collapse)", () => {
    expect(contentDigest("  Hello   World ")).toBe(
      contentDigest("hello world"),
    );
    expect(contentDigest("distinct fact")).not.toBe(
      contentDigest("hello world"),
    );
  });

  test("dedup key is scoped — same content, different scope ⇒ different key", () => {
    const a = item({ id: crypto.randomUUID(), text: "same fact", scope: "a" });
    const b = item({ id: crypto.randomUUID(), text: "same fact", scope: "b" });
    expect(dedupKey(a)).not.toBe(dedupKey(b));
    const a2 = item({
      id: crypto.randomUUID(),
      text: "SAME   fact",
      scope: "a",
    });
    expect(dedupKey(a)).toBe(dedupKey(a2));
  });
});

describe("applyTtlDefault", () => {
  test("fills expiresAt from the default when absent", () => {
    const cfg = parseGcConfig({ defaultTtlMs: 500 });
    expect(
      applyTtlDefault(item({ id: crypto.randomUUID(), text: "x" }), cfg)
        .expiresAt,
    ).toBe(NOW + 500);
  });

  test("never overrides an explicit expiresAt (absolute caller deadline)", () => {
    const cfg = parseGcConfig({ defaultTtlMs: 500 });
    const withExpiry = item({
      id: crypto.randomUUID(),
      text: "x",
      expiresAt: NOW + 9,
    });
    expect(applyTtlDefault(withExpiry, cfg).expiresAt).toBe(NOW + 9);
  });

  test("no default configured ⇒ no expiry invented", () => {
    const cfg = parseGcConfig({});
    expect(
      applyTtlDefault(item({ id: crypto.randomUUID(), text: "x" }), cfg)
        .expiresAt,
    ).toBeUndefined();
  });
});

describe("decideWrite (dedup-on-write)", () => {
  const cfg: GcConfig = parseGcConfig({ defaultTtlMs: 1000 });

  test("no duplicate ⇒ insert with the default TTL applied", () => {
    const candidate = item({ id: crypto.randomUUID(), text: "fresh fact" });
    const d = decideWrite([], candidate, cfg, NOW);
    expect(d.action).toBe("insert");
    expect(d.item.expiresAt).toBe(NOW + 1000);
  });

  test("content duplicate ⇒ reinforce the existing item, never a second row", () => {
    const existing = item({ id: "keep-1", text: "the lazy fox" });
    const candidate = item({
      id: crypto.randomUUID(),
      text: "  The Lazy   Fox  ",
    });
    const later = NOW + 250;
    const d = decideWrite([existing], candidate, cfg, later);
    expect(d.action).toBe("reinforce");
    // Reinforced: the EXISTING id is kept (collapse the duplicate), recency + TTL slide to `now`.
    expect(d.item.id).toBe("keep-1");
    if (d.action === "reinforce") expect(d.duplicateOf).toBe("keep-1");
    expect(d.item.createdAt).toBe(later);
    expect(d.item.expiresAt).toBe(later + 1000);
  });

  test("reinforce without a default TTL slides recency but not a hard expiry", () => {
    const noTtl = parseGcConfig({});
    const existing = item({ id: "keep-2", text: "fact", expiresAt: NOW + 5 });
    const d = decideWrite(
      [existing],
      item({ id: crypto.randomUUID(), text: "fact" }),
      noTtl,
      NOW + 3,
    );
    expect(d.action).toBe("reinforce");
    expect(d.item.createdAt).toBe(NOW + 3);
    expect(d.item.expiresAt).toBe(NOW + 5); // hard deadline honored, not extended
  });
});

describe("isExpired / retentionScore", () => {
  test("expiry boundary is inclusive at now", () => {
    expect(
      isExpired(
        item({ id: crypto.randomUUID(), text: "x", expiresAt: NOW }),
        NOW,
      ),
    ).toBe(true);
    expect(
      isExpired(
        item({ id: crypto.randomUUID(), text: "x", expiresAt: NOW + 1 }),
        NOW,
      ),
    ).toBe(false);
    expect(isExpired(item({ id: crypto.randomUUID(), text: "x" }), NOW)).toBe(
      false,
    );
  });

  test("retention halves every half-life", () => {
    const it = item({ id: crypto.randomUUID(), text: "x" });
    expect(retentionScore(it, NOW, 100)).toBe(1);
    expect(retentionScore(it, NOW + 100, 100)).toBeCloseTo(0.5, 10);
    expect(retentionScore(it, NOW + 200, 100)).toBeCloseTo(0.25, 10);
  });
});

describe("planGc", () => {
  test("drops expired items, keeps the rest (TTL-only)", () => {
    const cfg = parseGcConfig({});
    const live = item({ id: "live", text: "a", expiresAt: NOW + 10 });
    const dead = item({ id: "dead", text: "b", expiresAt: NOW - 1 });
    const plan = planGc([live, dead], cfg, NOW);
    expect(plan.keep.map((i) => i.id)).toEqual(["live"]);
    expect(plan.drop).toEqual([{ item: dead, reason: "expired" }]);
  });

  test("drops decayed items below the floor when decay is on", () => {
    const cfg = parseGcConfig({ halfLifeMs: 100, decayFloor: 0.1 });
    const fresh = item({ id: "fresh", text: "a" }); // score 1 at NOW
    const stale = item({ id: "stale", text: "b", createdAt: NOW - 1000 }); // score ~9.7e-4 < 0.1
    const plan = planGc([fresh, stale], cfg, NOW);
    expect(plan.keep.map((i) => i.id)).toEqual(["fresh"]);
    expect(plan.drop).toEqual([{ item: stale, reason: "decayed" }]);
  });

  test("caps per scope, evicting the lowest-retention overflow", () => {
    const cfg = parseGcConfig({ halfLifeMs: 100, maxPerScope: 2 });
    const newest = item({ id: "n", text: "1", createdAt: NOW });
    const mid = item({ id: "m", text: "2", createdAt: NOW - 50 });
    const oldest = item({ id: "o", text: "3", createdAt: NOW - 80 });
    const plan = planGc([oldest, newest, mid], cfg, NOW);
    expect(new Set(plan.keep.map((i) => i.id))).toEqual(new Set(["n", "m"]));
    expect(plan.drop).toEqual([{ item: oldest, reason: "overflow" }]);
  });

  test("the cap is per scope, not global", () => {
    const cfg = parseGcConfig({ maxPerScope: 1 });
    const a1 = item({ id: "a1", text: "1", scope: "a", createdAt: NOW });
    const a2 = item({ id: "a2", text: "2", scope: "a", createdAt: NOW - 1 });
    const b1 = item({ id: "b1", text: "3", scope: "b", createdAt: NOW });
    const plan = planGc([a1, a2, b1], cfg, NOW);
    expect(new Set(plan.keep.map((i) => i.id))).toEqual(new Set(["a1", "b1"]));
    expect(plan.drop).toEqual([{ item: a2, reason: "overflow" }]);
  });

  test("precedence: expired before decayed before overflow", () => {
    const cfg = parseGcConfig({
      halfLifeMs: 100,
      decayFloor: 0.1,
      maxPerScope: 1,
    });
    const expired = item({ id: "exp", text: "1", expiresAt: NOW - 1 });
    const decayed = item({ id: "dec", text: "2", createdAt: NOW - 1000 });
    const keep = item({ id: "keep", text: "3", createdAt: NOW });
    const plan = planGc([expired, decayed, keep], cfg, NOW);
    expect(plan.keep.map((i) => i.id)).toEqual(["keep"]);
    expect(plan.drop).toEqual([
      { item: expired, reason: "expired" },
      { item: decayed, reason: "decayed" },
    ]);
  });

  test("uncapped, no-decay config keeps everything live (input order preserved)", () => {
    const cfg = parseGcConfig({});
    const items = [
      item({ id: "1", text: "a" }),
      item({ id: "2", text: "b" }),
      item({ id: "3", text: "c" }),
    ];
    const plan = planGc(items, cfg, NOW);
    expect(plan.keep.map((i) => i.id)).toEqual(["1", "2", "3"]);
    expect(plan.drop).toEqual([]);
  });
});
