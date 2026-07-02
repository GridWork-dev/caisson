// Unit tests for the shared credential-shape scrub predicate (ADR-0215). Moved here from
// `local-store/src/egress-guard.test.ts` (T8, ADR-0067) — this is now the canonical home; the
// local-store suite keeps its own describe blocks green via the re-export (import path unchanged).
import { describe, expect, test } from "bun:test";
import { looksLikeSecret, scrubForEgress } from "./secret-scrub.ts";

describe("scrubForEgress (secret-scrub contract)", () => {
  test("C — drops a secret-named assignment value, keeps key + separator", () => {
    expect(scrubForEgress("OPENAI_API_KEY=sk-proj-AAAABBBBCCCCDDDD")).toBe(
      "OPENAI_API_KEY=[REDACTED]",
    );
    expect(scrubForEgress("auth_token: ghp_0123456789ABCDEFabcdef0123")).toBe(
      "auth_token: [REDACTED]",
    );
  });

  test("B — drops only the URL password, keeps scheme/user/host", () => {
    expect(
      scrubForEgress("postgres://app:s3cr3t-p4ss@db.example.com/main"),
    ).toBe("postgres://app:[REDACTED]@db.example.com/main");
  });

  test("D — redacts a bare inline token, surrounding text intact", () => {
    expect(
      scrubForEgress("Rotate AKIAIOSFODNN7EXAMPLE before the audit."),
    ).toBe("Rotate [REDACTED] before the audit.");
  });

  test("A — collapses a PEM private-key block whole", () => {
    const pem =
      "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAFAKE\n-----END RSA PRIVATE KEY-----";
    expect(scrubForEgress(pem)).toBe("[REDACTED]");
  });

  test("clean text passes through unchanged (no false positive)", () => {
    const clean =
      "Refactor the RRF ranker so the FTS leg rescues a vec-weak doc.";
    expect(scrubForEgress(clean)).toBe(clean);
  });

  test("idempotent — re-scrubbing already-scrubbed text is a no-op", () => {
    const once = scrubForEgress("token: ghp_0123456789ABCDEFabcdef0123");
    expect(scrubForEgress(once)).toBe(once);
  });
});

describe("looksLikeSecret", () => {
  test("true when the text carries a redactable span", () => {
    expect(looksLikeSecret("AKIAIOSFODNN7EXAMPLE")).toBe(true);
  });
  test("false for clean text", () => {
    expect(looksLikeSecret("just an ordinary sentence")).toBe(false);
  });
});
