// Unit tests for the cloud-egress secret-scrub guard (ADR-0067, security-critical). Offline + engine-
// neutral: the embed transport is a TEST-DOUBLE (no live cloud call in CI). Proves the scrub contract,
// scrub-before-egress (the backend never sees a raw secret), the fail-closed https + dimension gates,
// and that a failed transport throws a redaction-safe error carrying no secret.
import { describe, expect, test } from "bun:test";
import { InternalError, ValidationError } from "@caisson/kernel";
import {
  createCloudEmbedder,
  guardEmbedder,
  looksLikeSecret,
  scrubForEgress,
  type EmbedFetch,
} from "./egress-guard.ts";
import type { Embedder } from "./embedder.ts";

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

describe("guardEmbedder (scrub-before-egress)", () => {
  test("the wrapped backend never receives a raw secret", async () => {
    const seen: string[] = [];
    const inner: Embedder = {
      dim: 2,
      embed: (t) => {
        seen.push(t);
        return Promise.resolve([0, 0]);
      },
    };
    await guardEmbedder(inner).embed("leaked AKIAIOSFODNN7EXAMPLE here");
    expect(seen[0]).toBe("leaked [REDACTED] here");
    expect(seen[0]).not.toContain("AKIAIOSFODNN7EXAMPLE");
  });
});

describe("createCloudEmbedder (test-doubled transport — no live call)", () => {
  function okResponse(vector: number[]): Response {
    return new Response(JSON.stringify({ embedding: vector }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  test("scrubs content before the request body leaves the box", async () => {
    let sentBody = "";
    const fetchDouble: EmbedFetch = (_url, init) => {
      sentBody = String(init?.body ?? "");
      return Promise.resolve(okResponse([0.1, 0.2]));
    };
    const embedder = createCloudEmbedder(
      {
        endpoint: "https://embed.example.com/v1",
        apiKey: "key-123",
        model: "m",
        dim: 2,
      },
      fetchDouble,
    );
    const vector = await embedder.embed(
      "DATABASE_URL=postgres://app:s3cr3t-p4ss@db.example.com/main",
    );
    expect(vector).toEqual([0.1, 0.2]);
    expect(sentBody).toContain("[REDACTED]");
    expect(sentBody).not.toContain("s3cr3t-p4ss");
  });

  test("rejects a non-https endpoint (fail-closed)", () => {
    expect(() =>
      createCloudEmbedder({
        endpoint: "http://embed.example.com",
        apiKey: "k",
        model: "m",
        dim: 2,
      }),
    ).toThrow(ValidationError);
  });

  test("rejects an unknown config field (strict boundary)", () => {
    expect(() =>
      createCloudEmbedder({
        endpoint: "https://embed.example.com",
        apiKey: "k",
        model: "m",
        dim: 2,
        unexpected: true,
      }),
    ).toThrow(ValidationError);
  });

  test("a wrong-dim response throws fail-closed (never corrupts the index)", async () => {
    const fetchDouble: EmbedFetch = () =>
      Promise.resolve(okResponse([0.1, 0.2, 0.3]));
    const embedder = createCloudEmbedder(
      {
        endpoint: "https://embed.example.com",
        apiKey: "k",
        model: "m",
        dim: 2,
      },
      fetchDouble,
    );
    await expect(embedder.embed("hello")).rejects.toThrow(ValidationError);
  });

  test("a failed transport throws a redaction-safe error (no secret)", async () => {
    const fetchDouble: EmbedFetch = () =>
      Promise.resolve(new Response("upstream detail", { status: 500 }));
    const embedder = createCloudEmbedder(
      {
        endpoint: "https://embed.example.com",
        apiKey: "super-secret-key",
        model: "m",
        dim: 2,
      },
      fetchDouble,
    );
    const err = (await embedder
      .embed("hello")
      .catch((e: unknown) => e)) as InternalError;
    expect(err).toBeInstanceOf(InternalError);
    expect(JSON.stringify(err.details ?? {})).not.toContain("super-secret-key");
  });
});
