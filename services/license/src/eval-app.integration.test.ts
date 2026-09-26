// Evaluation-access end to end (ADR-0274 §2 / ADR-0280) over PGlite + real admin_write role:
// the eval store's fail-closed lifecycle (create → review/approve → card → issue → revoke/expire),
// the anti-abuse invariants (one active eval per domain, global cap, card-fingerprint reuse), and
// the HTTP routes (/eval/apply scoring → persist, /eval/issue time-boxed fail-closed issuance). The
// issued token is verified through the explicit-key seam against a DEV keypair (the shipped verifier
// bakes the prod key, whose private half is not in the repo) — proving the eval license fail-closes
// at its short signed expiry.
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
// PGlite bootstrap can exceed the 5s default under CI runner load (matches the sibling suites).
setDefaultTimeout(30_000);
import {
  type KeyObject,
  createHash,
  createPrivateKey,
  createPublicKey,
} from "node:crypto";
import { Ed25519Signer } from "@caisson/license-issue";
import { verifyLicenseWithKey } from "@caisson/license-verify";
import { loadOriginGateConfig } from "@caisson/kernel/node";
import {
  ADMIN_WRITE_ROLE_BOOTSTRAP_SQL,
  withAdminWrite,
} from "@caisson/org-controls";
import {
  type RegistryIndex,
  loadRegistryIndex,
} from "@caisson/registry-schema";
import type { Transactor } from "@caisson/tenancy-rls";
import { type TestPg, newTestPg } from "@caisson/testing";
import { createApp as createIssueApp } from "./app.ts";
import type { RateLimiterInfraAlert } from "./alerting.ts";
import {
  EVAL_APPLICATION_SCHEMA_SQL,
  createEvalApplication,
  decideEvalReview,
  expireEvals,
  findActiveEvalsByCardFingerprint,
  markEvalCardValidated,
  readEvalApplication,
  recordIssuedEval,
  revokeEval,
} from "./eval-store.ts";
import type { EvalConfig } from "./eval-verification.ts";
import { LICENSE_REVOCATION_SCHEMA_SQL } from "./license-revocation-store.ts";
import {
  loadRateLimitConfig,
  type RateLimiter,
  TokenBucketLimiter,
} from "./rate-limit.ts";

const TEST_ORIGIN_GATE = loadOriginGateConfig({
  NODE_ENV: "test",
  ORIGIN_SECRET_MODE: "disabled",
});
const createApp = (
  deps: Parameters<typeof createIssueApp>[0],
): ReturnType<typeof createIssueApp> =>
  createIssueApp({ ...deps, originGate: TEST_ORIGIN_GATE });

const TOKEN = "test-license-issue-token-0123456789";
const DEV_SEED = createHash("sha256")
  .update("caisson-license-verify-KAT-seed-v1")
  .digest();
const devPrivate: KeyObject = createPrivateKey({
  key: Buffer.concat([
    Buffer.from("302e020100300506032b657004220420", "hex"),
    DEV_SEED,
  ]),
  format: "der",
  type: "pkcs8",
});
const DEV_PUB: KeyObject = createPublicKey(
  devPrivate.export({ format: "pem", type: "pkcs8" }),
);
const signer = new Ed25519Signer("dev", devPrivate);

const index: RegistryIndex = loadRegistryIndex({
  schemaVersion: 1,
  modules: [
    {
      id: "@caisson/compliance",
      latest: "1.0.0",
      versions: [
        {
          version: "1.0.0",
          publishedAt: "2026-01-01T00:00:00.000Z",
          gateAttestation: "ci-run-1@deadbeef",
          manifest: {
            id: "@caisson/compliance",
            version: "1.0.0",
            kind: "base",
            tier: "paid",
            license: "LicenseRef-Caisson-Commercial",
            priceCents: 4900,
            editions: [],
            description: "compliance",
          },
        },
      ],
    },
  ],
});

// A high shared cap so the many active rows the suite leaves in the shared DB never trip it; the cap
// mechanism itself is tested with a tight per-call config below (pollution-robust).
const CONFIG: EvalConfig = {
  windowDays: 14,
  applicationTtlDays: 7,
  globalActiveCap: 1000,
  domainMinAgeDays: 90,
  autoApproveMaxRisk: 25,
  autoRejectMinRisk: 70,
};

/** The live count of active (domain-slot-holding) eval rows in the shared DB. */
async function activeCount(): Promise<number> {
  const rows = await tp.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM eval_application WHERE status IN ('pending_review','approved','issued')`,
  );
  return Number(rows[0]?.n ?? "0");
}

const EVAL_SCOPE = ["@caisson/compliance"];

let tp: TestPg;
let db: Transactor;
let app: (req: Request) => Promise<Response>;
// A stubbed signal resolver — clearly-good signals so /eval/apply auto-approves (network isolated).
const goodSignals = async () => ({
  mx: true as const,
  ageDays: 3650,
  enrichmentRisk: 5,
});

beforeAll(async () => {
  tp = await newTestPg();
  db = tp.pg as unknown as Transactor;
  await tp.exec(ADMIN_WRITE_ROLE_BOOTSTRAP_SQL);
  await tp.exec(`DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'admin') THEN CREATE ROLE admin NOLOGIN; END IF;
  END $$;`);
  await tp.exec(EVAL_APPLICATION_SCHEMA_SQL);
  await tp.exec(LICENSE_REVOCATION_SCHEMA_SQL);
  app = createApp({
    token: TOKEN,
    signer,
    index,
    db,
    provider: null,
    limiter: new TokenBucketLimiter(loadRateLimitConfig()),
    discordNotify: null,
    posthogCapture: null,
    purchaseEmailNotify: async () => {},
    renewalEmailNotify: async () => {},
    revokeEmailNotify: async () => {},
    chargebackAlert: async () => {},
    rateLimiterAlert: async () => {},
    eval: { config: CONFIG, resolveSignals: goodSignals },
  });
});
afterAll(async () => {
  await tp.close();
});

// A unique domain per test so the partial-unique-index does not cross-contaminate the shared DB.
let seq = 0;
const freshDomain = () => `acme-${seq++}.io`;

async function create(
  status: "pending_review" | "approved" | "rejected",
  domain: string,
  account = "acct-1",
) {
  return withAdminWrite(db, (tx) =>
    createEvalApplication(
      tx,
      {
        accountId: account,
        email: `dev@${domain}`,
        domain,
        entitlements: EVAL_SCOPE,
        status,
        risk: 10,
        reason: "test",
      },
      CONFIG,
    ),
  );
}

describe("eval store — create + anti-abuse", () => {
  test("one active eval per domain (partial unique index) → domain-active conflict", async () => {
    const d = freshDomain();
    await create("approved", d);
    await expect(create("approved", d)).rejects.toThrow("domain-active");
  });

  test("a rejected application never holds the domain slot", async () => {
    const d = freshDomain();
    await create("rejected", d);
    // A rejected row does not occupy the active-domain index, so an approval can still land.
    const approved = await create("approved", d);
    expect(approved.status).toBe("approved");
  });

  test("global active cap is enforced for active applications, not rejected", async () => {
    // Tight cap = whatever is active right now, so the next ACTIVE create is already over the cap
    // (robust to whatever earlier tests left in the shared DB). A rejected create never counts.
    const tight: EvalConfig = {
      ...CONFIG,
      globalActiveCap: await activeCount(),
    };
    const overCap = withAdminWrite(db, (tx) =>
      createEvalApplication(
        tx,
        {
          accountId: "acct-cap",
          email: `dev@${freshDomain()}`,
          domain: freshDomain(),
          entitlements: EVAL_SCOPE,
          status: "approved",
          risk: 10,
          reason: "test",
        },
        tight,
      ),
    );
    await expect(overCap).rejects.toThrow("global-cap");
    // A rejected application still lands (the cap does not apply to it).
    const rejected = await create("rejected", freshDomain());
    expect(rejected.status).toBe("rejected");
  });
});

describe("eval store — review + card + issue fail-closed lifecycle", () => {
  test("decideEvalReview only moves a pending_review row", async () => {
    const d = freshDomain();
    const pending = await create("pending_review", d);
    const approved = await withAdminWrite(db, (tx) =>
      decideEvalReview(tx, pending.id, "approved"),
    );
    expect(approved.status).toBe("approved");
    // Re-deciding an already-approved row fails closed.
    await expect(
      withAdminWrite(db, (tx) => decideEvalReview(tx, pending.id, "rejected")),
    ).rejects.toThrow();
  });

  test("recordIssuedEval is refused until the card leg is validated", async () => {
    const approved = await create("approved", freshDomain());
    // Approved but card NOT validated → not issuable.
    await expect(
      withAdminWrite(db, (tx) =>
        recordIssuedEval(tx, {
          evalId: approved.id,
          licenseId: "lic-x",
          licenseToken: "TОKEN",
          windowEnd: new Date().toISOString(),
        }),
      ),
    ).rejects.toThrow();
    // Validate the card, then it transitions to issued.
    await withAdminWrite(db, (tx) =>
      markEvalCardValidated(tx, approved.id, "card-fp-1"),
    );
    const issued = await withAdminWrite(db, (tx) =>
      recordIssuedEval(tx, {
        evalId: approved.id,
        licenseId: "lic-x",
        licenseToken: "TOKEN-x",
        windowEnd: "2099-01-01T00:00:00.000Z",
      }),
    );
    expect(issued.status).toBe("issued");
  });

  test("markEvalCardValidated is refused on a non-approved row", async () => {
    const pending = await create("pending_review", freshDomain());
    await expect(
      withAdminWrite(db, (tx) => markEvalCardValidated(tx, pending.id, "fp")),
    ).rejects.toThrow();
  });

  test("card-fingerprint reuse across applicants is surfaced", async () => {
    const a = await create("approved", freshDomain(), "acct-A");
    const b = await create("approved", freshDomain(), "acct-B");
    await withAdminWrite(db, (tx) =>
      markEvalCardValidated(tx, a.id, "shared-fp"),
    );
    await withAdminWrite(db, (tx) =>
      markEvalCardValidated(tx, b.id, "shared-fp"),
    );
    const reuse = await withAdminWrite(db, (tx) =>
      findActiveEvalsByCardFingerprint(tx, "shared-fp", a.id),
    );
    expect(reuse.map((r) => r.id)).toContain(b.id);
    expect(reuse.map((r) => r.id)).not.toContain(a.id);
  });
});

describe("eval store — revoke + expire", () => {
  test("revoke writes the edge deny-set for an issued eval", async () => {
    const approved = await create("approved", freshDomain());
    await withAdminWrite(db, (tx) =>
      markEvalCardValidated(tx, approved.id, "fp-rev"),
    );
    await withAdminWrite(db, (tx) =>
      recordIssuedEval(tx, {
        evalId: approved.id,
        licenseId: "lic-revoke-me",
        licenseToken: "TOKEN-rev",
        windowEnd: "2099-01-01T00:00:00.000Z",
      }),
    );
    const revoked = await withAdminWrite(db, (tx) =>
      revokeEval(tx, approved.id),
    );
    expect(revoked).toBe(true);
    const deny = await tp.query<{ license_id: string }>(
      `SELECT license_id FROM license_revocation WHERE license_id = $1`,
      ["lic-revoke-me"],
    );
    expect(deny.length).toBe(1);
    // Revoking a terminal row is a no-op (idempotent).
    expect(await withAdminWrite(db, (tx) => revokeEval(tx, approved.id))).toBe(
      false,
    );
  });

  test("expireEvals flips an elapsed issued window + a stale application", async () => {
    // An issued eval whose window is already in the past.
    const approved = await create("approved", freshDomain());
    await withAdminWrite(db, (tx) =>
      markEvalCardValidated(tx, approved.id, "fp-exp"),
    );
    await withAdminWrite(db, (tx) =>
      recordIssuedEval(tx, {
        evalId: approved.id,
        licenseId: "lic-expire",
        licenseToken: "TOKEN-exp",
        windowEnd: "2020-01-01T00:00:00.000Z",
      }),
    );
    const n = await withAdminWrite(db, (tx) =>
      expireEvals(tx, CONFIG, new Date()),
    );
    expect(n).toBeGreaterThanOrEqual(1);
    const row = await withAdminWrite(db, (tx) =>
      readEvalApplication(tx, approved.id),
    );
    expect(row?.status).toBe("expired");
  });
});

const applyReq = (body: unknown, auth = TOKEN) =>
  new Request("http://license.test/eval/apply", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${auth}`,
    },
    body: JSON.stringify(body),
  });
const issueReq = (body: unknown, auth = TOKEN) =>
  new Request("http://license.test/eval/issue", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${auth}`,
    },
    body: JSON.stringify(body),
  });

describe("HTTP /eval/apply + /eval/issue", () => {
  for (const pathname of ["/eval/apply", "/eval/issue"] as const) {
    for (const stage of ["check", "checkGlobal"] as const) {
      test(`${pathname} fails closed with 503 and alerts when limiter ${stage} throws`, async () => {
        const alerts: RateLimiterInfraAlert[] = [];
        const limiter: RateLimiter = {
          check: () => {
            if (stage === "check") throw new Error("limiter unavailable");
            return { allowed: true, retryAfterSec: 0 };
          },
          checkGlobal: () => {
            if (stage === "checkGlobal") throw new Error("limiter unavailable");
            return { allowed: true, retryAfterSec: 0 };
          },
        };
        const limitedApp = createApp({
          token: TOKEN,
          signer,
          index,
          db,
          provider: null,
          limiter,
          discordNotify: null,
          posthogCapture: null,
          purchaseEmailNotify: async () => {},
          renewalEmailNotify: async () => {},
          revokeEmailNotify: async () => {},
          chargebackAlert: async () => {},
          rateLimiterAlert: async (alert) => {
            alerts.push(alert);
          },
          eval: { config: CONFIG, resolveSignals: goodSignals },
        });

        const response = await limitedApp(
          new Request(`http://license.test${pathname}`, { method: "POST" }),
        );

        expect(response.status).toBe(503);
        expect(await response.json()).toEqual({
          error: "rate limiter unavailable",
        });
        expect(alerts).toEqual([{ bucket: "issue", failureMode: "closed" }]);
      });
    }
  }

  test("apply auto-approves a good work domain; a free-mail domain auto-rejects", async () => {
    const d = freshDomain();
    const ok = await app(
      applyReq({
        accountId: "acct-http",
        email: `dev@${d}`,
        entitlements: EVAL_SCOPE,
      }),
    );
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as {
      decision: string;
      status: string;
      evalId: string;
    };
    expect(body.decision).toBe("auto_approve");
    expect(body.status).toBe("approved");

    const free = await app(
      applyReq({
        accountId: "acct-http",
        email: "dev@gmail.com",
        entitlements: EVAL_SCOPE,
      }),
    );
    const freeBody = (await free.json()) as { decision: string };
    expect(freeBody.decision).toBe("auto_reject");
  });

  test("apply rejects an unauthorized caller (401) and a bad body (400)", async () => {
    expect(
      (
        await app(
          applyReq(
            {
              accountId: "x",
              email: `dev@${freshDomain()}`,
              entitlements: EVAL_SCOPE,
            },
            "wrong",
          ),
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await app(
          applyReq({
            accountId: "x",
            email: "not-an-email",
            entitlements: EVAL_SCOPE,
          }),
        )
      ).status,
    ).toBe(400);
  });

  test("apply is idempotent-safe on an active domain (409, not a duplicate)", async () => {
    const d = freshDomain();
    expect(
      (
        await app(
          applyReq({
            accountId: "a",
            email: `dev@${d}`,
            entitlements: EVAL_SCOPE,
          }),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await app(
          applyReq({
            accountId: "a",
            email: `dev@${d}`,
            entitlements: EVAL_SCOPE,
          }),
        )
      ).status,
    ).toBe(409);
  });

  test("issue is fail-closed until card-validated, then mints a time-boxed pro token", async () => {
    const d = freshDomain();
    const applied = await app(
      applyReq({
        accountId: "acct-issue",
        email: `dev@${d}`,
        entitlements: EVAL_SCOPE,
      }),
    );
    const { evalId } = (await applied.json()) as { evalId: string };

    // Approved but card not validated → not issuable.
    expect((await app(issueReq({ evalId, major: 1 }))).status).toBe(409);

    // Validate the card leg (the Paddle callback's store primitive), then issue.
    await withAdminWrite(db, (tx) =>
      markEvalCardValidated(tx, evalId, "fp-issue"),
    );
    const issued = await app(issueReq({ evalId, major: 1 }));
    expect(issued.status).toBe(200);
    const { token, expiry } = (await issued.json()) as {
      token: string;
      expiry: string;
    };
    expect(typeof token).toBe("string");

    // The token verifies as a valid pro eval BEFORE its window end, and fails safe to community AFTER.
    const before = new Date(Date.parse(expiry) - 1000);
    const after = new Date(Date.parse(expiry) + 1000);
    const okVerify = verifyLicenseWithKey(token, DEV_PUB, before);
    expect(okVerify.valid).toBe(true);
    expect(okVerify.tier).toBe("pro");
    expect(okVerify.entitlements).toContain("@caisson/compliance");
    // F1: the eval discriminator round-trips end to end — /eval/issue is the ONLY signer of this
    // claim, and the verifier surfaces it so downstream (watermarking, no-redistribution) can key
    // on a real signed flag instead of inferring "is this eval" from the short expiry alone.
    expect(okVerify.eval).toBe(true);
    expect(okVerify.claims?.eval).toBe(true);
    expect(verifyLicenseWithKey(token, DEV_PUB, after).valid).toBe(false);

    // Idempotent re-serve: a second issue returns the byte-identical stored token.
    const again = await app(issueReq({ evalId, major: 1 }));
    const { token: token2 } = (await again.json()) as { token: string };
    expect(token2).toBe(token);
  });

  test("issue 404s an unknown eval id", async () => {
    const res = await app(
      issueReq({ evalId: "00000000-0000-4000-8000-000000000000", major: 1 }),
    );
    expect(res.status).toBe(404);
  });

  // F2 — the scope ceiling is enforced at the HTTP boundary, before any signal lookup or store
  // write (a 400, and no row is created — a repeat of the same request never trips the domain
  // uniqueness conflict, proving nothing was persisted).
  test('apply rejects "everything" as an eval scope (400, no row created)', async () => {
    const d = freshDomain();
    const res = await app(
      applyReq({
        accountId: "acct-scope",
        email: `dev@${d}`,
        entitlements: ["everything"],
      }),
    );
    expect(res.status).toBe(400);
    // No row was created for this domain — a second identical request also 400s, never 409.
    const again = await app(
      applyReq({
        accountId: "acct-scope",
        email: `dev@${d}`,
        entitlements: ["everything"],
      }),
    );
    expect(again.status).toBe(400);
  });

  test("apply rejects more than one bundle id as an eval scope (400)", async () => {
    const res = await app(
      applyReq({
        accountId: "acct-scope",
        email: `dev@${freshDomain()}`,
        entitlements: ["compliance", "ai-production"],
      }),
    );
    expect(res.status).toBe(400);
  });

  test("apply rejects a bundle mixed with a module id (400)", async () => {
    const res = await app(
      applyReq({
        accountId: "acct-scope",
        email: `dev@${freshDomain()}`,
        entitlements: ["compliance", "@caisson/compliance"],
      }),
    );
    expect(res.status).toBe(400);
  });

  test("apply accepts a single bundle id as an eval scope (200)", async () => {
    const res = await app(
      applyReq({
        accountId: "acct-scope",
        email: `dev@${freshDomain()}`,
        entitlements: ["compliance"],
      }),
    );
    expect(res.status).toBe(200);
  });

  // F3 — subdomain variants of the SAME registrable domain collide on one active-eval slot; a
  // request under the bare registrable domain is indistinguishable from one under a subdomain.
  test("F3: a.sub and b.sub of the same registrable domain collide (one active eval per org)", async () => {
    const rand = Math.random().toString(36).slice(2, 10);
    const org = `${rand}-org.io`;
    const first = await app(
      applyReq({
        accountId: "acct-sub-a",
        email: `dev@a.${org}`,
        entitlements: EVAL_SCOPE,
      }),
    );
    expect(first.status).toBe(200);
    const second = await app(
      applyReq({
        accountId: "acct-sub-b",
        email: `dev@b.${org}`,
        entitlements: EVAL_SCOPE,
      }),
    );
    expect(second.status).toBe(409);
  });
});

describe("HTTP /eval/* is 404 when the eval surface is not wired", () => {
  test("a deploy without eval deps does not serve the routes", async () => {
    const bare = createApp({
      token: TOKEN,
      signer,
      index,
      db,
      provider: null,
      limiter: new TokenBucketLimiter(loadRateLimitConfig()),
      discordNotify: null,
      posthogCapture: null,
      purchaseEmailNotify: async () => {},
      renewalEmailNotify: async () => {},
      revokeEmailNotify: async () => {},
      chargebackAlert: async () => {},
      rateLimiterAlert: async () => {},
      // eval omitted → null
    });
    expect(
      (
        await bare(
          applyReq({
            accountId: "x",
            email: "dev@acme.io",
            entitlements: EVAL_SCOPE,
          }),
        )
      ).status,
    ).toBe(404);
  });
});
