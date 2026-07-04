// ADR-0233 audit remediation (P2/D1, findings 0c02cc99 + 473e4357): proves (1) the confirm gate
// never arms on the literal "CONFIRM" bypass — only an exact target-account-id retype arms it, and
// (2) a token-bearing mutation result (license reissue) never displays the plaintext secret until an
// explicit reveal. No RTL/jsdom in this repo (see page.test.ts's isUndefinedTableError precedent) —
// the pure logic these components render from is exported and tested directly.
import { expect, test } from "bun:test";
import {
  isArmed,
  isTokenBody,
  redactToken,
  tokenDisplayValue,
} from "./mutations.tsx";

test("isArmed requires the exact target account id — CONFIRM is no longer a universal bypass", () => {
  expect(isArmed("acct_123", "acct_123")).toBe(true);
  expect(isArmed("CONFIRM", "acct_123")).toBe(false);
  expect(isArmed("acct_124", "acct_123")).toBe(false);
  expect(isArmed("", "acct_123")).toBe(false);
  expect(isArmed("acct_123", "")).toBe(false);
});

test("isArmed respects an explicit disabled flag even on an exact match", () => {
  expect(isArmed("acct_123", "acct_123", true)).toBe(false);
  expect(isArmed("acct_123", "acct_123", false)).toBe(true);
});

test("isTokenBody detects only a plaintext-token-bearing result body", () => {
  expect(isTokenBody({ token: "sk_live_abc", licenseId: "lic_1" })).toBe(true);
  expect(isTokenBody({ balanceAfter: 500 })).toBe(false);
  expect(isTokenBody(null)).toBe(false);
  expect(isTokenBody("token")).toBe(false);
  expect(isTokenBody({ token: 123 })).toBe(false);
});

test("tokenDisplayValue is masked until revealed — the token never appears in the masked form", () => {
  const token = "sk_live_super_secret_value";
  const masked = tokenDisplayValue(token, false);
  expect(masked).not.toContain(token);
  expect(masked).toBe("•".repeat(8));
  expect(tokenDisplayValue(token, true)).toBe(token);
});

test("redactToken strips the plaintext token from the JSON dump but keeps the other fields", () => {
  const body = {
    token: "sk_live_super_secret_value",
    licenseId: "lic_1",
    major: 1,
  };
  const redacted = redactToken(body);
  expect(JSON.stringify(redacted)).not.toContain("sk_live_super_secret_value");
  expect(redacted.licenseId).toBe("lic_1");
  expect(redacted.major).toBe(1);
});
