// Golden parity for the prompt-registry poke's mirror (ADR-0378 lock 2). No __golden__ fixture
// exists for the alias-move mechanic (only render.ts has one, out of this poke's scope), so this
// pins the mirror against the REAL @caisson/prompt-registry functions instead: registerPrompt() /
// setAlias() / getVersion() run DB-bound against PGlite (@caisson/testing, the same harness
// registry.integration.test.ts uses), and the mirror's observable outcomes (which version `prod`
// ends up pointing at, and the fail-closed denial on an unminted version) are asserted identical.
// It also pins the mirrored NotFoundError shape and parsePromptRef against the real @caisson/kernel
// and @caisson/prompt-registry exports. The mirror can never show an alias move the real registry
// would reject, or hide one it would allow.
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
import { newTestPg, type TestPg } from "@caisson/testing";
import {
  NotFoundError as RealNotFoundError,
  currentVersions as kernelCurrentVersions,
  validateVersionSet as kernelValidateVersionSet,
} from "@caisson/kernel";
import { withTenant } from "@caisson/tenancy-rls";
import {
  PROMPT_ALIAS_TABLE,
  PROMPT_REGISTRY_SCHEMA_SQL,
  PROMPT_VERSION_TABLE,
  getAlias as realGetAlias,
  parsePromptRef as realParsePromptRef,
  registerPrompt as realRegisterPrompt,
  setAlias as realSetAlias,
} from "@caisson/prompt-registry";

import {
  aliasVersion,
  currentTipVersion,
  initialState,
  INITIAL_ALIAS_VERSION_ID,
  moveAlias,
  NotFoundError,
  parsePromptRef,
  resolveVersion,
  SAMPLE_NAME,
  SAMPLE_VERSIONS,
  trySetAlias,
  validateVersionSet,
  currentVersions,
  verdictLine,
} from "./prompt-registry-logic.ts";

const ACCT = "acct_prompt_poke";

describe("versioning mirror parity vs the real @caisson/kernel package", () => {
  test("validateVersionSet + currentVersions agree with kernel on the sample lineage", () => {
    expect(validateVersionSet(SAMPLE_VERSIONS)).toEqual(
      kernelValidateVersionSet(SAMPLE_VERSIONS),
    );
    expect(currentVersions(SAMPLE_VERSIONS)).toEqual(
      kernelCurrentVersions(SAMPLE_VERSIONS),
    );
  });

  test("the sample lineage's derived tip is v4, matching kernel's currentVersions", () => {
    const tip = kernelCurrentVersions(SAMPLE_VERSIONS)[0];
    expect(SAMPLE_VERSIONS.find((v) => v.id === tip?.id)?.version).toBe(4);
    expect(currentTipVersion()).toBe(4);
  });

  test("a forked lineage throws in both the mirror and kernel, identically", () => {
    const forked = [
      ...SAMPLE_VERSIONS,
      { id: "pv_2b", supersedesId: "pv_1", version: 2, summary: "fork" },
    ];
    expect(() => validateVersionSet(forked)).toThrow();
    expect(() => kernelValidateVersionSet(forked)).toThrow();
  });
});

describe("NotFoundError mirror parity vs the real kernel error", () => {
  test("code, httpStatus, message, name, and details shape all match", () => {
    const real = new RealNotFoundError("Prompt version not found", {
      name: SAMPLE_NAME,
      version: 9,
    });
    const mirror = new NotFoundError("Prompt version not found", {
      name: SAMPLE_NAME,
      version: 9,
    });
    expect(mirror.code).toBe(real.code);
    expect(mirror.code).toBe("not_found");
    expect(mirror.httpStatus).toBe(real.httpStatus);
    expect(mirror.httpStatus).toBe(404);
    expect(mirror.message).toBe(real.message);
    expect(mirror.name).toBe(real.name);
    expect(mirror.details).toEqual(real.details ?? {});
    expect(mirror instanceof Error).toBe(true);
  });
});

describe("parsePromptRef mirror parity vs the real @caisson/prompt-registry export", () => {
  test.each([
    `${SAMPLE_NAME}`,
    `${SAMPLE_NAME}@prod`,
    `${SAMPLE_NAME}@2`,
    `${SAMPLE_NAME}@canary`,
  ])("matches the real parser on %s", (ref) => {
    expect(parsePromptRef(ref)).toEqual(realParsePromptRef(ref));
  });

  test("both reject a malformed name the same way (throw)", () => {
    expect(() => parsePromptRef("Not-A-Slug@prod")).toThrow();
    expect(() => realParsePromptRef("Not-A-Slug@prod")).toThrow();
  });
});

describe("golden parity: the mirror tracks the REAL DB-bound registerPrompt + setAlias", () => {
  let tp: TestPg;

  beforeAll(async () => {
    tp = await newTestPg();
  });

  afterAll(async () => {
    await tp.close();
  });

  async function freshSchema(): Promise<void> {
    await tp.exec(
      `DROP TABLE IF EXISTS ${PROMPT_ALIAS_TABLE}; DROP TABLE IF EXISTS ${PROMPT_VERSION_TABLE};`,
    );
    await tp.exec(PROMPT_REGISTRY_SCHEMA_SQL);
  }

  beforeEach(freshSchema);

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

  test("promoting prod forward matches the real setAlias + getAlias", async () => {
    await seedLineage();
    const mirrorAfter = moveAlias(initialState(), 4);
    expect(mirrorAfter.moveLog[0]?.ok).toBe(true);
    expect(aliasVersion(mirrorAfter)).toBe(4);

    await withTenant(tp.pg, ACCT, (tx) =>
      realSetAlias(tx, {
        accountId: ACCT,
        name: SAMPLE_NAME,
        alias: "prod",
        version: 4,
      }),
    );
    const real = await withTenant(tp.pg, ACCT, (tx) =>
      realGetAlias(tx, { accountId: ACCT, name: SAMPLE_NAME, alias: "prod" }),
    );
    expect(real.version).toBe(aliasVersion(mirrorAfter));
  });

  test("rolling prod back matches the real setAlias + getAlias", async () => {
    await seedLineage();
    await withTenant(tp.pg, ACCT, (tx) =>
      realSetAlias(tx, {
        accountId: ACCT,
        name: SAMPLE_NAME,
        alias: "prod",
        version: 4,
      }),
    );

    let mirror = moveAlias(initialState(), 4);
    mirror = moveAlias(mirror, 1);
    expect(aliasVersion(mirror)).toBe(1);

    await withTenant(tp.pg, ACCT, (tx) =>
      realSetAlias(tx, {
        accountId: ACCT,
        name: SAMPLE_NAME,
        alias: "prod",
        version: 1,
      }),
    );
    const real = await withTenant(tp.pg, ACCT, (tx) =>
      realGetAlias(tx, { accountId: ACCT, name: SAMPLE_NAME, alias: "prod" }),
    );
    expect(real.version).toBe(1);
    expect(real.version).toBe(aliasVersion(mirror));
  });

  test("promoting to an unminted version 404s identically in the real registry and the mirror, and moves nothing", async () => {
    await seedLineage();
    await withTenant(tp.pg, ACCT, (tx) =>
      realSetAlias(tx, {
        accountId: ACCT,
        name: SAMPLE_NAME,
        alias: "prod",
        version: 2,
      }),
    );

    let realErr: unknown;
    try {
      await withTenant(tp.pg, ACCT, (tx) =>
        realSetAlias(tx, {
          accountId: ACCT,
          name: SAMPLE_NAME,
          alias: "prod",
          version: 9,
        }),
      );
    } catch (e) {
      realErr = e;
    }
    expect(realErr).toBeInstanceOf(RealNotFoundError);
    expect((realErr as InstanceType<typeof RealNotFoundError>).httpStatus).toBe(
      404,
    );

    const mirror = moveAlias(initialState(), 9);
    expect(mirror.moveLog[0]?.ok).toBe(false);
    // The dangling write never happened in the real registry either: `prod` still resolves v2.
    const real = await withTenant(tp.pg, ACCT, (tx) =>
      realGetAlias(tx, { accountId: ACCT, name: SAMPLE_NAME, alias: "prod" }),
    );
    expect(real.version).toBe(2);
    // And the mirror's pointer stayed at its own unchanged starting point too.
    expect(aliasVersion(mirror)).toBe(aliasVersion(initialState()));
  });
});

describe("runnable self-check: append-only move log + verdictLine (no DB)", () => {
  test("the alias starts at v2, mid-lineage, so both promote and rollback are reachable", () => {
    expect(INITIAL_ALIAS_VERSION_ID).toBe("pv_2");
    expect(aliasVersion(initialState())).toBe(2);
  });

  test("resolveVersion is fail-closed for a version never minted", () => {
    expect(() => resolveVersion(9)).toThrow(NotFoundError);
    expect(resolveVersion(3).version).toBe(3);
  });

  test("trySetAlias never writes a dangling target", () => {
    const denied = trySetAlias(9);
    expect(denied.ok).toBe(false);
    expect(denied.versionId).toBeNull();
    expect(denied.error).toBeInstanceOf(NotFoundError);
  });

  test("every move attempt appends to the log, ok or denied, newest first", () => {
    let s = initialState();
    s = moveAlias(s, 4); // ok: promote
    s = moveAlias(s, 9); // denied: never minted
    s = moveAlias(s, 1); // ok: rollback
    expect(s.moveLog.length).toBe(3);
    expect(s.moveLog.map((e) => e.ok)).toEqual([true, false, true]);
    expect(s.moveLog.map((e) => e.seq)).toEqual([2, 1, 0]);
    expect(aliasVersion(s)).toBe(1);
    // No version row ever changes shape across any of this — the sample lineage is a fixed constant.
    expect(SAMPLE_VERSIONS.length).toBe(4);
  });

  test("a denied move leaves the pointer untouched but still logs the attempt", () => {
    const s = moveAlias(initialState(), 9);
    expect(aliasVersion(s)).toBe(aliasVersion(initialState()));
    expect(s.moveLog.length).toBe(1);
    expect(s.moveLog[0]?.ok).toBe(false);
    expect(s.moveLog[0]?.targetVersion).toBe(9);
  });

  test("verdictLine: neutral before any move, ok after a promotion, fail after a denial", () => {
    const start = initialState();
    expect(verdictLine(start).state).toBe("neutral");

    const promoted = moveAlias(start, 4);
    expect(verdictLine(promoted).state).toBe("ok");
    expect(verdictLine(promoted).text).toContain("v4");

    const denied = moveAlias(promoted, 9);
    expect(verdictLine(denied).state).toBe("fail");
    expect(verdictLine(denied).text).toContain("9");
    expect(verdictLine(denied).text).toContain("v4"); // pointer stayed at v4
  });
});
