// Unit tests for the cloud-egress secret-scrub guard (ADR-0067, security-critical). Offline + engine-
// neutral: the embed transport is a TEST-DOUBLE (no live cloud call in CI). Proves the scrub contract,
// scrub-before-egress (the backend never sees a raw secret), the fail-closed https + dimension gates,
// and that a failed transport throws a redaction-safe error carrying no secret.
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { InternalError, ValidationError } from "@caisson-sh/kernel";
import type { EmbedFetch } from "./embed-scrub-guard.ts";
import type { Embedder } from "./embedder.ts";

// Resolver seam, not a replacement of the security guard. The real kernel guard inspects
// these synthetic DNS answers; neither DNS nor the transport reaches a live service.
const dns: { addresses: { address: string }[]; calls: number } = {
  addresses: [{ address: "93.184.216.34" }],
  calls: 0,
};
mock.module("node:dns/promises", () => ({
  lookup: async () => {
    dns.calls++;
    return dns.addresses;
  },
}));
const { createCloudEmbedder, guardEmbedder, looksLikeSecret, scrubForEgress } =
  await import("./embed-scrub-guard.ts");
beforeEach(() => {
  dns.addresses = [{ address: "93.184.216.34" }];
  dns.calls = 0;
});

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

  test("rejects a public hostname resolving to private space before fetch", async () => {
    dns.addresses = [
      { address: "93.184.216.34" },
      { address: "169.254.169.254" },
    ];
    const fetchImpl = mock<EmbedFetch>(() =>
      Promise.resolve(okResponse([0.1, 0.2])),
    );
    const embedder = createCloudEmbedder(
      {
        endpoint: "https://embed.example.com/v1",
        apiKey: "test-key",
        model: "m",
        dim: 2,
      },
      fetchImpl,
    );
    await expect(embedder.embed("buyer content")).rejects.toThrow(
      /private address/,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(dns.calls).toBe(1);
  });

  test("resolves immediately before every request including a changed DNS answer", async () => {
    const order: string[] = [];
    const fetchImpl: EmbedFetch = (_url, init) => {
      order.push(`fetch-after-resolution-${dns.calls}`);
      expect(init?.redirect).toBe("error");
      return Promise.resolve(okResponse([0.1, 0.2]));
    };
    const embedder = createCloudEmbedder(
      {
        endpoint: "https://embed.example.com/v1",
        apiKey: "test-key",
        model: "m",
        dim: 2,
      },
      fetchImpl,
    );
    await embedder.embed("first");
    dns.addresses = [{ address: "127.0.0.1" }];
    await expect(embedder.embed("second")).rejects.toThrow(/private address/);
    expect(order).toEqual(["fetch-after-resolution-1"]);
    expect(dns.calls).toBe(2);
  });

  test("rejects a private, loopback or metadata endpoint at construction", () => {
    // The schema's `.refine` proves only the SCHEME. Every host below is valid https, so a
    // scheme-only check admits all of them and `embed()` would POST the Bearer credential there.
    const reached: string[] = [];
    const spy: EmbedFetch = (url) => {
      reached.push(String(url));
      return Promise.resolve(okResponse([0.1, 0.2]));
    };
    for (const endpoint of [
      "https://169.254.169.254/latest/meta-data/", // cloud metadata
      "https://127.0.0.1/v1",
      "https://localhost/v1",
      "https://10.0.0.5/v1",
      "https://192.168.1.10/v1",
      "https://user:pw@embed.example.com/v1", // credentials in URL
    ]) {
      expect(() =>
        createCloudEmbedder(
          { endpoint, apiKey: "key-123", model: "m", dim: 2 },
          spy,
        ),
      ).toThrow();
    }
    // Nothing was attempted: the guard runs at construction, before any transport exists.
    expect(reached).toEqual([]);
  });

  test("a public https endpoint still constructs and embeds", async () => {
    // The positive control. Without it the rejection sweep above passes just as well against a
    // `createCloudEmbedder` that throws on everything.
    const fetchDouble: EmbedFetch = () =>
      Promise.resolve(okResponse([0.1, 0.2]));
    const embedder = createCloudEmbedder(
      {
        endpoint: "https://embed.example.com/v1",
        apiKey: "key-123",
        model: "m",
        dim: 2,
      },
      fetchDouble,
    );
    expect(await embedder.embed("hello")).toEqual([0.1, 0.2]);
  });

  test("refuses to follow a redirect on the credential-bearing POST", async () => {
    // A 3xx would re-target the Bearer POST past the construction-time host check, which only
    // ever saw the configured origin.
    let init: RequestInit | undefined;
    const fetchDouble: EmbedFetch = (_url, requestInit) => {
      init = requestInit;
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
    await embedder.embed("hello");
    expect(init?.redirect).toBe("error");
  });

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
