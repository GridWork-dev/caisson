// The prompt-registry poke's checkable claims, now that it drives the REAL @caisson-sh/prompt-registry
// and the hand-ported mirror (prompt-registry-logic.ts) is deleted:
//
//   1. The poke's client graph is browser-safe — proven by a STATIC SOURCE-GRAPH WALK, never by a
//      build (a bundler does not fail on a node builtin, it SUBSTITUTES a ~428KB polyfill, exit 0).
//      The load-bearing exclusion here is not a builtin at all: the package's `.` barrel reaches
//      @caisson-sh/tenancy-rls through schema.ts and puts the `pg` driver on the graph, so the walk
//      asserts the external frontier exactly, not just an empty offender list.
//   2. Every move addresses a real `name@selector` ref parsed by the package's own parsePromptRef —
//      the three addressing kinds are the package's, not restated here.
//   3. The "current tip" is derived by the kernel's own currentVersions, never stored.
//   4. A denied move fails closed with the kernel's REAL NotFoundError (code + 404), and the
//      pointer does not move.
//   5. The sample lineage and the deny path are true to the database-bound registry: the last
//      suite mints the same four versions through the real registerPrompt on PGlite and shows the
//      real setAlias rejecting the same unminted version, leaving `prod` where it was.
//
// The walk follows the `bun` (src) condition of each package's exports map; Next resolves
// `exports.default -> dist`. tscn is a per-file emit (no bundling, no re-export rewriting), so the
// dist module graph is the src module graph — CI builds packages before the site consumes them.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
// PGlite under CI runner load regularly crosses the 5s default; repo-wide standard treatment.
setDefaultTimeout(30_000);
import { nodeBuiltinTaint } from "@caisson-sh/testing/module-graph";
import { newTestPg, type TestPg } from "@caisson-sh/testing";
import { NotFoundError, currentVersions } from "@caisson-sh/kernel";
import { withTenant } from "@caisson-sh/tenancy-rls";
import {
  PROMPT_ALIAS_TABLE,
  PROMPT_REGISTRY_SCHEMA_SQL,
  PROMPT_VERSION_TABLE,
  getAlias as realGetAlias,
  parsePromptRef as realParsePromptRef,
  registerPrompt as realRegisterPrompt,
  setAlias as realSetAlias,
} from "@caisson-sh/prompt-registry";

import {
  INITIAL_ALIAS_VERSION_ID,
  NEVER_MINTED_VERSION,
  SAMPLE_ALIAS,
  SAMPLE_NAME,
  SAMPLE_VERSIONS,
  aliasVersion,
  currentTipVersion,
  initialState,
  moveAlias,
  promptRefFor,
  resolveRef,
  verdictLine,
} from "./prompt-registry-poke";

const WORKSPACE_ROOT = join(import.meta.dir, "../../../..");
const POKE_ENTRY = join(import.meta.dir, "prompt-registry-poke.tsx");
const ACCT = "acct_prompt_poke";

describe("the poke's client graph is browser-safe (static source walk, NOT a build)", () => {
  const walk = nodeBuiltinTaint(POKE_ENTRY, { workspaceRoot: WORKSPACE_ROOT });

  test("no module reachable from the client entry imports a node builtin (transitive)", () => {
    expect(walk.offenders).toEqual([]);
  });

  test("no edge was silently skipped — every declined edge would land in `unresolved`", () => {
    expect(walk.unresolved).toEqual([]);
  });

  test("the unwalked external frontier is exactly the known browser-safe set", () => {
    // `pg` appearing here would mean the database half rejoined the client graph — the exact
    // regression the `./browser` entry exists to prevent, and one no offender list would catch.
    expect(walk.external).toEqual(["react", "zod"]);
  });

  test("the walk really crossed into the packages, past the first hop", () => {
    expect(walk.files).toContain("packages/prompt-registry/src/browser.ts");
    expect(walk.files).toContain("packages/prompt-registry/src/refs.ts");
    // Second hop: refs.ts imports @caisson-sh/kernel, so a resolver that went blind inside a
    // workspace package fails here rather than reporting a vacuously clean graph.
    expect(walk.files).toContain("packages/kernel/src/schema.ts");
  });

  test("the database half stays out of the bundle graph", () => {
    for (const excluded of [
      "packages/prompt-registry/src/registry.ts",
      "packages/prompt-registry/src/schema.ts",
    ]) {
      expect(walk.files).not.toContain(excluded);
    }
    expect(walk.files.some((f) => f.startsWith("packages/tenancy-rls/"))).toBe(
      false,
    );
  });

  test("the poke imports the browser entry, not the barrel", () => {
    const src = readFileSync(POKE_ENTRY, "utf8");
    expect(src).toMatch(
      /^import \{ parsePromptRef \} from "@caisson-sh\/prompt-registry\/browser";$/m,
    );
    expect(src).not.toMatch(/from "@caisson-sh\/prompt-registry";$/m);
  });

  test("positive control: the same walker reports real builtins on a tainted entry", () => {
    const tainted = nodeBuiltinTaint(
      join(WORKSPACE_ROOT, "packages/audit-worm/src/index.ts"),
      { workspaceRoot: WORKSPACE_ROOT },
    );
    expect(tainted.offenders.length).toBeGreaterThan(0);
  });
});

describe("every move addresses a real ref through the package's own parser", () => {
  type PromptRefKind = ReturnType<typeof realParsePromptRef>["kind"];
  const refCases: [string, PromptRefKind][] = [
    [promptRefFor(SAMPLE_ALIAS), "alias"],
    [promptRefFor(2), "version"],
    [promptRefFor(NEVER_MINTED_VERSION), "version"],
    [SAMPLE_NAME, "current"],
  ];

  test.each(refCases)("%s parses as a %s reference", (ref, kind) => {
    expect(realParsePromptRef(ref).kind).toBe(kind);
    expect(realParsePromptRef(ref).name).toBe(SAMPLE_NAME);
  });

  test("resolveRef routes all three kinds off the real parse", () => {
    const state = initialState();
    expect(resolveRef(state, SAMPLE_NAME).version).toBe(currentTipVersion());
    expect(resolveRef(state, promptRefFor(3)).version).toBe(3);
    expect(resolveRef(state, promptRefFor(SAMPLE_ALIAS)).version).toBe(
      aliasVersion(state),
    );
  });

  test("a malformed name is rejected by the package's slug bound, not by the poke", () => {
    expect(() => resolveRef(initialState(), "Not-A-Slug@prod")).toThrow();
  });
});

describe("the tip is derived by the kernel, not stored", () => {
  test("currentTipVersion equals the row kernel currentVersions names as the tip", () => {
    const tip = currentVersions(SAMPLE_VERSIONS)[0];
    expect(SAMPLE_VERSIONS.find((v) => v.id === tip?.id)?.version).toBe(
      currentTipVersion(),
    );
    expect(currentTipVersion()).toBe(4);
  });
});

describe("the deny path fails closed with the kernel's real error", () => {
  test("resolveRef throws the real NotFoundError, code and 404 intact", () => {
    let err: unknown;
    try {
      resolveRef(initialState(), promptRefFor(NEVER_MINTED_VERSION));
    } catch (e) {
      err = e;
    }
    if (!(err instanceof NotFoundError)) {
      throw new Error("expected a NotFoundError rejection");
    }
    expect(err.code).toBe("not_found");
    expect(err.httpStatus).toBe(404);
  });

  test("an unknown alias is a 404 too — the pointer is not a wildcard", () => {
    expect(() => resolveRef(initialState(), promptRefFor("canary"))).toThrow(
      NotFoundError,
    );
  });

  test.each(["other-prompt", "other-prompt@prod", "other-prompt@3"])(
    "an unknown prompt name is a 404 for every selector kind: %s",
    (ref) => {
      expect(() => resolveRef(initialState(), ref)).toThrow(NotFoundError);
    },
  );

  test("a denied move leaves the pointer untouched but still logs the attempt", () => {
    const s = moveAlias(initialState(), NEVER_MINTED_VERSION);
    expect(aliasVersion(s)).toBe(aliasVersion(initialState()));
    expect(s.moveLog.length).toBe(1);
    expect(s.moveLog[0]?.ok).toBe(false);
    expect(s.moveLog[0]?.ref).toBe(promptRefFor(NEVER_MINTED_VERSION));
  });
});

describe("the move log is append-only and the verdict is computed", () => {
  test("the alias starts at v2, mid-lineage, so both promote and rollback are reachable", () => {
    expect(INITIAL_ALIAS_VERSION_ID).toBe("pv_2");
    expect(aliasVersion(initialState())).toBe(2);
  });

  test("every move attempt appends, ok or denied, newest first", () => {
    let s = initialState();
    s = moveAlias(s, 4); // ok: promote
    s = moveAlias(s, NEVER_MINTED_VERSION); // denied: never minted
    s = moveAlias(s, 1); // ok: rollback
    expect(s.moveLog.length).toBe(3);
    expect(s.moveLog.map((e) => e.ok)).toEqual([true, false, true]);
    expect(s.moveLog.map((e) => e.seq)).toEqual([2, 1, 0]);
    expect(aliasVersion(s)).toBe(1);
    // No version row ever changes shape across any of this — the lineage is a fixed constant.
    expect(SAMPLE_VERSIONS.length).toBe(4);
  });

  test("verdictLine: neutral before any move, ok after a promotion, fail after a denial", () => {
    const start = initialState();
    expect(verdictLine(start).state).toBe("neutral");

    const promoted = moveAlias(start, 4);
    expect(verdictLine(promoted).state).toBe("ok");
    expect(verdictLine(promoted).text).toContain("v4");

    const denied = moveAlias(promoted, NEVER_MINTED_VERSION);
    expect(verdictLine(denied).state).toBe("fail");
    expect(verdictLine(denied).text).toContain(String(NEVER_MINTED_VERSION));
    expect(verdictLine(denied).text).toContain("v4"); // pointer stayed at v4
  });
});

describe("the sample lineage and the deny path are true to the database-bound registry", () => {
  let tp: TestPg;

  beforeAll(async () => {
    tp = await newTestPg();
  });

  afterAll(async () => {
    await tp.close();
  });

  beforeEach(async () => {
    await tp.exec(
      `DROP TABLE IF EXISTS ${PROMPT_ALIAS_TABLE}; DROP TABLE IF EXISTS ${PROMPT_VERSION_TABLE};`,
    );
    await tp.exec(PROMPT_REGISTRY_SCHEMA_SQL);
  });

  /** Mint the exact 4-version lineage SAMPLE_VERSIONS models, in order (v1 root -> v4 tip). */
  async function seedLineage(): Promise<void> {
    for (const row of SAMPLE_VERSIONS) {
      const minted = await withTenant(tp.pg, ACCT, (tx) =>
        realRegisterPrompt(tx, {
          accountId: ACCT,
          name: SAMPLE_NAME,
          messages: [{ role: "system", content: row.summary }],
          varSpec: {},
        }),
      );
      expect(minted.version).toBe(row.version);
    }
  }

  test("registerPrompt mints exactly the sample version numbers, tip last", async () => {
    await seedLineage();
    expect(currentTipVersion()).toBe(SAMPLE_VERSIONS.length);
  });

  test("promoting matches: the real setAlias lands prod where the poke's pointer lands", async () => {
    await seedLineage();
    const moved = moveAlias(initialState(), 4);
    expect(aliasVersion(moved)).toBe(4);

    await withTenant(tp.pg, ACCT, (tx) =>
      realSetAlias(tx, {
        accountId: ACCT,
        name: SAMPLE_NAME,
        alias: SAMPLE_ALIAS,
        version: 4,
      }),
    );
    const real = await withTenant(tp.pg, ACCT, (tx) =>
      realGetAlias(tx, {
        accountId: ACCT,
        name: SAMPLE_NAME,
        alias: SAMPLE_ALIAS,
      }),
    );
    expect(real.version).toBe(aliasVersion(moved));
  });

  test("the real setAlias rejects the same unminted version and moves nothing", async () => {
    await seedLineage();
    await withTenant(tp.pg, ACCT, (tx) =>
      realSetAlias(tx, {
        accountId: ACCT,
        name: SAMPLE_NAME,
        alias: SAMPLE_ALIAS,
        version: aliasVersion(initialState()),
      }),
    );

    let realErr: unknown;
    try {
      await withTenant(tp.pg, ACCT, (tx) =>
        realSetAlias(tx, {
          accountId: ACCT,
          name: SAMPLE_NAME,
          alias: SAMPLE_ALIAS,
          version: NEVER_MINTED_VERSION,
        }),
      );
    } catch (e) {
      realErr = e;
    }
    expect(realErr).toBeInstanceOf(NotFoundError);

    // The dangling write never happened server-side either: `prod` still resolves its start row.
    const real = await withTenant(tp.pg, ACCT, (tx) =>
      realGetAlias(tx, {
        accountId: ACCT,
        name: SAMPLE_NAME,
        alias: SAMPLE_ALIAS,
      }),
    );
    expect(real.version).toBe(aliasVersion(initialState()));
    expect(aliasVersion(moveAlias(initialState(), NEVER_MINTED_VERSION))).toBe(
      aliasVersion(initialState()),
    );
  });
});
