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

// The contract in its plain form: one pattern per rule, applied in order. It is correct, but it
// takes quadratic time on a long run, so it is only the yardstick for the generated cases below.
const PLAIN_SECRET_NAME =
  /api[_-]?key|secret|token|passwd|password|pwd|authorization|bearer|access[_-]?key|private[_-]?key/i;
function plainScrub(text: string): string {
  return text
    .replace(
      /-----BEGIN [^\n-]*PRIVATE KEY-----[\s\S]*?-----END [^\n-]*PRIVATE KEY-----/g,
      "[REDACTED]",
    )
    .replace(
      /([a-z][a-z0-9+.-]*:\/\/[^/:@\s]+:)[^/@\s]+(@)/gi,
      "$1[REDACTED]$2",
    )
    .replace(
      /\b([A-Za-z][A-Za-z0-9_-]*)([ \t]*=[ \t]*|:[ \t]+)(\S[^\n]*)/g,
      (match, key: string, sep: string) =>
        PLAIN_SECRET_NAME.test(key) ? `${key}${sep}[REDACTED]` : match,
    )
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "[REDACTED]")
    .replace(/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, "[REDACTED]")
    .replace(/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, "[REDACTED]")
    .replace(/\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/g, "[REDACTED]")
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      "[REDACTED]",
    );
}

/** Every sequence of up to `depth` pieces. */
function* sequences(
  pieces: readonly string[],
  depth: number,
  prefix = "",
): Generator<string> {
  yield prefix;
  if (depth === 0) return;
  for (const piece of pieces) {
    yield* sequences(pieces, depth - 1, prefix + piece);
  }
}

const PEM_HEADER = `-----BEGIN ${PEM_LABEL}-----`;
const PEM_FOOTER = `-----END ${PEM_LABEL}-----`;

describe("scrubForEgress against the plain one-pattern form", () => {
  const firstDifference = (texts: Iterable<string>): string | null => {
    for (const text of texts) {
      if (scrubForEgress(text) !== plainScrub(text)) return text;
    }
    return null;
  };

  test("A — every short mix of headers, footers and filler", () => {
    const pieces = [PEM_HEADER, PEM_FOOTER, "-----BEGIN ", "x", "\n", "-"];
    expect(firstDifference(sequences(pieces, 5))).toBeNull();
  });

  test("B — every short mix of scheme, userinfo and separator characters", () => {
    const pieces = ["a", "1", "+", "://", "://u:p@", ":", "@", "/", " "];
    expect(firstDifference(sequences(pieces, 5))).toBeNull();
  });

  test("C — every short mix of key, separator and line characters", () => {
    expect(
      firstDifference(sequences(["a", "1", "_", "-", "=", ":", " ", "\n"], 5)),
    ).toBeNull();
    expect(
      firstDifference(
        sequences(["token", "x", "9", "-", "=", ": ", " ", "\n"], 5),
      ),
    ).toBeNull();
  });

  test("D — every short mix of token prefixes, dots and dashes", () => {
    const pieces = ["eyJ", "eyJa", ".b.c", "sk-", "x", "-", ".", " "];
    expect(firstDifference(sequences(pieces, 5))).toBeNull();
  });

  test("random mixes of pieces from every rule", () => {
    const pieces = [
      PEM_HEADER,
      PEM_FOOTER,
      "MIIE",
      "\n",
      " ",
      "\t",
      "=",
      ": ",
      "://",
      "@",
      "/",
      ".",
      "-",
      "_",
      "a",
      "9",
      "eyJ",
      "eyJhbGciOiJIUzI1NiJ9",
      "sk-",
      "proj-",
      "AKIA",
      "ABCDEFGHIJKLMNOP",
      "ghp_",
      "github_pat_",
      "abcdefghijklmnopqrstuvwx",
      "token",
      "password",
      "name",
      "https",
      "example.com",
    ];
    // A fixed-seed generator, so a failure names the same text on every run.
    let seed = 0x2f6e2b1;
    const next = (bound: number): number => {
      seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
      return seed % bound;
    };
    function* mixes(): Generator<string> {
      for (let i = 0; i < 40_000; i += 1) {
        let text = "";
        for (let n = 1 + next(20); n > 0; n -= 1) {
          text += pieces[next(pieces.length)] ?? "";
        }
        yield text;
      }
    }
    expect(firstDifference(mixes())).toBeNull();
  });
});

describe("scrubForEgress on long runs", () => {
  test("text with no secret in it is scanned in linear time", () => {
    // The plain forms take minutes on each of these: every position in the run is a new start.
    const runs = [
      PEM_HEADER.repeat(100_000),
      "a".repeat(1_000_000),
      "a-".repeat(500_000),
      "eyJ-".repeat(250_000),
    ];
    for (const run of runs) {
      const started = performance.now();
      expect(scrubForEgress(run) === run).toBe(true);
      expect(performance.now() - started).toBeLessThan(2_000);
    }
  });

  test("a secret after a run of several megabytes is still redacted", () => {
    // A pattern that repeats a group once per piece gives up, or throws, on runs this long.
    const scrubs = (text: string, expected: string): boolean =>
      scrubForEgress(text) === expected;
    const n = 4_000_000;
    expect(
      scrubs(`${"1-".repeat(n)}token=abc`, `${"1-".repeat(n)}token=[REDACTED]`),
    ).toBe(true);
    expect(
      scrubs(
        `${"x-".repeat(n)}eyJaaaa.bbbb.cccc`,
        `${"x-".repeat(n)}[REDACTED]`,
      ),
    ).toBe(true);
    expect(
      scrubs(
        `${"9+".repeat(n)}a://u:pw@h`,
        `${"9+".repeat(n)}a://u:[REDACTED]@h`,
      ),
    ).toBe(true);
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
