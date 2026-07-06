import { describe, expect, test } from "bun:test";
import {
  resolveCatalogSpec,
  sanitizeAdrCitations,
  sanitizeSourceComments,
} from "./export-public-mirror.ts";

describe("sanitizeAdrCitations", () => {
  test("strips a single bare ADR-id parenthetical", () => {
    expect(
      sanitizeAdrCitations(
        "any path is constructed or any subprocess spawned (ADR-0021).",
      ),
    ).toBe("any path is constructed or any subprocess spawned.");
  });

  test("strips a multi-id parenthetical (slash-separated)", () => {
    expect(
      sanitizeAdrCitations("a different discipline (ADR-0010/0015)."),
    ).toBe("a different discipline.");
  });

  test("strips a parenthetical with a short internal phase code plus ids", () => {
    expect(
      sanitizeAdrCitations("the credit ledger (P6, ADR-0089/0017) closes."),
    ).toBe("the credit ledger closes.");
  });

  test("leaves a parenthetical that mixes prose with an ADR id untouched", () => {
    const text = "read the invariant (see ADR-0072 for details) first.";
    expect(sanitizeAdrCitations(text)).toBe(text);
  });

  test("leaves a non-ADR parenthetical untouched", () => {
    const text =
      "Asymmetric (Ed25519 license) verification is NOT here: it uses crypto.verify.";
    expect(sanitizeAdrCitations(text)).toBe(text);
  });

  test("collapses the double space left by a removed mid-sentence parenthetical", () => {
    expect(
      sanitizeAdrCitations("debits once (ADR-0024)  — safe to retry."),
    ).toBe("debits once — safe to retry.");
  });

  test("is a no-op on prose with no parentheticals", () => {
    const text = "Validate every input with Zod at the API boundary.";
    expect(sanitizeAdrCitations(text)).toBe(text);
  });

  test("leaves unrelated markdown list-continuation indentation untouched", () => {
    const text = [
      "- **Allowlist BEFORE side effects.** Always go through `generate`: every module",
      "  id + version is validated against the registry index (ADR-0021).",
      "  Never build a path from an unvalidated id/version.",
    ].join("\n");
    const after = sanitizeAdrCitations(text);
    expect(after).toContain("\n  id + version is validated");
    expect(after).toContain("\n  Never build a path");
    expect(after).not.toContain("ADR-0021");
  });
});

describe("resolveCatalogSpec", () => {
  const catalogConfig = {
    catalog: { zod: "^3.23.8", typescript: "^5.7.3" },
    catalogs: { zod4: { zod: "^4.0.0" } },
  };

  test("passes a non-catalog specifier through unchanged", () => {
    expect(resolveCatalogSpec("zod", "^3.23.0", catalogConfig)).toBe("^3.23.0");
  });

  test("resolves the default catalog specifier to its concrete range", () => {
    expect(resolveCatalogSpec("zod", "catalog:", catalogConfig)).toBe(
      "^3.23.8",
    );
  });

  test("resolves a named catalog specifier (catalog:<name>)", () => {
    expect(resolveCatalogSpec("zod", "catalog:zod4", catalogConfig)).toBe(
      "^4.0.0",
    );
  });

  test("throws on a default catalog specifier with no matching entry", () => {
    expect(() =>
      resolveCatalogSpec("left-pad", "catalog:", catalogConfig),
    ).toThrow(/Unresolvable catalog specifier/);
  });

  test("throws on a named catalog specifier with no matching table", () => {
    expect(() =>
      resolveCatalogSpec("zod", "catalog:missing", catalogConfig),
    ).toThrow(/Unresolvable catalog specifier/);
  });
});

describe("sanitizeSourceComments", () => {
  test("sanitizes a bare ADR-id parenthetical inside a line comment only", () => {
    const code = [
      "// Asymmetric (Ed25519 license) verification is NOT here: it uses `crypto.verify`, a different",
      "// discipline (ADR-0010/0015).",
      "import { createHash, timingSafeEqual } from 'node:crypto';",
    ].join("\n");
    const after = sanitizeSourceComments(code);
    expect(after).toContain("// Asymmetric (Ed25519 license) verification");
    expect(after).toContain("// discipline.");
    expect(after).not.toContain("ADR-0010");
    // Code outside the comment is untouched.
    expect(after).toContain(
      "import { createHash, timingSafeEqual } from 'node:crypto';",
    );
  });

  test("sanitizes inside a block comment without touching adjacent code", () => {
    const code = [
      "/**",
      " * Debit before spend (ADR-0049/0007).",
      " */",
      "export function run(): void {}",
    ].join("\n");
    const after = sanitizeSourceComments(code);
    expect(after).toContain(" * Debit before spend.");
    expect(after).toContain("export function run(): void {}");
  });

  test("never mistakes a https:// URL string for a line comment", () => {
    const code = 'const DOCS_URL = "https://caisson.sh/docs"; // stable link';
    expect(sanitizeSourceComments(code)).toBe(code);
  });
});
