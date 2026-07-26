import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertKnownPositive,
  discoverRegulatoryClaims,
  runRegulatoryClaimWatch,
  type RegulatoryClaimTarget,
  type SourceFetcher,
} from "../scripts/regulatory-claim-watch";

const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));

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
    assertKnownPositive(targets);

    expect(targets.map((target) => target.route)).toContain(
      "/frameworks/eu-ai-act",
    );
    expect(targets.map((target) => target.route)).toContain(
      "/frameworks/eu-ai-act/article-50",
    );
    expect(targets.some((target) => target.route.startsWith("/writing/"))).toBe(
      true,
    );
  });

  test("empty discovery throws instead of producing a false PASS", () => {
    expect(() => assertKnownPositive([])).toThrow(
      "discovered zero regulatory claim targets",
    );
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
});

describe("regulatory-claim-watch workflow posture", () => {
  test("stays weekly, dispatchable, read-only, report-only, and secret-free", async () => {
    const workflow = await Bun.file(
      join(REPO_ROOT, ".github/workflows/regulatory-claim-watch.yml"),
    ).text();

    expect(workflow).toContain("workflow_dispatch");
    expect(workflow).toContain("schedule:");
    expect(workflow).toContain('cron: "23 5 * * 0"');
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("report-only");
    expect(workflow).toContain(
      "bun apps/site/scripts/regulatory-claim-watch.ts",
    );
    expect(workflow).not.toContain("secrets.");
  });
});
