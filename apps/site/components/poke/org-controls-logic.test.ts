// Real-package parity for the org-controls poke's browser mirror (org-controls-logic.ts). Two
// independent anchors: (1) the real `assertCanManageMembers` + the real `ACCOUNT_MEMBER_SCHEMA_SQL`,
// both imported by relative/package path (apps/site does not declare @caisson/org-controls as a
// workspace dependency — see org-controls-logic.ts's header for why), and (2) the real kernel
// `hashChainLink` (sync, node:crypto) cross-checked against the mirror's real
// `hashChainLinkAsync` (WebCrypto) import. Bun's test runtime is node-like, so the real package's
// node:crypto / Postgres-typed imports resolve fine here even though they cannot reach a browser
// bundle.
import { describe, expect, test } from "bun:test";
import { AuthzError } from "@caisson/kernel";
import { ACCOUNT_MEMBER_SCHEMA_SQL } from "@caisson/auth";

import { assertCanManageMembers } from "../../../../packages/org-controls/src/membership.ts";
// kernel's package.json exports no "./audit-chain" subpath (only ".", "./fetch", "./audit-verify",
// "./redact", "./evidence"), so the real sync hashChainLink is reached by relative path, same as
// membership.ts above.
import { hashChainLink } from "../../../../packages/kernel/src/audit-chain.ts";

import {
  SAMPLE_ACCOUNT_ID,
  SAMPLE_CREATED_AT,
  SAMPLE_NEW_USER_ID,
  buildAuditEntry,
  buildMemberRow,
  checkManageMembers,
} from "./org-controls-logic";

describe("checkManageMembers — real-package parity with assertCanManageMembers", () => {
  test("an owner is allowed, matching the real function's no-throw", () => {
    expect(checkManageMembers("owner")).toEqual({ allowed: true });
    expect(() => assertCanManageMembers("owner")).not.toThrow();
  });

  test("a seat is denied with the real AuthzError's code/httpStatus/message (the break-it control)", () => {
    const verdict = checkManageMembers("seat");
    expect(verdict.allowed).toBe(false);
    if (verdict.allowed) throw new Error("expected a denial");

    let real: AuthzError | null = null;
    try {
      assertCanManageMembers("seat");
    } catch (err) {
      real = err as AuthzError;
    }
    expect(real).toBeInstanceOf(AuthzError);
    expect(verdict.error).toEqual({
      code: real!.code,
      httpStatus: real!.httpStatus,
      message: real!.message,
    });
  });
});

describe("buildMemberRow — matches the real account_member schema", () => {
  test("every rendered column exists in the real ACCOUNT_MEMBER_SCHEMA_SQL DDL", () => {
    const row = buildMemberRow();
    for (const column of Object.keys(row)) {
      expect(ACCOUNT_MEMBER_SCHEMA_SQL).toContain(column);
    }
  });

  test("role defaults to addAccountMember's own default ('seat')", () => {
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
    const expected = hashChainLink(null, { ...row });
    expect(entry.hash).toBe(expected);
    expect(entry.seq).toBe(0);
    expect(entry.prevHash).toBeNull();
  });

  test("stable: the same row hashes to the same link on every call", async () => {
    const row = buildMemberRow();
    const a = await buildAuditEntry(row);
    const b = await buildAuditEntry(row);
    expect(a.hash).toBe(b.hash);
  });
});
