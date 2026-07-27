import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertFrameworkSourceLinkage,
  assertKnownPositive,
  createPublicSourceFetcher,
  discoverRegulatoryClaims,
  runRegulatoryClaimWatch,
  type RegulatoryClaimTarget,
  type SourceFetcher,
} from "../scripts/regulatory-claim-watch";

const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const WORKFLOW_WRAPPER = join(
  REPO_ROOT,
  "apps/site/scripts/run-regulatory-claim-watch.sh",
);

const KNOWN_TARGET: RegulatoryClaimTarget = {
  id: "known-positive",
  route: "/fixture/known-positive",
  verifiedOn: "1970-01-01",
  sources: [
    {
      label: "Known positive source",
      url: "https://example.com/source",
      locator: "Article 50",
    },
  ],
};

describe("regulatory-claim watch discovery", () => {
  test("known-positive smoke discovers both framework pages and the writing registry", () => {
    const targets = discoverRegulatoryClaims(REPO_ROOT);
    assertKnownPositive(targets, { requireCanonicalTargets: true });

    expect(targets.map((target) => target.route)).toContain(
      "/frameworks/eu-ai-act",
    );
    expect(targets.map((target) => target.route)).toContain(
      "/frameworks/eu-ai-act/article-50",
    );
    expect(targets.some((target) => target.route.startsWith("/writing/"))).toBe(
      true,
    );
    expect(targets).toHaveLength(3);
    expect(targets.map((target) => target.sources.length)).toEqual([2, 4, 4]);
    for (const target of targets) {
      expect(target.sources.length).toBeGreaterThan(0);
    }
  });

  test("empty discovery throws instead of producing a false PASS", () => {
    expect(() => assertKnownPositive([])).toThrow(
      "discovered zero regulatory claim targets",
    );
  });

  test("canonical discovery rejects the framework-only false green", () => {
    const frameworkOnly = discoverRegulatoryClaims(REPO_ROOT).filter(
      (target) => !target.id.startsWith("writing-"),
    );

    expect(() =>
      assertKnownPositive(frameworkOnly, { requireCanonicalTargets: true }),
    ).toThrow("discovered zero writing targets");
  });

  test("framework discovery rejects a page detached from the shared source contract", () => {
    expect(() =>
      assertFrameworkSourceLinkage(
        "/frameworks/eu-ai-act",
        "<main>2026-07-26</main>",
        "2026-07-26",
        KNOWN_TARGET.sources,
      ),
    ).toThrow("does not render declared source");
  });

  test("framework discovery rejects a linked source whose exact locator is not rendered", () => {
    expect(() =>
      assertFrameworkSourceLinkage(
        "/frameworks/eu-ai-act",
        '<main><a href="https://example.com/source">source</a>1970-01-01</main>',
        KNOWN_TARGET.verifiedOn,
        KNOWN_TARGET.sources,
      ),
    ).toThrow("does not render declared source locator");
  });

  test("framework discovery rejects comments, dead indexed access, and duplicate date tokens", () => {
    const detachedSource = [
      "<!-- https://example.com/source -->",
      "ARTICLE_50_PRIMARY_SOURCES[0]",
      "ARTICLE_50_VERIFIED_ON ARTICLE_50_VERIFIED_ON",
      "<main>1970-01-01</main>",
    ].join("");

    expect(() =>
      assertFrameworkSourceLinkage(
        "/frameworks/eu-ai-act",
        detachedSource,
        KNOWN_TARGET.verifiedOn,
        KNOWN_TARGET.sources,
      ),
    ).toThrow("does not render declared source");
  });

  test("every discovered target carries a valid verification date", () => {
    for (const target of discoverRegulatoryClaims(REPO_ROOT)) {
      expect(target.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("regulatory-claim source checks", () => {
  test("reports a reachable source whose locator is still present", async () => {
    const fetcher: SourceFetcher = async () =>
      new Response("<main>Regulation text — Article 50 transparency</main>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });

    const report = await runRegulatoryClaimWatch([KNOWN_TARGET], fetcher);

    expect(report.checkedSources).toBe(1);
    expect(report.findings).toEqual([]);
    expect(report.markdown).toContain("1 source checked");
    expect(report.markdown).toContain("No mechanical drift detected");
  });

  test("reports drift when a declared locator disappears", async () => {
    const fetcher: SourceFetcher = async () =>
      new Response("<main>Source text changed.</main>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });

    const report = await runRegulatoryClaimWatch([KNOWN_TARGET], fetcher);

    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]?.kind).toBe("locator-missing");
    expect(report.markdown).toContain("Article 50");
  });

  test("keeps a precise locator while reporting a declared reachability-only source as green", async () => {
    const target: RegulatoryClaimTarget = {
      ...KNOWN_TARGET,
      sources: [
        {
          ...KNOWN_TARGET.sources[0]!,
          locator: "Paragraph (153), pp. 49–50",
          watch: {
            mode: "reachable",
            reason: "The official source is a PDF.",
          },
        },
      ],
    };
    const fetcher: SourceFetcher = async () =>
      new Response(new Uint8Array([37, 80, 68, 70]), {
        status: 200,
        headers: { "content-type": "application/pdf" },
      });

    const report = await runRegulatoryClaimWatch([target], fetcher);

    expect(report.findings).toEqual([]);
    expect(report.notes).toEqual([
      expect.objectContaining({
        kind: "reachability-only",
        detail: expect.stringContaining("Paragraph (153), pp. 49–50"),
      }),
    ]);
    expect(report.markdown).toContain("No mechanical drift detected");
    expect(report.markdown).toContain("Reachability-only checks");
  });

  test("checks every declared text anchor independently", async () => {
    const target: RegulatoryClaimTarget = {
      ...KNOWN_TARGET,
      sources: [
        {
          ...KNOWN_TARGET.sources[0]!,
          locator: "Claim-specific anchors",
          watch: {
            mode: "text",
            texts: ["2 August 2026", "December 2026", "Article 50(2)"],
          },
        },
      ],
    };
    const fetcher: SourceFetcher = async () =>
      new Response("2 August 2026 · Article 50(2)", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });

    const report = await runRegulatoryClaimWatch([target], fetcher);

    expect(report.findings).toEqual([
      expect.objectContaining({
        kind: "locator-missing",
        detail: expect.stringContaining("December 2026"),
      }),
    ]);
  });

  test.each([
    ["an HTML comment", "<!-- Article 50 -->"],
    ["a script payload", "<script>const marker = 'Article 50';</script>"],
    [
      "a style block",
      "<style>.marker::after { content: 'Article 50'; }</style>",
    ],
    ["a template", "<template>Article 50</template>"],
    ["a noscript block", "<noscript>Article 50</noscript>"],
    ["an explicitly hidden subtree", "<div hidden>Article 50</div>"],
    ["an aria-hidden subtree", '<div aria-hidden="true">Article 50</div>'],
    ["a display-none subtree", '<div style="display: none">Article 50</div>'],
  ])("ignores watch text that exists only in %s", async (_label, markup) => {
    const fetcher: SourceFetcher = async () =>
      new Response(`<main>Visible source text.</main>${markup}`, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });

    const report = await runRegulatoryClaimWatch([KNOWN_TARGET], fetcher);

    expect(report.findings).toEqual([
      expect.objectContaining({ kind: "locator-missing" }),
    ]);
  });

  test("reports a changed digest for an official downloadable source", async () => {
    const target: RegulatoryClaimTarget = {
      ...KNOWN_TARGET,
      sources: [
        {
          ...KNOWN_TARGET.sources[0]!,
          locator: "Paragraphs (153)–(154), pp. 49–50",
          watch: {
            mode: "digest",
            algorithm: "sha256",
            digest:
              "30861fc5de31205846f023068069c92fabc7271ebeac6af7bef68b97f0a33f66",
            reason: "The official source is a PDF.",
          },
        },
      ],
    };
    const fetcher: SourceFetcher = async () =>
      new Response("changed document", {
        status: 200,
        headers: { "content-type": "application/pdf" },
      });

    const report = await runRegulatoryClaimWatch([target], fetcher);

    expect(report.findings).toEqual([
      expect.objectContaining({
        kind: "digest-changed",
        detail: expect.stringContaining("official downloadable source changed"),
      }),
    ]);
  });

  test("reports a target that declares no primary source", async () => {
    const noSource = { ...KNOWN_TARGET, sources: [] };
    const fetcher: SourceFetcher = async () =>
      new Response("unused", { status: 200 });

    const report = await runRegulatoryClaimWatch([noSource], fetcher);

    expect(report.checkedSources).toBe(0);
    expect(report.findings).toEqual([
      expect.objectContaining({
        kind: "source-missing",
        targetId: KNOWN_TARGET.id,
      }),
    ]);
  });

  test("reports public-source fetch failures without throwing", async () => {
    const fetcher: SourceFetcher = async () => {
      throw new Error("network unavailable");
    };

    const report = await runRegulatoryClaimWatch([KNOWN_TARGET], fetcher);

    expect(report.findings).toEqual([
      expect.objectContaining({
        kind: "fetch-failed",
        detail: "network unavailable",
      }),
    ]);
  });

  test("reports a body that stalls after headers instead of hanging the advisory run", async () => {
    const fetcher: SourceFetcher = async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start() {
            // Deliberately never enqueue or close: headers arrive, the body does not.
          },
        }),
        {
          status: 200,
          headers: { "content-type": "text/plain" },
        },
      );

    const report = await runRegulatoryClaimWatch([KNOWN_TARGET], fetcher, {
      bodyTimeoutMs: 20,
    });

    expect(report.findings).toEqual([
      expect.objectContaining({
        kind: "fetch-failed",
        detail: expect.stringContaining("body read exceeded"),
      }),
    ]);
  });

  test("reports a body that exceeds the declared byte cap", async () => {
    const fetcher: SourceFetcher = async () =>
      new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      });

    const report = await runRegulatoryClaimWatch([KNOWN_TARGET], fetcher, {
      maxBodyBytes: 3,
    });

    expect(report.findings).toEqual([
      expect.objectContaining({
        kind: "fetch-failed",
        detail: expect.stringContaining("body exceeded 3 byte limit"),
      }),
    ]);
  });

  test("cancels a non-success response body before reporting its status", async () => {
    let cancelled = false;
    const fetcher: SourceFetcher = async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start() {
            // Keep the stream open until the watch explicitly cancels it.
          },
          cancel() {
            cancelled = true;
          },
        }),
        {
          status: 404,
          headers: { "content-type": "text/plain" },
        },
      );

    const report = await runRegulatoryClaimWatch([KNOWN_TARGET], fetcher);

    expect(cancelled).toBe(true);
    expect(report.findings).toEqual([
      expect.objectContaining({ kind: "http-error" }),
    ]);
  });

  test.each(["Application/PDF", "Application/Octet-Stream"])(
    "classifies mixed-case binary media type %s for manual review",
    async (contentType) => {
      const fetcher: SourceFetcher = async () =>
        new Response(new Uint8Array([37, 80, 68, 70]), {
          status: 200,
          headers: { "content-type": contentType },
        });

      const report = await runRegulatoryClaimWatch([KNOWN_TARGET], fetcher);

      expect(report.findings).toEqual([
        expect.objectContaining({ kind: "manual-review" }),
      ]);
    },
  );

  test("rejects redirects outside the declared HTTPS host set before a second request", async () => {
    let fetches = 0;
    const fetcher = createPublicSourceFetcher(
      KNOWN_TARGET.sources,
      async (_url, init) => {
        fetches++;
        expect(init.redirect).toBe("manual");
        return new Response(null, {
          status: 302,
          headers: { location: "http://127.0.0.1/latest/meta-data" },
        });
      },
    );

    const report = await runRegulatoryClaimWatch([KNOWN_TARGET], fetcher);

    expect(fetches).toBe(1);
    expect(report.findings).toEqual([
      expect.objectContaining({
        kind: "fetch-failed",
        detail: expect.stringContaining("redirect target must use https"),
      }),
    ]);
  });

  test("rejects credential-bearing redirect targets before a second request", async () => {
    let fetches = 0;
    const fetcher = createPublicSourceFetcher(
      KNOWN_TARGET.sources,
      async () => {
        fetches++;
        return new Response(null, {
          status: 302,
          headers: {
            location: "https://user:password@example.com/source",
          },
        });
      },
    );

    const report = await runRegulatoryClaimWatch([KNOWN_TARGET], fetcher);

    expect(fetches).toBe(1);
    expect(report.findings).toEqual([
      expect.objectContaining({
        kind: "fetch-failed",
        detail: expect.stringContaining(
          "redirect target must not contain credentials",
        ),
      }),
    ]);
  });

  test("rejects non-default HTTPS redirect ports before a second request", async () => {
    let fetches = 0;
    const fetcher = createPublicSourceFetcher(
      KNOWN_TARGET.sources,
      async () => {
        fetches++;
        return new Response(null, {
          status: 302,
          headers: { location: "https://example.com:8443/source" },
        });
      },
    );

    const report = await runRegulatoryClaimWatch([KNOWN_TARGET], fetcher);

    expect(fetches).toBe(1);
    expect(report.findings).toEqual([
      expect.objectContaining({
        kind: "fetch-failed",
        detail: expect.stringContaining(
          "redirect target must use the default https port",
        ),
      }),
    ]);
  });

  test("rejects a sixth validated redirect instead of following indefinitely", async () => {
    let fetches = 0;
    const fetcher = createPublicSourceFetcher(
      KNOWN_TARGET.sources,
      async () => {
        fetches++;
        return new Response(null, {
          status: 302,
          headers: { location: `/redirect-${String(fetches)}` },
        });
      },
    );

    const report = await runRegulatoryClaimWatch([KNOWN_TARGET], fetcher);

    expect(fetches).toBe(6);
    expect(report.findings).toEqual([
      expect.objectContaining({
        kind: "fetch-failed",
        detail: expect.stringContaining("exceeded 5 validated redirects"),
      }),
    ]);
  });

  test("rejects a transport that auto-follows redirects", async () => {
    let fetches = 0;
    const fetcher = createPublicSourceFetcher(
      KNOWN_TARGET.sources,
      async () => {
        fetches++;
        const response = new Response("unexpected final response", {
          status: 200,
        });
        Object.defineProperties(response, {
          redirected: { value: true },
          url: { value: "https://example.com/final" },
        });
        return response;
      },
    );

    const report = await runRegulatoryClaimWatch([KNOWN_TARGET], fetcher);

    expect(fetches).toBe(1);
    expect(report.findings).toEqual([
      expect.objectContaining({
        kind: "fetch-failed",
        detail: expect.stringContaining(
          "source transport followed an unvalidated redirect",
        ),
      }),
    ]);
  });

  test("rejects IP-literal source hosts before issuing a request", async () => {
    let fetches = 0;
    const privateTarget: RegulatoryClaimTarget = {
      ...KNOWN_TARGET,
      sources: [
        {
          ...KNOWN_TARGET.sources[0]!,
          url: "https://127.0.0.1/source",
        },
      ],
    };
    expect(() =>
      createPublicSourceFetcher(privateTarget.sources, async () => {
        fetches++;
        return new Response("unreachable");
      }),
    ).toThrow("source host must not be an IP literal");
    expect(fetches).toBe(0);
  });

  test.each(["[::1]", "[::ffff:127.0.0.1]", "[2606:4700:4700::1111]"])(
    "rejects IPv6-literal source host %s before issuing a request",
    async (host) => {
      let fetches = 0;
      const literalTarget: RegulatoryClaimTarget = {
        ...KNOWN_TARGET,
        sources: [
          {
            ...KNOWN_TARGET.sources[0]!,
            url: `https://${host}/source`,
          },
        ],
      };
      expect(() =>
        createPublicSourceFetcher(literalTarget.sources, async () => {
          fetches++;
          return new Response("unreachable");
        }),
      ).toThrow("source host must not be an IP literal");
      expect(fetches).toBe(0);
    },
  );

  test("rejects an IPv6-literal redirect before issuing a second request", async () => {
    let fetches = 0;
    const fetcher = createPublicSourceFetcher(
      KNOWN_TARGET.sources,
      async () => {
        fetches++;
        return new Response(null, {
          status: 302,
          headers: { location: "https://[::1]/latest/meta-data" },
        });
      },
    );

    const report = await runRegulatoryClaimWatch([KNOWN_TARGET], fetcher);

    expect(fetches).toBe(1);
    expect(report.findings).toEqual([
      expect.objectContaining({
        kind: "fetch-failed",
        detail: expect.stringContaining(
          "redirect target host must not be an IP literal",
        ),
      }),
    ]);
  });

  test("fetches a shared declared source once across all watched surfaces", async () => {
    let fetches = 0;
    const fetcher: SourceFetcher = async () => {
      fetches++;
      return new Response("Article 50", {
        status: 200,
        headers: { "content-type": "text/plain" },
      });
    };

    const report = await runRegulatoryClaimWatch(
      [
        KNOWN_TARGET,
        { ...KNOWN_TARGET, id: "second", route: "/fixture/second" },
      ],
      fetcher,
    );

    expect(report.checkedSources).toBe(2);
    expect(report.findings).toEqual([]);
    expect(fetches).toBe(1);
  });
});

describe("regulatory-claim-watch workflow posture", () => {
  test("a command failure produces an explicit non-PASS artifact while exiting zero", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "caisson-regulatory-watch-"));
    try {
      const reportPath = join(tempDir, "report.md");
      const process = Bun.spawn(
        [
          WORKFLOW_WRAPPER,
          reportPath,
          "bash",
          "-c",
          "printf 'runtime diagnostic\\n' >&2; exit 7",
        ],
        {
          stdout: "pipe",
          stderr: "pipe",
        },
      );

      expect(await process.exited).toBe(0);
      const report = await readFile(reportPath, "utf8");
      expect(report.startsWith("## Regulatory claim watch — report-only")).toBe(
        true,
      );
      expect(report).toContain("Watch failed before producing a report.");
      expect(report).toContain("No PASS is implied.");
      expect(report).toContain("runtime diagnostic");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("empty command output produces an explicit non-PASS artifact while exiting zero", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "caisson-regulatory-watch-"));
    try {
      const reportPath = join(tempDir, "report.md");
      const process = Bun.spawn([WORKFLOW_WRAPPER, reportPath, "true"], {
        stdout: "pipe",
        stderr: "pipe",
      });

      expect(await process.exited).toBe(0);
      const report = await readFile(reportPath, "utf8");
      expect(report).toContain("Watch produced no report.");
      expect(report).toContain("No PASS is implied.");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("unframed command output cannot masquerade as a watch report", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "caisson-regulatory-watch-"));
    try {
      const reportPath = join(tempDir, "report.md");
      const process = Bun.spawn(
        [
          WORKFLOW_WRAPPER,
          reportPath,
          "bash",
          "-c",
          "printf 'install output\n'",
        ],
        {
          stdout: "pipe",
          stderr: "pipe",
        },
      );

      expect(await process.exited).toBe(0);
      const report = await readFile(reportPath, "utf8");
      expect(report).toContain("Watch output was not a framed report.");
      expect(report).toContain("No PASS is implied.");
      expect(report).not.toContain("install output");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("stays weekly, dispatchable, read-only, report-only, and secret-free", async () => {
    const workflow = await Bun.file(
      join(REPO_ROOT, ".github/workflows/regulatory-claim-watch.yml"),
    ).text();

    expect(workflow).toContain("workflow_dispatch");
    expect(workflow).toContain("schedule:");
    expect(workflow).toContain('cron: "23 5 * * 0"');
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("report-only");
    expect(workflow).toContain("shell: bash");
    expect(workflow).toContain("run-regulatory-claim-watch.sh");
    expect(workflow).toContain("initialize advisory report");
    expect(workflow).toContain("continue-on-error: true");
    expect(workflow).toContain("if: always()");
    expect(workflow).toContain("timeout --kill-after=15s 8m");
    expect(workflow).toContain("- name: install workspace deps");
    expect(workflow).toContain("INSTALL_OUTCOME");
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).not.toContain("bash -c 'bun install");
    expect(workflow).not.toContain("| tee");
    expect(workflow).not.toContain("secrets.");
  });
});
