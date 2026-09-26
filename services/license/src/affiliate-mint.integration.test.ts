// ADR-0315/0320 — the affiliate mint orchestrator (mintAffiliateCodeAdmin), end to end on PGlite.
// The external Paddle createDiscount is faked (the real one holds PADDLE_API_KEY on the license
// service, injected as deps.mintDiscount); this exercises the admin_write registration + the
// queryable admin_action_log row + the WORM-status contract that the proxy split hangs on.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ADMIN_WRITE_ROLE_BOOTSTRAP_SQL } from "@caisson/org-controls";
import type { RegistryIndex } from "@caisson/registry-schema";
import type { Transactor } from "@caisson/tenancy-rls";
import { type TestPg, newTestPg } from "@caisson/testing";
import {
  ADMIN_ACTION_LOG_ACTION_MIGRATION_SQL,
  ADMIN_ACTION_LOG_SCHEMA_SQL,
} from "./admin-audit-log.ts";
import {
  mintAffiliateCodeAdmin,
  type AdminMutationDeps,
} from "./admin-mutations.ts";
import { AFFILIATE_CODE_SCHEMA_SQL } from "./affiliate-store.ts";

let tp: TestPg;
let db: Transactor;

// The stub external mint — records the last input, returns a fixed `dsc_…` + the code Paddle echoes.
let lastMintInput: { code: string; description: string } | null = null;
const okMint: NonNullable<AdminMutationDeps["mintDiscount"]> = async (
  input,
) => {
  lastMintInput = input;
  // Unique per code (Paddle mints a fresh dsc_ per discount) so two mints never collide on UNIQUE.
  return { discountId: `dsc_${input.code.toLowerCase()}`, code: input.code };
};

/** Minimal deps: only db + mintDiscount + worm are read by the mint; index/issue are unused stubs. */
function deps(overrides: Partial<AdminMutationDeps> = {}): AdminMutationDeps {
  return {
    db,
    index: {} as unknown as RegistryIndex,
    issue: async () => ({ token: "", licenseId: "" }),
    worm: {
      append: async () => {
        /* ok */
      },
    } as unknown as AdminMutationDeps["worm"],
    mintDiscount: okMint,
    ...overrides,
  };
}

async function ground<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  return tp.query<T>(sql, params);
}

/** Read `lastMintInput` through a call so a preceding `lastMintInput = null` reset doesn't pin the
 *  read to TS's flow-narrowed `null` (the stub mutates it out of band). */
function seenMintInput(): { code: string; description: string } | null {
  return lastMintInput;
}

beforeAll(async () => {
  tp = await newTestPg();
  db = tp.pg as unknown as Transactor;
  await tp.exec(ADMIN_WRITE_ROLE_BOOTSTRAP_SQL);
  await tp.exec(`DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'admin') THEN CREATE ROLE admin NOLOGIN; END IF;
  END $$;`);
  await tp.exec(ADMIN_ACTION_LOG_SCHEMA_SQL);
  await tp.exec(ADMIN_ACTION_LOG_ACTION_MIGRATION_SQL); // widens the CHECK to admit affiliate_mint
  // The system-mode read runs as admin_write; grant it SELECT so readSystemMode resolves 'active'.
  await tp.exec(`GRANT SELECT ON admin_action_log TO admin_write;`);
  await tp.exec(AFFILIATE_CODE_SCHEMA_SQL); // role-guarded grants apply (admin_write present)
});

afterAll(async () => {
  await tp.close();
});

describe("mintAffiliateCodeAdmin (ADR-0315/0320)", () => {
  test("mints the Paddle discount, registers the LOCKED-constant row, and dual-logs", async () => {
    const r = await mintAffiliateCodeAdmin(deps(), {
      actorEmail: "admin@caisson.sh",
      affiliateName: "Acme Partners",
      code: "ACMEAFF",
    });

    // The external mint saw the code + the affiliate name as its description.
    expect(lastMintInput).toEqual({
      code: "ACMEAFF",
      description: "Acme Partners",
    });
    expect(r.discountId).toBe("dsc_acmeaff");
    expect(r.code).toBe("ACMEAFF");
    expect(r.worm).toBe("ok");

    // The affiliate_code row carries the LOCKED program constants (never caller input).
    const rows = await ground<{
      commission_bps: number;
      discount_pct: number;
      affiliate_name: string;
      created_by: string;
    }>(
      `SELECT commission_bps, discount_pct, affiliate_name, created_by FROM affiliate_code WHERE discount_id = 'dsc_acmeaff'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.commission_bps).toBe(3000);
    expect(rows[0]?.discount_pct).toBe(10);
    expect(rows[0]?.affiliate_name).toBe("Acme Partners");
    expect(rows[0]?.created_by).toBe("admin@caisson.sh");

    // The queryable audit-log half exists, under the synthetic `affiliate` target.
    const log = await ground<{ target_account_id: string; action: string }>(
      `SELECT target_account_id, action FROM admin_action_log WHERE action = 'affiliate_mint'`,
    );
    expect(log).toHaveLength(1);
    expect(log[0]?.target_account_id).toBe("affiliate");
  });

  test("a WORM append that throws returns worm:'failed' while the registration PERSISTS (do NOT retry)", async () => {
    const brokenWorm = {
      append: async () => {
        throw new Error("worm down");
      },
    } as unknown as AdminMutationDeps["worm"];
    const r = await mintAffiliateCodeAdmin(deps({ worm: brokenWorm }), {
      actorEmail: "admin@caisson.sh",
      affiliateName: "Beta Co",
      code: "BETAAFF",
    });
    expect(r.worm).toBe("failed");
    // The row is durable regardless of the WORM outcome — a retry would double-mint.
    const rows = await ground(
      `SELECT 1 FROM affiliate_code WHERE code = 'BETAAFF'`,
    );
    expect(rows).toHaveLength(1);
  });

  test("throws a clear error when no mint proxy is wired (deps.mintDiscount undefined)", async () => {
    await expect(
      mintAffiliateCodeAdmin(deps({ mintDiscount: undefined }), {
        actorEmail: "admin@caisson.sh",
        affiliateName: "Gamma",
        code: "GAMMAAFF",
      }),
    ).rejects.toThrow(/not configured/);
  });
});

describe("mint orphan recovery (SHIP-audit)", () => {
  test("a registration failure AFTER the Paddle create surfaces a 409 naming the orphaned discount id", async () => {
    // Pre-register the code directly so the mint's INSERT collides — the simplest stand-in for any
    // registration-tx failure that lands after the external create succeeded.
    await tp.exec(
      `INSERT INTO affiliate_code (id, code, discount_id, affiliate_name, commission_bps, discount_pct, created_by)
       VALUES ('pre-1', 'EPSAFF', 'dsc_preexisting', 'Pre', 3000, 10, 'op')`,
    );
    lastMintInput = null;
    await expect(
      mintAffiliateCodeAdmin(deps(), {
        actorEmail: "admin@caisson.sh",
        affiliateName: "Eps",
        code: "EPSAFF",
      }),
    ).rejects.toThrow(/dsc_epsaff.*live but unregistered/);
    // The external mint DID run — the orphan exists at Paddle; the 409 is what makes it recoverable.
    // (read via a function: TS flow analysis pins the variable to `null` after the reset above)
    expect(seenMintInput()).toEqual({ code: "EPSAFF", description: "Eps" });
  });

  test("the discountId recovery input registers an ALREADY-minted discount without touching Paddle", async () => {
    lastMintInput = null;
    const r = await mintAffiliateCodeAdmin(deps(), {
      actorEmail: "admin@caisson.sh",
      affiliateName: "Zeta",
      code: "zetaaff", // lower-case in — registered upper-cased, mirroring Paddle's normalization
      discountId: "dsc_zeta_orphan",
    });
    expect(seenMintInput()).toBeNull(); // the proxy was never called — no second live discount
    expect(r.discountId).toBe("dsc_zeta_orphan");
    expect(r.code).toBe("ZETAAFF");
    const rows = await ground<{ affiliate_name: string }>(
      `SELECT affiliate_name FROM affiliate_code WHERE discount_id = 'dsc_zeta_orphan' AND code = 'ZETAAFF'`,
    );
    expect(rows).toHaveLength(1);
    const log = await ground(
      `SELECT 1 FROM admin_action_log WHERE action = 'affiliate_mint' AND payload_after::text LIKE '%dsc_zeta_orphan%'`,
    );
    expect(log).toHaveLength(1);
  });
});
