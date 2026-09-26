import { describe, expect, test } from "bun:test";
import { ValidationError } from "@caisson-sh/kernel";
import type { AuditChainEntry } from "@caisson-sh/kernel";
import {
  AuditedLifecycle,
  InMemoryAuditLifecycleStore,
} from "./audit-lifecycle.ts";
import { deny, mutate } from "./governance.ts";
import type { Act } from "./lifecycle.ts";

// A deterministic clock so recorded payloads (and thus chain hashes) are reproducible.
const CLOCK = () => "2026-06-27T00:00:00.000Z";

/** A legal full lifecycle path as consecutive edges: spec→plan→…→ship. */
const PATH: readonly (readonly [Act, Act])[] = [
  ["spec", "plan"],
  ["plan", "execute"],
  ["execute", "verify"],
  ["verify", "sweep"],
  ["sweep", "ship"],
];

/** Drive `lc` over the full legal path; returns the engine for chaining assertions. */
async function recordPath(lc: AuditedLifecycle): Promise<void> {
  for (const [from, to] of PATH) await lc.record(from, to);
}

describe("opt-in mode — the audited upgrade is off by default", () => {
  test("unaudited records nothing but still FSM-validates the edge", async () => {
    const store = new InMemoryAuditLifecycleStore();
    const lc = new AuditedLifecycle({ store, now: CLOCK });
    expect(lc.audited).toBe(false);

    const outcome = await lc.record("spec", "plan");
    expect(outcome).toEqual({ recorded: false });

    const snap = await lc.snapshot();
    expect(snap.entries).toEqual([]);
    expect(snap.anchor).toBeNull();
    // Nothing recorded → the chain verifies vacuously.
    expect(await lc.verify()).toEqual({ valid: true, brokenAt: null });
    expect(await lc.currentVersion()).toBeNull();
  });

  test("unaudited still rejects an illegal FSM edge (flag-never-guess)", async () => {
    const store = new InMemoryAuditLifecycleStore();
    const lc = new AuditedLifecycle({ store, now: CLOCK });
    expect(lc.record("spec", "execute")).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});

describe("audited mode — records each governed transition into chain + versioning", () => {
  test("a full legal path chains, anchors, and verifies against its anchor", async () => {
    const store = new InMemoryAuditLifecycleStore();
    const lc = new AuditedLifecycle({ store, audited: true, now: CLOCK });

    await recordPath(lc);
    const snap = await lc.snapshot();

    expect(snap.entries).toHaveLength(PATH.length);
    expect(snap.anchor).not.toBeNull();
    expect(snap.anchor?.length).toBe(PATH.length);
    // Genesis has a null prevHash; every later entry binds its predecessor's hash.
    expect(snap.entries[0]?.prevHash).toBeNull();
    for (let i = 1; i < snap.entries.length; i++) {
      expect(snap.entries[i]?.prevHash).toBe(snap.entries[i - 1]?.hash ?? null);
    }
    // The append-only version lineage is keyed on entry hashes (id = hash, supersedesId = prevHash).
    expect(snap.versions.map((v) => v.id)).toEqual(
      snap.entries.map((e) => e.hash),
    );
    const tip = snap.entries[snap.entries.length - 1] as AuditChainEntry;
    expect((await lc.currentVersion())?.id).toBe(tip.hash);

    // The pristine chain verifies, with and without the trusted anchor.
    expect(await lc.verify()).toEqual({ valid: true, brokenAt: null });
    expect(await lc.verify(snap.anchor ?? undefined)).toEqual({
      valid: true,
      brokenAt: null,
    });
  });

  test("a recorded outcome carries the entry, version, and re-minted anchor", async () => {
    const store = new InMemoryAuditLifecycleStore();
    const lc = new AuditedLifecycle({ store, audited: true, now: CLOCK });

    const first = await lc.record("spec", "plan", mutate({ note: "policy" }));
    expect(first.recorded).toBe(true);
    if (first.recorded) {
      expect(first.entry.seq).toBe(0);
      expect(first.entry.prevHash).toBeNull();
      expect(first.version.id).toBe(first.entry.hash);
      expect(first.version.supersedesId).toBeNull();
      expect(first.anchor.length).toBe(1);
      // The mutate decision is recorded; no reason/context value leaks into the payload.
      expect(first.entry.payload).toEqual({
        from: "spec",
        to: "plan",
        decision: "mutate",
        at: CLOCK(),
      });
    }
  });

  test("fail-closed: a vetoed (deny) transition is never recorded", async () => {
    const store = new InMemoryAuditLifecycleStore();
    const lc = new AuditedLifecycle({ store, audited: true, now: CLOCK });
    expect(lc.record("spec", "plan", deny("blocked"))).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect((await lc.snapshot()).entries).toEqual([]);
  });

  test("an illegal edge throws and persists nothing", async () => {
    const store = new InMemoryAuditLifecycleStore();
    const lc = new AuditedLifecycle({ store, audited: true, now: CLOCK });
    await lc.record("spec", "plan");
    expect(lc.record("plan", "ship")).rejects.toBeInstanceOf(ValidationError);
    expect((await lc.snapshot()).entries).toHaveLength(1);
  });
});

describe("the moat — a tampered transition fails verifyChain against the anchor", () => {
  test("interior tamper is caught (anchor not even required)", async () => {
    const store = new InMemoryAuditLifecycleStore();
    const lc = new AuditedLifecycle({ store, audited: true, now: CLOCK });
    await recordPath(lc);
    const snap = await lc.snapshot();

    // Forge the payload of an interior entry, leaving its (now-stale) hash in place.
    const tampered = snap.entries.map((e, i) =>
      i === 2 ? { ...e, payload: { ...(e.payload as object), to: "ship" } } : e,
    ) as AuditChainEntry[];
    store.write({
      entries: tampered,
      versions: snap.versions,
      anchor: snap.anchor,
    });

    expect(await lc.verify()).toEqual({ valid: false, brokenAt: 2 });
    expect(await lc.verify(snap.anchor ?? undefined)).toEqual({
      valid: false,
      brokenAt: 2,
    });
  });

  test("tail truncation is caught ONLY against the WORM-held anchor", async () => {
    const store = new InMemoryAuditLifecycleStore();
    const lc = new AuditedLifecycle({ store, audited: true, now: CLOCK });
    await recordPath(lc);
    const wormAnchor = (await lc.snapshot()).anchor; // held outside the chain (WORM)
    expect(wormAnchor).not.toBeNull();

    // An attacker drops the last entry AND re-mints a fresh, self-consistent anchor over the stub.
    const truncated = (await lc.snapshot()).entries.slice(
      0,
      -1,
    ) as AuditChainEntry[];
    const truncatedVersions = (await lc.snapshot()).versions.slice(0, -1);
    const lc2 = new AuditedLifecycle({ store, audited: true, now: CLOCK });
    // Re-mint the attacker's anchor by re-driving a fresh chain of the same prefix.
    const reAnchorStore = new InMemoryAuditLifecycleStore();
    const reAnchorLc = new AuditedLifecycle({
      store: reAnchorStore,
      audited: true,
      now: CLOCK,
    });
    for (const [from, to] of PATH.slice(0, -1))
      await reAnchorLc.record(from, to);
    const attackerAnchor = (await reAnchorLc.snapshot()).anchor;
    store.write({
      entries: truncated,
      versions: truncatedVersions,
      anchor: attackerAnchor,
    });

    // Internal consistency alone MISSES truncation — the re-minted chain verifies clean…
    expect(await lc2.verify()).toEqual({ valid: true, brokenAt: null });
    // …but the WORM-held anchor's committed length catches the dropped tail.
    const verdict = await lc2.verify(wormAnchor ?? undefined);
    expect(verdict.valid).toBe(false);
  });

  test("wholesale rewrite is caught against the WORM-held anchor", async () => {
    const store = new InMemoryAuditLifecycleStore();
    const lc = new AuditedLifecycle({ store, audited: true, now: CLOCK });
    await recordPath(lc);
    const wormAnchor = (await lc.snapshot()).anchor; // genuine, WORM-held

    // Forge a fresh self-consistent chain of the SAME length over a different legal path.
    const forgedStore = new InMemoryAuditLifecycleStore();
    const forgedLc = new AuditedLifecycle({
      store: forgedStore,
      audited: true,
      now: () => "2099-01-01T00:00:00.000Z",
    });
    await recordPath(forgedLc);
    const forged = await forgedLc.snapshot();
    store.write(forged); // graft the forged chain + its own re-minted anchor over the real store

    const lc2 = new AuditedLifecycle({ store, audited: true, now: CLOCK });
    // The forged chain is internally consistent and verifies against its OWN anchor…
    expect(await lc2.verify()).toEqual({ valid: true, brokenAt: null });
    // …but against the genuine WORM-held anchor the tip-hash mismatch is caught.
    const verdict = await lc2.verify(wormAnchor ?? undefined);
    expect(verdict.valid).toBe(false);
  });
});
