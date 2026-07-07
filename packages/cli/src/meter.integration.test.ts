// Codegen metering — the ADR-0049/0007/0024 binding: a generation debits BEFORE any file is written;
// a 402 aborts with nothing written; a same-key retry debits once. Runs on PGlite inside withTenant
// (SET ROLE app) over the real credits ledger.
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { type TestPg, newTestPg } from "@caisson/testing";
import { InsufficientCreditsError, asCredits } from "@caisson/kernel";
import { withTenant } from "@caisson/tenancy-rls";
import {
  CREDIT_EXPIRY_MIGRATION_SQL,
  CREDIT_ROUNDING_MIGRATION_SQL,
  CREDIT_SCHEMA_SQL,
  GRANT_CONSUMPTION_MIGRATION_SQL,
  balance,
  debit,
  getLedger,
  grant,
} from "@caisson/credits";
import { loadRegistryIndex } from "@caisson/registry-schema";
import { GENERATION_SCHEMA_SQL } from "./generation-record.ts";
import { runGeneration } from "./meter.ts";
import { type FileSetWriter, createFileSetWriter } from "./writer.ts";

const ACCOUNT = "acct_a";

const INDEX = loadRegistryIndex({
  schemaVersion: 1,
  modules: [
    {
      id: "@caisson/field-crypto",
      latest: "0.1.0",
      versions: [
        {
          version: "0.1.0",
          manifest: {
            id: "@caisson/field-crypto",
            version: "0.1.0",
            kind: "primitive",
            editions: [],
            tier: "paid",
            priceCents: 100,
            license: "LicenseRef-Caisson-Commercial",
            dependencies: [],
            entry: "src/index.ts",
            agents: "AGENTS.md",
            golden: null,
            stability: "alpha",
            description: "x",
          },
          publishedAt: "2026-06-27T00:00:00.000Z",
          gateAttestation: "ci@x",
        },
      ],
    },
  ],
});

const SELECTION = {
  projectName: "acme-app",
  modules: [{ id: "@caisson/field-crypto", version: "0.1.0" }],
};

let tp: TestPg;
let tmpBase: string;

beforeEach(async () => {
  if (!tp) tp = await newTestPg();
  await tp.exec(
    `DROP TABLE IF EXISTS grant_consumption; DROP TABLE IF EXISTS credit_expiry_notice; DROP TABLE IF EXISTS credit_event; DROP TABLE IF EXISTS credit_wallet; DROP TABLE IF EXISTS generation;`,
  );
  await tp.exec(CREDIT_SCHEMA_SQL);
  await tp.exec(CREDIT_ROUNDING_MIGRATION_SQL);
  await tp.exec(CREDIT_EXPIRY_MIGRATION_SQL);
  await tp.exec(GRANT_CONSUMPTION_MIGRATION_SQL);
  await tp.exec(GENERATION_SCHEMA_SQL);
  tmpBase = await mkdtemp(join(tmpdir(), "caisson-gen-"));
});

afterEach(async () => {
  await rm(tmpBase, { recursive: true, force: true });
});

afterAll(async () => {
  await tp.close();
});

/** Generation audit rows for an account (superuser read — RLS bypassed, ground truth). */
const genCount = (accountId: string): Promise<number> =>
  tp
    .query<{ n: number }>(
      `SELECT count(*)::int AS n FROM generation WHERE account_id = $1`,
      [accountId],
    )
    .then((rows) => rows[0]?.n ?? 0);

const grantSome = (amount: number) =>
  withTenant(tp.pg, ACCOUNT, (tx) =>
    grant(tx, {
      accountId: ACCOUNT,
      amount: asCredits(amount),
      eventType: "purchase",
      sourceEventId: "buy",
    }),
  );

/** A writer spy that counts calls — proves whether a file write was reached. */
function writerSpy(): { writer: FileSetWriter; calls: number } {
  const state = { calls: 0 } as { calls: number; writer: FileSetWriter };
  state.writer = async () => {
    state.calls++;
  };
  return state;
}

describe("runGeneration — debit-before-spend (ADR-0049)", () => {
  test("debits one credit, THEN writes (success path)", async () => {
    await grantSome(5);
    const spy = writerSpy();
    const outcome = await withTenant(tp.pg, ACCOUNT, (tx) =>
      runGeneration(
        tx,
        { index: INDEX, debit, writeFileSet: spy.writer },
        SELECTION,
        {
          accountId: ACCOUNT,
          idempotencyKey: "gen-1",
        },
      ),
    );
    expect(outcome.balance).toBe(4); // 5 − 1
    expect(outcome.idempotent).toBe(false);
    expect(spy.calls).toBe(1); // write happened, after the debit
    expect(outcome.files.length).toBeGreaterThan(0);
  });

  test("a short balance returns 402 and writes NOTHING", async () => {
    const spy = writerSpy(); // no grant → balance 0
    await expect(
      withTenant(tp.pg, ACCOUNT, (tx) =>
        runGeneration(
          tx,
          { index: INDEX, debit, writeFileSet: spy.writer },
          SELECTION,
          {
            accountId: ACCOUNT,
            idempotencyKey: "gen-x",
          },
        ),
      ),
    ).rejects.toBeInstanceOf(InsufficientCreditsError);
    expect(spy.calls).toBe(0); // the write was never reached — debit precedes spend
    expect(await withTenant(tp.pg, ACCOUNT, (tx) => balance(tx, ACCOUNT))).toBe(
      0,
    );
    expect(
      (await withTenant(tp.pg, ACCOUNT, (tx) => getLedger(tx, ACCOUNT))).length,
    ).toBe(0);
  });

  test("a retried generation with the same idempotencyKey debits once", async () => {
    await grantSome(5);
    const spy = writerSpy();
    const first = await withTenant(tp.pg, ACCOUNT, (tx) =>
      runGeneration(
        tx,
        { index: INDEX, debit, writeFileSet: spy.writer },
        SELECTION,
        {
          accountId: ACCOUNT,
          idempotencyKey: "gen-dup",
        },
      ),
    );
    const retry = await withTenant(tp.pg, ACCOUNT, (tx) =>
      runGeneration(
        tx,
        { index: INDEX, debit, writeFileSet: spy.writer },
        SELECTION,
        {
          accountId: ACCOUNT,
          idempotencyKey: "gen-dup",
        },
      ),
    );
    expect(first.idempotent).toBe(false);
    expect(retry.idempotent).toBe(true);
    expect(await withTenant(tp.pg, ACCOUNT, (tx) => balance(tx, ACCOUNT))).toBe(
      4,
    ); // one debit
    expect(
      (await withTenant(tp.pg, ACCOUNT, (tx) => getLedger(tx, ACCOUNT))).length,
    ).toBe(2); // grant + 1 debit
  });

  test("an unknown module id throws before any debit or write", async () => {
    await grantSome(5);
    const spy = writerSpy();
    await expect(
      withTenant(tp.pg, ACCOUNT, (tx) =>
        runGeneration(
          tx,
          { index: INDEX, debit, writeFileSet: spy.writer },
          {
            projectName: "x",
            modules: [{ id: "@caisson/nope", version: "0.1.0" }],
          },
          { accountId: ACCOUNT, idempotencyKey: "gen-bad" },
        ),
      ),
    ).rejects.toThrow(/unknown module id/);
    expect(spy.calls).toBe(0);
    expect(await withTenant(tp.pg, ACCOUNT, (tx) => balance(tx, ACCOUNT))).toBe(
      5,
    ); // untouched
  });
});

describe("runGeneration — disk materialization + audit row", () => {
  test("the default disk writer materializes to disk and records a generation row", async () => {
    await grantSome(5);
    const target = join(tmpBase, "out"); // omit writeFileSet → default disk writer kicks in
    const outcome = await withTenant(tp.pg, ACCOUNT, (tx) =>
      runGeneration(tx, { index: INDEX, debit, targetDir: target }, SELECTION, {
        accountId: ACCOUNT,
        idempotencyKey: "disk-1",
      }),
    );
    expect(outcome.balance).toBe(4); // 5 − 1
    expect(outcome.files.length).toBeGreaterThan(0);
    expect(existsSync(join(target, "package.json"))).toBe(true); // real bytes on disk
    expect(await genCount(ACCOUNT)).toBe(1); // one audit row, post-debit
  });

  test("a 402 leaves NOTHING on disk AND records no generation row", async () => {
    const target = join(tmpBase, "nope"); // no grant → balance 0 → 402 before any write/record
    await expect(
      withTenant(tp.pg, ACCOUNT, (tx) =>
        runGeneration(
          tx,
          { index: INDEX, debit, targetDir: target },
          SELECTION,
          {
            accountId: ACCOUNT,
            idempotencyKey: "disk-402",
          },
        ),
      ),
    ).rejects.toBeInstanceOf(InsufficientCreditsError);
    expect(existsSync(target)).toBe(false); // the write was never reached
    expect(await genCount(ACCOUNT)).toBe(0); // and neither was the record
  });

  test("a same-key retry debits once, re-materializes, and the generation row stays at one", async () => {
    await grantSome(5);
    const target = join(tmpBase, "retry");
    // overwrite so the second pass re-materializes over the same target dir
    const deps = {
      index: INDEX,
      debit,
      writeFileSet: createFileSetWriter({ overwrite: true }),
      targetDir: target,
    };
    const first = await withTenant(tp.pg, ACCOUNT, (tx) =>
      runGeneration(tx, deps, SELECTION, {
        accountId: ACCOUNT,
        idempotencyKey: "disk-dup",
      }),
    );
    const retry = await withTenant(tp.pg, ACCOUNT, (tx) =>
      runGeneration(tx, deps, SELECTION, {
        accountId: ACCOUNT,
        idempotencyKey: "disk-dup",
      }),
    );
    expect(first.idempotent).toBe(false);
    expect(retry.idempotent).toBe(true);
    expect(existsSync(join(target, "package.json"))).toBe(true); // re-materialized
    expect(await withTenant(tp.pg, ACCOUNT, (tx) => balance(tx, ACCOUNT))).toBe(
      4,
    ); // exactly one debit
    expect(await genCount(ACCOUNT)).toBe(1); // dedup on idempotency key
  });
});

// --- Edition pin resolution (ADR-0077): the generator folds an edition's FROZEN member pins into
// the buyer's deps; a pin that does not resolve in the index fails closed BEFORE the debit. ---
const mkManifest = (
  id: string,
  version: string,
  kind: "primitive" | "edition" | "bundle",
  extra: { editions?: string[]; members?: Record<string, string> } = {},
) => ({
  version,
  manifest: {
    id,
    version,
    kind,
    editions: extra.editions ?? [],
    tier: "paid" as const,
    priceCents: 100,
    license: "LicenseRef-Caisson-Commercial" as const,
    dependencies: [] as string[],
    members: extra.members ?? {},
    entry: "src/index.ts",
    agents: "AGENTS.md",
    golden: null,
    stability: "alpha" as const,
    description: "x",
  },
  publishedAt: "2026-06-27T00:00:00.000Z",
  gateAttestation: "ci@x",
});

/** field-crypto + credits + a `compliance` EDITION whose member pin map names credits@0.2.0. */
const editionIndex = (memberPin: string) =>
  loadRegistryIndex({
    schemaVersion: 1,
    modules: [
      {
        id: "@caisson/field-crypto",
        latest: "0.1.0",
        versions: [mkManifest("@caisson/field-crypto", "0.1.0", "primitive")],
      },
      {
        id: "@caisson/credits",
        latest: "0.2.0",
        versions: [mkManifest("@caisson/credits", "0.2.0", "primitive")],
      },
      {
        id: "@caisson/compliance",
        latest: "0.1.0",
        versions: [
          mkManifest("@caisson/compliance", "0.1.0", "edition", {
            editions: ["compliance"],
            members: { "@caisson/credits": memberPin },
          }),
        ],
      },
    ],
  });

const EDITION_SELECTION = {
  projectName: "acme-edition",
  edition: "compliance" as const,
  modules: [{ id: "@caisson/field-crypto", version: "0.1.0" }],
};

describe("runGeneration — edition pin resolution (ADR-0077)", () => {
  test("an edition folds its frozen member pins into the generated package.json deps", async () => {
    await grantSome(5);
    const spy = writerSpy();
    const outcome = await withTenant(tp.pg, ACCOUNT, (tx) =>
      runGeneration(
        tx,
        { index: editionIndex("0.2.0"), debit, writeFileSet: spy.writer },
        EDITION_SELECTION,
        { accountId: ACCOUNT, idempotencyKey: "ed-1" },
      ),
    );
    const pkg = outcome.files.find((f) => f.path === "package.json");
    expect(pkg).toBeDefined();
    const deps = (
      JSON.parse(pkg?.content ?? "{}") as {
        dependencies?: Record<string, string>;
      }
    ).dependencies;
    // the explicitly-selected module + the edition's pinned member both land, at exact versions
    expect(deps?.["@caisson/field-crypto"]).toBe("0.1.0");
    expect(deps?.["@caisson/credits"]).toBe("0.2.0");
  });

  test("an edition member pin absent from the index throws BEFORE any debit", async () => {
    await grantSome(5);
    const spy = writerSpy();
    await expect(
      withTenant(tp.pg, ACCOUNT, (tx) =>
        runGeneration(
          tx,
          { index: editionIndex("9.9.9"), debit, writeFileSet: spy.writer }, // credits@9.9.9 is not in the index
          EDITION_SELECTION,
          { accountId: ACCOUNT, idempotencyKey: "ed-bad" },
        ),
      ),
    ).rejects.toThrow(/unknown version/);
    expect(spy.calls).toBe(0); // resolution fails closed before the write
    expect(await withTenant(tp.pg, ACCOUNT, (tx) => balance(tx, ACCOUNT))).toBe(
      5,
    ); // never charged
    expect(await genCount(ACCOUNT)).toBe(0);
  });

  // ADR-0257: a first-class `kind:"bundle"` entry resolves the pin map; when a legacy edition
  // meta ALSO matches (its `editions[]` spelling aliases to the same bundle id), the bundle entry
  // is PREFERRED — the same union + preference `expandEntitlements` uses. Guards the seam the
  // six-bundle CLI vocabulary migration exposed: post-rework indexes carry bundle-kind metas the
  // old edition-only scan could never match (a fail-closed throw for every canonical bundle id).
  test("a kind:bundle entry resolves member pins, preferred over a legacy alias meta", async () => {
    await grantSome(5);
    const spy = writerSpy();
    const index = loadRegistryIndex({
      schemaVersion: 1,
      modules: [
        {
          id: "@caisson/field-crypto",
          latest: "0.1.0",
          versions: [mkManifest("@caisson/field-crypto", "0.1.0", "primitive")],
        },
        {
          id: "@caisson/credits",
          latest: "0.2.0",
          versions: [mkManifest("@caisson/credits", "0.2.0", "primitive")],
        },
        // The legacy meta (`editions: ["ai-kit"]` aliases to ai-production) pins credits@9.9.9 —
        // an UNRESOLVABLE pin, so any accidental legacy-first match fails the test loudly.
        {
          id: "@caisson/ai-kit",
          latest: "0.1.0",
          versions: [
            mkManifest("@caisson/ai-kit", "0.1.0", "edition", {
              editions: ["ai-kit"],
              members: { "@caisson/credits": "9.9.9" },
            }),
          ],
        },
        {
          id: "@caisson/ai-production",
          latest: "0.2.0",
          versions: [
            mkManifest("@caisson/ai-production", "0.2.0", "bundle", {
              members: { "@caisson/credits": "0.2.0" },
            }),
          ],
        },
      ],
    });
    const outcome = await withTenant(tp.pg, ACCOUNT, (tx) =>
      runGeneration(
        tx,
        { index, debit, writeFileSet: spy.writer },
        {
          projectName: "acme-bundle",
          edition: "ai-production" as const,
          modules: [{ id: "@caisson/field-crypto", version: "0.1.0" }],
        },
        { accountId: ACCOUNT, idempotencyKey: "bundle-1" },
      ),
    );
    const pkg = outcome.files.find((f) => f.path === "package.json");
    const deps = (
      JSON.parse(pkg?.content ?? "{}") as {
        dependencies?: Record<string, string>;
      }
    ).dependencies;
    expect(deps?.["@caisson/credits"]).toBe("0.2.0"); // the bundle's pin, not the legacy meta's
  });

  test("a legacy edition meta still resolves when no bundle entry exists (pass-2 fallback)", async () => {
    await grantSome(5);
    const spy = writerSpy();
    const index = loadRegistryIndex({
      schemaVersion: 1,
      modules: [
        {
          id: "@caisson/field-crypto",
          latest: "0.1.0",
          versions: [mkManifest("@caisson/field-crypto", "0.1.0", "primitive")],
        },
        {
          id: "@caisson/credits",
          latest: "0.2.0",
          versions: [mkManifest("@caisson/credits", "0.2.0", "primitive")],
        },
        {
          id: "@caisson/ai-kit",
          latest: "0.1.0",
          versions: [
            mkManifest("@caisson/ai-kit", "0.1.0", "edition", {
              editions: ["ai-kit"],
              members: { "@caisson/credits": "0.2.0" },
            }),
          ],
        },
      ],
    });
    const outcome = await withTenant(tp.pg, ACCOUNT, (tx) =>
      runGeneration(
        tx,
        { index, debit, writeFileSet: spy.writer },
        {
          projectName: "acme-legacy",
          edition: "ai-production" as const, // the canonical id a legacy `ai-kit` flag normalizes to
          modules: [{ id: "@caisson/field-crypto", version: "0.1.0" }],
        },
        { accountId: ACCOUNT, idempotencyKey: "legacy-1" },
      ),
    );
    const pkg = outcome.files.find((f) => f.path === "package.json");
    const deps = (
      JSON.parse(pkg?.content ?? "{}") as {
        dependencies?: Record<string, string>;
      }
    ).dependencies;
    expect(deps?.["@caisson/credits"]).toBe("0.2.0");
  });
});

// --- Compose-time migration merge (ADR-0091): the W2b deliverable. When the build-step bundle is
// populated, runGeneration must FOLD a migration-bearing module's assembled migrations into the
// generated file set. This is the seam the layout-mismatch bug silently broke (a misaligned bundle →
// zero migrations → no-op), so it gets an explicit assertion. We stage the bundle in the EXACT layout
// the resolver reads — `<bundleRoot>/<name>/migrations/NNNN_*.sql`, where `bundleRoot` is the same
// `../migrations-bundle` packageDir() resolves via import.meta.url — with one synthetic migration for
// field-crypto (the selected module), then assert the emitted set carries a renumbered
// `migrations/NNNN_*.sql` + the single schema_version ledger. The `migrations/` segment is load-bearing:
// drop it on either side (bundler dest or readPackageMigrations) and this fails. The bundle is the real
// (gitignored) build-artifact dir, so we stage then tear it down. ---
describe("runGeneration — compose-time migration merge (ADR-0091)", () => {
  // Stage the synthetic bundle in a THROWAWAY mkdtemp dir injected via `deps.bundleRoot` — never the
  // real `../migrations-bundle` build artifact (a gitignored Turbo output). Writing into the real
  // bundle in beforeEach + rmSync-ing it in afterEach would corrupt that build output; the injectable
  // root keeps the test hermetic. Mirrors scripts/bundle-migrations.test.ts's mkdtempSync pattern.
  const SEAM_SQL = "CREATE TABLE seam_probe (id integer primary key);\n";
  let migBundle: string;

  beforeEach(() => {
    migBundle = mkdtempSync(join(tmpdir(), "caisson-migbundle-"));
    const fcMigrations = join(migBundle, "field-crypto", "migrations");
    mkdirSync(fcMigrations, { recursive: true });
    writeFileSync(join(fcMigrations, "0001_seam.sql"), SEAM_SQL);
  });
  afterEach(() => {
    rmSync(migBundle, { recursive: true, force: true });
  });

  test("a migration-bearing module's migrations are merged into the generated file set", async () => {
    await grantSome(5);
    const spy = writerSpy();
    const outcome = await withTenant(tp.pg, ACCOUNT, (tx) =>
      runGeneration(
        tx,
        {
          index: INDEX,
          debit,
          writeFileSet: spy.writer,
          bundleRoot: migBundle,
        },
        SELECTION,
        { accountId: ACCOUNT, idempotencyKey: "gen-mig" },
      ),
    );
    const paths = outcome.files.map((f) => f.path);
    // field-crypto contributes one migration → one renumbered NNNN_*.sql + the single ledger.
    expect(paths.some((p) => /^migrations\/\d+_.+\.sql$/.test(p))).toBe(true);
    expect(paths).toContain("migrations/schema_version.json");
    // and the merged migration carries the injected bundle's content (proves the override is read).
    expect(outcome.files.some((f) => f.content.includes("seam_probe"))).toBe(
      true,
    );
  });

  test("with bundleRoot undefined, packageDir resolves the import.meta.url default (the injected temp bundle is never read)", async () => {
    // Regression lock for the default path: omit `bundleRoot` and the merge must resolve the build-time
    // `../migrations-bundle` via import.meta.url — NOT the temp dir staged above. The synthetic
    // seam_probe migration lives only in `migBundle`, so it must not leak into a default generation.
    await grantSome(5);
    const spy = writerSpy();
    const outcome = await withTenant(tp.pg, ACCOUNT, (tx) =>
      runGeneration(
        tx,
        { index: INDEX, debit, writeFileSet: spy.writer },
        SELECTION,
        {
          accountId: ACCOUNT,
          idempotencyKey: "gen-default",
        },
      ),
    );
    expect(outcome.files.some((f) => f.content.includes("seam_probe"))).toBe(
      false,
    );
  });
});
