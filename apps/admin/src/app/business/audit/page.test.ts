import { describe, expect, test } from "bun:test";
import { parseAuditPageAccount } from "./page.tsx";

describe("admin audit page account boundary", () => {
  test("accepts one bounded opaque id and rejects path, whitespace, control, and oversized input", () => {
    expect(parseAuditPageAccount("acct_opaque_01")).toBe("acct_opaque_01");
    expect(parseAuditPageAccount("../../etc/passwd")).toBeNull();
    expect(parseAuditPageAccount("acct with spaces")).toBeNull();
    expect(parseAuditPageAccount("acct\u0000control")).toBeNull();
    expect(parseAuditPageAccount("a".repeat(257))).toBeNull();
  });
});
