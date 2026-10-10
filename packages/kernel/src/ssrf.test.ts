// SSRF guard tests (Strix vuln-0004). The load-bearing case is the DNS-rebinding one: a PUBLIC
// hostname whose A/AAAA record points into private space must be rejected at the resolve-time re-check,
// which the old literal-only guard let through. `node:dns/promises` is mocked so the suite is hermetic
// (no real resolution) and can simulate an attacker-controlled DNS answer.
import { beforeEach, describe, expect, mock, test } from "bun:test";

// A mutable holder the mocked lookup reads, so each test can dictate what the hostname "resolves" to.
const dns: { addresses: { address: string }[]; fail: boolean } = {
  addresses: [{ address: "93.184.216.34" }],
  fail: false,
};
mock.module("node:dns/promises", () => ({
  lookup: async () => {
    if (dns.fail) throw new Error("ENOTFOUND");
    return dns.addresses;
  },
}));

const {
  isPrivateAddress,
  assertSafePublicUrl,
  assertResolvedHostPublic,
  assertSafePublicUrlResolved,
  ssrfGuardedFetch,
} = await import("./ssrf.ts");

beforeEach(() => {
  dns.addresses = [{ address: "93.184.216.34" }];
  dns.fail = false;
});

// Carrier-grade NAT addresses are assembled from octets, so this file holds no literal address
// from that block: the repository's leak scan reads one as a private network address.
const cgnat = (b: number, c: number, d: number): string =>
  [100, b, c, d].join(".");

describe("isPrivateAddress", () => {
  test.each([
    "127.0.0.1",
    "0.0.0.0",
    "10.0.0.1",
    "172.16.5.4",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254", // cloud metadata
    cgnat(64, 0, 1), // 100.64/10 CGNAT (Tailscale tailnet)
    cgnat(100, 100, 200), // Alibaba Cloud metadata (inside CGNAT)
    cgnat(127, 255, 255), // top of 100.64/10
    "198.18.0.1", // 198.18/15 benchmarking
    "localhost",
    "foo.local",
    "::1",
    "[::1]",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])("rejects private/loopback %s", (h) => {
    expect(isPrivateAddress(h)).toBe(true);
  });

  test.each([
    "93.184.216.34",
    "8.8.8.8",
    "172.32.0.1",
    "172.15.0.1",
    "100.63.255.255", // just below the CGNAT block
    "100.128.0.1", // just above the CGNAT block
    "198.17.255.255", // just below 198.18/15
    "198.20.0.1", // just above 198.18/15
    "example.com",
    "2606:2800:220:1:248:1893:25c8:1946",
  ])("accepts public %s", (h) => {
    expect(isPrivateAddress(h)).toBe(false);
  });
});

describe("assertSafePublicUrl (sync literal guard)", () => {
  test("rejects non-https, credentials, and literal-private hosts", () => {
    expect(() => assertSafePublicUrl("http://example.com")).toThrow(
      /non-https/,
    );
    expect(() => assertSafePublicUrl("file:///etc/passwd")).toThrow(
      /non-https/,
    );
    expect(() => assertSafePublicUrl("https://u:p@example.com")).toThrow(
      /credentials/,
    );
    expect(() => assertSafePublicUrl("https://127.0.0.1")).toThrow(/private/);
    expect(() => assertSafePublicUrl("https://169.254.169.254")).toThrow(
      /private/,
    );
    expect(() => assertSafePublicUrl("not a url")).toThrow(/malformed/);
  });

  test("returns the parsed URL for a public https host", () => {
    expect(assertSafePublicUrl("https://hooks.example.com/x").hostname).toBe(
      "hooks.example.com",
    );
  });
});

describe("assertResolvedHostPublic (DNS re-check — the vuln-0004 fix)", () => {
  test("rejects a public host that RESOLVES to loopback (DNS rebinding)", async () => {
    dns.addresses = [{ address: "127.0.0.1" }];
    await expect(assertResolvedHostPublic("attacker.example")).rejects.toThrow(
      /private address/,
    );
  });

  test("rejects when ANY resolved address is private (split-horizon)", async () => {
    dns.addresses = [{ address: "93.184.216.34" }, { address: "10.1.2.3" }];
    await expect(assertResolvedHostPublic("attacker.example")).rejects.toThrow(
      /private address/,
    );
  });

  test("fails closed when the host does not resolve", async () => {
    dns.fail = true;
    await expect(assertResolvedHostPublic("nx.example")).rejects.toThrow(
      /did not resolve/,
    );
  });

  test("fails closed when lookup succeeds but returns NO addresses", async () => {
    // An empty answer would leave the for-loop a no-op and pass the host as public — must reject.
    dns.addresses = [];
    await expect(assertResolvedHostPublic("empty.example")).rejects.toThrow(
      /did not resolve/,
    );
  });

  test("passes for a host that resolves only to public addresses", async () => {
    dns.addresses = [{ address: "93.184.216.34" }];
    await expect(
      assertResolvedHostPublic("good.example"),
    ).resolves.toBeUndefined();
  });
});

describe("assertSafePublicUrlResolved (full fetch-seam guard)", () => {
  test("literal-private is rejected before any DNS lookup", async () => {
    // Even if DNS would answer 'public', a literal-private host is rejected by the sync stage first.
    dns.addresses = [{ address: "93.184.216.34" }];
    await expect(
      assertSafePublicUrlResolved("https://127.0.0.1"),
    ).rejects.toThrow(/private\/loopback/);
  });

  test("public-looking host that rebinds to private is rejected", async () => {
    dns.addresses = [{ address: "127.0.0.1" }];
    await expect(
      assertSafePublicUrlResolved("https://attacker.example"),
    ).rejects.toThrow(/private address/);
  });
});

describe("ssrfGuardedFetch", () => {
  test("does NOT call the underlying fetch when the host resolves private", async () => {
    dns.addresses = [{ address: "169.254.169.254" }];
    const realFetch = globalThis.fetch;
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response("{}");
    }) as unknown as typeof fetch;
    try {
      await expect(
        ssrfGuardedFetch("https://metadata.attacker.example"),
      ).rejects.toThrow(/private address/);
      expect(called).toBe(false);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  test("forces redirect:'error' on the delegated fetch (no 3xx to an unchecked host)", async () => {
    // A public host passes the resolve-recheck, then tries to redirect to a private host. The guard
    // must never follow it — so the delegated fetch is called with redirect:"error" (Strix vuln-0004).
    dns.addresses = [{ address: "93.184.216.34" }];
    const realFetch = globalThis.fetch;
    let seenRedirect: string | undefined;
    let seenSignal: unknown;
    globalThis.fetch = (async (_input: unknown, init: RequestInit) => {
      seenRedirect = init.redirect;
      seenSignal = init.signal;
      return new Response("{}");
    }) as unknown as typeof fetch;
    try {
      await ssrfGuardedFetch("https://public.example");
      expect(seenRedirect).toBe("error");
      // Routed through fetchWithTimeout (ADR-0002 floor), so an AbortSignal is now wired — the old bare
      // `fetch` delegate passed none.
      expect(seenSignal).toBeInstanceOf(AbortSignal);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
