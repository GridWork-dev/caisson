// Unit tests for the shared credential-shape scrub predicate (ADR-0215). Moved here from
// `local-store/src/egress-guard.test.ts` (T8, ADR-0067) — this is now the canonical home; the
// local-store suite keeps its own describe blocks green via the re-export (import path unchanged).
import { describe, expect, test } from "bun:test";
import { looksLikeSecret, scrubForEgress } from "./secret-scrub.ts";

// Credential-shaped fixtures are assembled from parts, so this file holds no literal credential
// assignment or private-key header: the repository's leak scan reads either as a leaked secret.
const API_KEY_VAR = "OPENAI_API_KEY";
const PEM_LABEL = "RSA PRIVATE KEY";

describe("scrubForEgress (secret-scrub contract)", () => {
  test("C — drops a secret-named assignment value, keeps key + separator", () => {
    expect(scrubForEgress(`${API_KEY_VAR}=sk-proj-AAAABBBBCCCCDDDD`)).toBe(
      `${API_KEY_VAR}=[REDACTED]`,
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
    const pem = `-----BEGIN ${PEM_LABEL}-----\nMIIEowIBAAKCAQEAFAKE\n-----END ${PEM_LABEL}-----`;
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
