// The org-controls poke's checkable claims, now that it drives the REAL package through its
// `./browser` entry (ADR-0396) and the hand-ported mirror (org-controls-logic.ts) is deleted:
//
//   1. The poke's client graph is browser-safe — a STATIC SOURCE-GRAPH WALK, never a build (a
//      bundler does not fail on a node builtin, it SUBSTITUTES a ~428KB polyfill). For THIS
//      package the decisive channel is the walk's `external` frontier, not `offenders`: the
//      org-controls barrel reaches zero node builtins — what it drags in is `@clerk/backend` and
//      `pg`. A node-builtin-only check would have called the barrel importable.
//   2. The component imports the browser entry, never the barrel — the import specifier is itself
//      the guard, so a later "simplify the import" edit fails here.
//   3. The rendered denial is the REAL AuthzError the package throws, identity-checked against the
//      barrel's own export. No parity suite, because there is no second copy to keep in parity.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  nodeBuiltinTaint,
  nodeGlobalTaint,
} from "@caisson-sh/testing/module-graph";
import { AuthzError } from "@caisson-sh/kernel";
import { ACCOUNT_MEMBER_SCHEMA_SQL } from "@caisson-sh/auth";
import { assertCanManageMembers } from "@caisson-sh/org-controls";
import { hashChainLink } from "@caisson-sh/kernel/node";

import {
  SAMPLE_ACCOUNT_ID,
  SAMPLE_CREATED_AT,
  SAMPLE_NEW_USER_ID,
  buildAuditEntry,
  buildMemberRow,
  runGate,
} from "./org-controls-poke";

const WORKSPACE_ROOT = join(import.meta.dir, "../../../..");
const POKE_ENTRY = join(import.meta.dir, "org-controls-poke.tsx");

describe("the poke's client graph is browser-safe (static source walk, NOT a build)", () => {
  const walk = nodeBuiltinTaint(POKE_ENTRY, { workspaceRoot: WORKSPACE_ROOT });

  test("no module reachable from the client entry imports a node builtin (transitive)", () => {
    expect(walk.offenders).toEqual([]);
    expect(walk.unresolved).toEqual([]);
  });

  test("no package or poke module introduces an untracked node global", () => {
    expect(
      nodeGlobalTaint(walk.files, { workspaceRoot: WORKSPACE_ROOT }),
    ).toEqual([{ file: "packages/kernel/src/config.ts", spec: "process" }]);
  });

  test("the external frontier is exactly this set — neither the Clerk SDK nor the Postgres driver", () => {
    expect(walk.external).toEqual(["lucide-react", "radix-ui", "react", "zod"]);
  });

  test("the walk crossed into the browser entry and NEVER the server-only halves", () => {
    expect(walk.files).toContain("packages/org-controls/src/browser.ts");
    expect(walk.files).toContain("packages/org-controls/src/gate.ts");
    expect(
      walk.files
        .filter((file) => file.startsWith("packages/org-controls/src/"))
        .sort(),
    ).toEqual([
      "packages/org-controls/src/browser.ts",
      "packages/org-controls/src/gate.ts",
    ]);
    expect(walk.files.some((f) => f.startsWith("packages/tenancy-rls/"))).toBe(
      false,
    );
    // @caisson-sh/auth supplies only the `Role` TYPE here — a value edge would drag jwt.ts's
    // node:crypto in, so the erasure has to hold.
    expect(walk.files.some((f) => f.startsWith("packages/auth/"))).toBe(false);
  });

  test("positive control: the auth barrel IS tainted, so the walker is not blind", () => {
    const auth = nodeBuiltinTaint(
      join(WORKSPACE_ROOT, "packages/auth/src/index.ts"),
      { workspaceRoot: WORKSPACE_ROOT },
    );
    expect(
      auth.offenders.some(
        (o) =>
          o.file === "packages/auth/src/jwt.ts" && o.spec === "node:crypto",
      ),
    ).toBe(true);
  });

  test("the component imports the browser entry, never the barrel", () => {
    const src = readFileSync(POKE_ENTRY, "utf8");
    expect(src).toContain('from "@caisson-sh/org-controls/browser"');
    expect(src).not.toMatch(/from "@caisson-sh\/org-controls"/);
  });
});

describe("runGate renders the package's real throw", () => {
  test("an owner passes", () => {
    expect(runGate("owner")).toEqual({ allowed: true });
    expect(() => assertCanManageMembers("owner")).not.toThrow();
  });

  test("a seat is denied with the real AuthzError instance, not a transcription", () => {
    const verdict = runGate("seat");
    if (verdict.allowed) throw new Error("expected a denial");
    expect(verdict.error).toBeInstanceOf(AuthzError);
    expect(verdict.error.code).toBe("forbidden");
    expect(verdict.error.httpStatus).toBe(403);
    // The rendered message is whatever the shipped package throws — read it off the barrel's own
    // export rather than restating the string, so a wording change can never silently drift here.
    let thrown: unknown;
    try {
      assertCanManageMembers("seat");
    } catch (err) {
      thrown = err;
    }
    expect(verdict.error.message).toBe((thrown as AuthzError).message);
  });
});

describe("buildMemberRow — poke-local sample data, still true to the real schema", () => {
  test("every rendered column exists in the real ACCOUNT_MEMBER_SCHEMA_SQL DDL", () => {
    for (const column of Object.keys(buildMemberRow())) {
      expect(ACCOUNT_MEMBER_SCHEMA_SQL).toContain(column);
    }
  });

  test("role matches addAccountMember's own default ('seat')", () => {
    expect(buildMemberRow().role).toBe("seat");
  });

  test("deterministic: no clock read, same output on every call", () => {
    expect(buildMemberRow()).toEqual(buildMemberRow());
    expect(buildMemberRow().created_at).toBe(SAMPLE_CREATED_AT);
    expect(buildMemberRow().account_id).toBe(SAMPLE_ACCOUNT_ID);
    expect(buildMemberRow().user_id).toBe(SAMPLE_NEW_USER_ID);
  });
});

describe("buildAuditEntry — real kernel audit-chain hash, WebCrypto vs node:crypto", () => {
  test("hashChainLinkAsync agrees with the real sync hashChainLink byte-for-byte", async () => {
    const row = buildMemberRow();
    const entry = await buildAuditEntry(row);
    expect(entry.hash).toBe(hashChainLink(null, { ...row }));
    expect(entry.seq).toBe(0);
    expect(entry.prevHash).toBeNull();
  });

  test("stable: the same row hashes to the same link on every call", async () => {
    const row = buildMemberRow();
    const [a, b] = await Promise.all([
      buildAuditEntry(row),
      buildAuditEntry(row),
    ]);
    expect(a.hash).toBe(b.hash);
  });
});
