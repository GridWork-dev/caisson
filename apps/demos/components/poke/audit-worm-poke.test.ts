// The audit-worm poke's checkable claims, now that it drives the REAL packages and the hand-ported
// mirror (audit-worm-logic.ts) is deleted:
//
//   1. The poke's client graph is browser-safe — proven by a STATIC SOURCE-GRAPH WALK, never by a
//      build (a bundler does not fail on a node builtin, it SUBSTITUTES a ~428KB polyfill, exit 0).
//   2. The chain the demo renders is the kernel's own chain: every hash, entry, and anchor is
//      byte-identical to what the node implementation computes for the same payloads, including the
//      shipped golden anchor fixture.
//   3. Every break-it move (tamper, cut the tail) returns the node verifier's exact verdict — the
//      verification algebra exists in exactly one place, the package.
//   4. The WORM retention line is the package's own fail-closed `retainUntilFrom`, reached through
//      audit-worm's internal module rather than a copied floor.
//   5. What is left poke-local is sample data plus presentation: the row labels and the verdict
//      line, which are tested here as the rendering they are.
//
// The walk follows the `bun` (src) condition of each package's exports map; Next resolves
// `exports.default -> dist`. tscn is a per-file emit (no bundling, no re-export rewriting), so the
// dist module graph is the src module graph — CI builds packages before the site consumes them.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { nodeBuiltinTaint } from "@caisson-sh/testing/module-graph";
import { ValidationError } from "@caisson-sh/kernel";
import { anchorChain, buildChainAsync } from "@caisson-sh/kernel/audit-verify";
import {
  anchorChain as nodeAnchorChain,
  buildChain as nodeBuildChain,
  verifyChain as nodeVerifyChain,
  type JsonValue,
} from "@caisson-sh/kernel/node";
import {
  DEFAULT_RETENTION_YEARS,
  MIN_RETENTION_YEARS,
  retainUntilFrom,
} from "../../../../packages/audit-worm/src/retain.ts";
import goldenAnchor from "../../../../packages/audit-worm/src/__golden__/anchor.json";

import {
  APPEND_EVENTS,
  MAX_ENTRIES,
  SEALED_AT,
  SEED_PAYLOADS,
  appendEntry,
  cutTail,
  evaluate,
  eventName,
  formatDate,
  initialState,
  shortHash,
  tamperRow,
  verdictLine,
} from "./audit-worm-poke";

const WORKSPACE_ROOT = join(import.meta.dir, "../../../..");
const POKE_ENTRY = join(import.meta.dir, "audit-worm-poke.tsx");

/** The exact payloads that mint the shipped golden anchor (packages/audit-worm/src/index.test.ts). */
const GOLDEN_PAYLOADS: readonly JsonValue[] = [
  { event: "artifact.locked", artifactId: "policy", version: 1 },
  { event: "artifact.locked", artifactId: "policy", version: 2 },
  { event: "artifact.superseded", artifactId: "policy", supersedes: 1 },
];

describe("the poke's client graph is browser-safe (static source walk, NOT a build)", () => {
  const walk = nodeBuiltinTaint(POKE_ENTRY, { workspaceRoot: WORKSPACE_ROOT });

  test("no module reachable from the client entry imports a node builtin (transitive)", () => {
    expect(walk.offenders).toEqual([]);
  });

  test("no edge was silently skipped — every declined edge would land in `unresolved`", () => {
    expect(walk.unresolved).toEqual([]);
  });

  test("the walk really crossed into both packages, past the first hop", () => {
    // Guard the guard: a walker that resolved nothing would make the zero-offender claim vacuous.
    // audit-verify.ts is the first hop; canonical.ts is only reachable through it, and retain.ts
    // pulls the kernel barrel, so schema.ts is a second hop across a package seam.
    expect(walk.files).toContain("packages/kernel/src/audit-verify.ts");
    expect(walk.files).toContain("packages/kernel/src/canonical.ts");
    expect(walk.files).toContain("packages/audit-worm/src/retain.ts");
    expect(walk.files).toContain("packages/kernel/src/schema.ts");
  });

  test("the node-only halves stay out of the client graph", () => {
    // audit-chain.ts (node:crypto createHash) is what the WebCrypto twins exist to avoid, and
    // audit-worm's own barrel drags the S3/Postgres surface. Neither may be reachable.
    expect(walk.files).not.toContain("packages/kernel/src/audit-chain.ts");
    expect(
      walk.files.some((f) => f === "packages/audit-worm/src/index.ts"),
    ).toBe(false);
    // The erasure claim is checked, not assumed: `RetentionMode` is imported in the STATEMENT-LEVEL
    // `import type` form (a compiler-guaranteed erasure under verbatimModuleSyntax), and the inline
    // `import { type X }` form — which the walker deliberately reports as a value edge — is
    // affirmatively absent.
    const src = readFileSync(POKE_ENTRY, "utf8");
    expect(src).toMatch(
      /^import type \{[^}]*\} from "@caisson-sh\/audit-worm";$/m,
    );
    expect(src).not.toMatch(
      /^import \{[^}]*\btype\b[^}]*\} from "@caisson-sh\/audit-worm";$/m,
    );
  });

  test("the retention floor is reached through the package, by the pinned specifier", () => {
    const src = readFileSync(POKE_ENTRY, "utf8");
    expect(src).toMatch(
      /from "\.\.\/\.\.\/\.\.\/\.\.\/packages\/audit-worm\/src\/retain\.ts"/,
    );
  });

  test("the unwalked external frontier is exactly the known browser-safe set", () => {
    // A third entry appearing here means a new non-workspace dependency joined the client graph —
    // that is a review event, not a silent hole in the proof.
    expect(walk.external).toEqual(["react", "zod"]);
  });

  test("positive control: the same walker reports real builtins on a tainted entry", () => {
    const tainted = nodeBuiltinTaint(
      join(WORKSPACE_ROOT, "packages/kernel/src/node.ts"),
      { workspaceRoot: WORKSPACE_ROOT },
    );
    expect(tainted.offenders.length).toBeGreaterThan(0);
    expect(tainted.offenders.map((o) => o.file)).toContain(
      "packages/kernel/src/audit-chain.ts",
    );
  });
});

describe("the rendered chain is the kernel's own chain, not a look-alike", () => {
  test("the seed chain is byte-identical to what the node implementation builds", async () => {
    const { entries } = await initialState();
    expect(entries).toEqual(nodeBuildChain(SEED_PAYLOADS));
  });

  test("the baked Living Chain genesis hash still comes out of the demo", async () => {
    const { entries } = await initialState();
    expect(entries[0]?.hash).toBe(
      "9a79093302a495ef273674f9feaf0fc0c6f5db8ab5b91a973f5e87519822e085",
    );
  });

  test("the minted anchor equals the node anchor over the same entries", async () => {
    const { entries, anchor } = await initialState();
    expect(anchor).toEqual(nodeAnchorChain(entries));
  });

  test("the WebCrypto path the browser runs reproduces the shipped golden anchor", async () => {
    // The demo's chain algebra is the same code an offline verifier would run against a real
    // exported pack, so it has to land on the fixture the package ships.
    const entries = await buildChainAsync(GOLDEN_PAYLOADS);
    expect(anchorChain(entries)).toEqual({
      length: goldenAnchor.length,
      tipHash: goldenAnchor.tipHash,
      genesisHash: goldenAnchor.genesisHash,
    });
  });

  test("append re-mints the anchor over the grown chain, and stops at the cap", async () => {
    const grown = await appendEntry(await initialState());
    expect(grown.entries.length).toBe(SEED_PAYLOADS.length + 1);
    // The append event is picked by chain length, so a 4-entry seed takes APPEND_EVENTS[1].
    const next = APPEND_EVENTS[
      SEED_PAYLOADS.length % APPEND_EVENTS.length
    ] as JsonValue;
    expect(grown.entries).toEqual(nodeBuildChain([...SEED_PAYLOADS, next]));
    expect(grown.anchor).toEqual(nodeAnchorChain(grown.entries));

    let capped = await initialState();
    for (let i = 0; i < MAX_ENTRIES + 2; i++)
      capped = await appendEntry(capped);
    expect(capped.entries.length).toBe(MAX_ENTRIES);
  });
});

describe("every break-it move returns the node verifier's exact verdict", () => {
  test("a clean chain verifies, with and without the anchor", async () => {
    const s = await initialState();
    const v = await evaluate(s);
    expect(v.internal).toEqual(nodeVerifyChain(s.entries));
    expect(v.anchored).toEqual(nodeVerifyChain(s.entries, s.anchor));
    expect(v.anchored).toEqual({ valid: true, brokenAt: null });
  });

  test("tampering an interior row breaks at that index", async () => {
    const s = tamperRow(await initialState(), 1);
    const v = await evaluate(s);
    expect(v.internal).toEqual(nodeVerifyChain(s.entries));
    expect(v.internal).toEqual({ valid: false, brokenAt: 1 });
  });

  test("cutting the tail passes internal consistency but fails the anchor length oracle", async () => {
    const s = cutTail(await initialState());
    const v = await evaluate(s);
    expect(v.internal).toEqual({ valid: true, brokenAt: null });
    expect(v.anchored).toEqual(nodeVerifyChain(s.entries, s.anchor));
    expect(v.anchored.valid).toBe(false);
    expect(v.lengthMatches).toBe(false);
  });
});

describe("the poke-local presentation reads the verdict honestly", () => {
  test("clean chain: row 0 is the root, the rest verified, verdict ok", async () => {
    const s = await initialState();
    const v = await evaluate(s);
    expect(v.rows[0]).toBe("Chain root");
    expect(v.rows.slice(1)).toEqual(["Verified", "Verified", "Verified"]);
    expect(verdictLine(v, s).state).toBe("ok");
  });

  test("tamper: the broken row and every row after it read Tampered, verdict fail", async () => {
    const s = tamperRow(await initialState(), 1);
    const v = await evaluate(s);
    expect(v.rows).toEqual(["Chain root", "Tampered", "Tampered", "Tampered"]);
    const line = verdictLine(v, s);
    expect(line.state).toBe("fail");
    expect(line.text).toContain("entry 1");
  });

  test("cut tail: no row reads Tampered, and the verdict names the length gap", async () => {
    const s = cutTail(await initialState());
    const v = await evaluate(s);
    expect(v.rows.every((r) => r !== "Tampered")).toBe(true);
    const line = verdictLine(v, s);
    expect(line.state).toBe("fail");
    expect(line.text).toContain(`${s.anchor.length} entries`);
  });

  test("tamper out of range is a no-op, and the tail is never cut past the root", async () => {
    const s = await initialState();
    expect(tamperRow(s, -1)).toBe(s);
    expect(tamperRow(s, s.entries.length)).toBe(s);
    let shrunk = s;
    for (let i = 0; i < s.entries.length + 2; i++) shrunk = cutTail(shrunk);
    expect(shrunk.entries.length).toBe(1);
  });

  test("display helpers", () => {
    expect(shortHash("a".repeat(60) + "bcde")).toBe("aaaaaa…bcde");
    expect(eventName({ event: "license.issued" })).toBe("license.issued");
    expect(eventName([1, 2])).toBe("entry");
    expect(eventName(null)).toBe("entry");
    expect(formatDate(SEALED_AT)).toBe("2026-07-22");
  });
});

describe("the WORM retention line comes from the package's fail-closed floor", () => {
  test("the constants are the package's own, and the label the poke renders is derived from them", () => {
    expect(MIN_RETENTION_YEARS).toBe(6);
    expect(DEFAULT_RETENTION_YEARS).toBe(7);
    const src = readFileSync(POKE_ENTRY, "utf8");
    // The floor is interpolated, never typed as a literal that could drift from retain.ts.
    expect(src).toContain(
      "`${DEFAULT_RETENTION_YEARS}yr term, ${MIN_RETENTION_YEARS}yr floor`",
    );
    expect(src).not.toMatch(/"7yr term, 6yr floor"/);
  });

  test("the rendered retain-until date is the package's calendar-correct computation", () => {
    expect(
      formatDate(retainUntilFrom(SEALED_AT, DEFAULT_RETENTION_YEARS)),
    ).toBe("2033-07-22");
  });

  test("a below-floor term throws the package's typed ValidationError, not a plain Error", () => {
    // A hand-ported mirror could only throw a plain Error here; reaching the real module is what
    // makes the demo's fail-closed claim true.
    expect(() => retainUntilFrom(SEALED_AT, MIN_RETENTION_YEARS - 1)).toThrow(
      ValidationError,
    );
  });
});
