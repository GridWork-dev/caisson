// Report-only regulatory-claim watch. It discovers the two dated EU AI Act framework surfaces
// from their checked-in source plus every WRITING_PIECES record, then checks each declared public
// primary source for HTTP reachability and the record's literal locator.
//
// This is deliberately mechanical: it can catch a removed source, a failed public read, a missing
// source declaration, or a locator that disappeared from HTML/plain text. It cannot interpret a
// changed regulation, decide whether prose remains legally correct, or extract a locator from a
// PDF reliably. Those cases are reported for human review. The CLI catches every failure and
// exits 0 because this weekly lane is advisory, never a merge gate.
import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { fetchWithTimeout } from "@caisson/kernel";

import { WRITING_PIECES, type WritingSource } from "../lib/writing";

const FETCH_TIMEOUT_MS = 30_000;

interface FrameworkTarget {
  id: string;
  route: string;
  sourceFile: string;
  locator: string;
}

const FRAMEWORK_TARGETS: readonly FrameworkTarget[] = [
  {
    id: "framework-eu-ai-act",
    route: "/frameworks/eu-ai-act",
    sourceFile: "apps/site/app/frameworks/eu-ai-act/page.tsx",
    locator: "Article 50",
  },
  {
    id: "framework-eu-ai-act-article-50",
    route: "/frameworks/eu-ai-act/article-50",
    sourceFile: "apps/site/app/frameworks/eu-ai-act/article-50/page.tsx",
    locator: "Article 50",
  },
];

export interface RegulatoryClaimTarget {
  id: string;
  route: string;
  verifiedOn: string;
  sources: readonly WritingSource[];
}

export type RegulatoryWatchFindingKind =
  | "source-missing"
  | "source-invalid"
  | "fetch-failed"
  | "http-error"
  | "locator-missing"
  | "manual-review";

export interface RegulatoryWatchFinding {
  kind: RegulatoryWatchFindingKind;
  targetId: string;
  route: string;
  sourceUrl?: string;
  detail: string;
}

export interface RegulatoryWatchReport {
  checkedSources: number;
  findings: readonly RegulatoryWatchFinding[];
  markdown: string;
}

export type SourceFetcher = (url: string) => Promise<Response>;

function discoverVerificationDate(source: string): string {
  const factsVerified = source.match(
    /facts verified\s+(\d{4}-\d{2}-\d{2})/i,
  )?.[1];
  if (factsVerified) return factsVerified;

  const reportingThrough = source.match(
    /reporting through\s+(\d{4}-\d{2}-\d{2})/i,
  )?.[1];
  return reportingThrough ?? "missing";
}

function trimUrlPunctuation(url: string): string {
  return url.replace(/[),.;:]+$/u, "");
}

function discoverHttpsUrls(source: string): readonly string[] {
  const matches = source.match(/https:\/\/[^\s"'`<>{}\\]+/gu) ?? [];
  return [...new Set(matches.map(trimUrlPunctuation))].sort();
}

function discoverFrameworkTargets(
  repoRoot: string,
): readonly RegulatoryClaimTarget[] {
  return FRAMEWORK_TARGETS.map((target) => {
    const source = readFileSync(join(repoRoot, target.sourceFile), "utf8");
    const urls = discoverHttpsUrls(source);
    return {
      id: target.id,
      route: target.route,
      verifiedOn: discoverVerificationDate(source),
      sources: urls.map((url) => ({
        label: new URL(url).hostname,
        url,
        locator: target.locator,
      })),
    };
  });
}

/** Real-repo discovery. The test suite calls this against the checkout as the known-positive
 * smoke: a regex/path regression that discovers nothing must fail before the workflow can lie. */
export function discoverRegulatoryClaims(
  repoRoot: string,
): readonly RegulatoryClaimTarget[] {
  const frameworkTargets = discoverFrameworkTargets(repoRoot);
  const writingTargets = WRITING_PIECES.map((piece) => ({
    id: `writing-${piece.slug}`,
    route: `/writing/${piece.slug}`,
    verifiedOn: piece.verifiedOn,
    sources: piece.sources,
  }));
  return [...frameworkTargets, ...writingTargets];
}

export function assertKnownPositive(
  targets: readonly RegulatoryClaimTarget[],
): void {
  if (targets.length === 0) {
    throw new Error(
      "regulatory-claim-watch discovered zero regulatory claim targets",
    );
  }
}

function normalizeText(value: string): string {
  return value.replace(/\s+/gu, " ").trim().toLocaleLowerCase("en-US");
}

function findingLine(finding: RegulatoryWatchFinding): string {
  const source = finding.sourceUrl ? ` · ${finding.sourceUrl}` : "";
  return `- **${finding.kind}** · \`${finding.route}\`${source} — ${finding.detail}`;
}

function renderReport(
  targets: readonly RegulatoryClaimTarget[],
  checkedSources: number,
  findings: readonly RegulatoryWatchFinding[],
): string {
  const lines = [
    "## Regulatory claim watch — report-only",
    "",
    `- ${String(targets.length)} dated claim target${targets.length === 1 ? "" : "s"} discovered`,
    `- ${String(checkedSources)} source${checkedSources === 1 ? "" : "s"} checked`,
    `- ${String(findings.length)} finding${findings.length === 1 ? "" : "s"} for review`,
    "",
    "Mechanical scope: public-source reachability and literal locator presence in HTML/plain text.",
    "This report does not interpret legal meaning; PDFs and other non-text sources require manual review.",
  ];

  if (findings.length === 0) {
    lines.push("", "### No mechanical drift detected");
  } else {
    lines.push("", "### Findings", "", ...findings.map(findingLine));
  }

  lines.push(
    "",
    "Advisory only — source availability and findings never block a merge.",
  );
  return lines.join("\n");
}

export async function runRegulatoryClaimWatch(
  targets: readonly RegulatoryClaimTarget[],
  fetcher: SourceFetcher,
): Promise<RegulatoryWatchReport> {
  assertKnownPositive(targets);

  let checkedSources = 0;
  const findings: RegulatoryWatchFinding[] = [];

  for (const target of targets) {
    if (target.sources.length === 0) {
      findings.push({
        kind: "source-missing",
        targetId: target.id,
        route: target.route,
        detail: `No public primary source is declared (verifiedOn: ${target.verifiedOn}).`,
      });
      continue;
    }

    for (const source of target.sources) {
      let parsed: URL;
      try {
        parsed = new URL(source.url);
      } catch {
        findings.push({
          kind: "source-invalid",
          targetId: target.id,
          route: target.route,
          sourceUrl: source.url,
          detail: "Source URL is not parseable.",
        });
        continue;
      }
      if (parsed.protocol !== "https:") {
        findings.push({
          kind: "source-invalid",
          targetId: target.id,
          route: target.route,
          sourceUrl: source.url,
          detail: `Source protocol is ${parsed.protocol}; https is required.`,
        });
        continue;
      }

      checkedSources++;
      try {
        const response = await fetcher(source.url);
        if (!response.ok) {
          findings.push({
            kind: "http-error",
            targetId: target.id,
            route: target.route,
            sourceUrl: source.url,
            detail: `Public source returned HTTP ${String(response.status)}.`,
          });
          continue;
        }

        const contentType = response.headers.get("content-type") ?? "";
        if (
          contentType.includes("application/pdf") ||
          contentType.includes("application/octet-stream")
        ) {
          findings.push({
            kind: "manual-review",
            targetId: target.id,
            route: target.route,
            sourceUrl: source.url,
            detail: `Source is ${contentType || "binary"}; confirm locator "${source.locator}" manually.`,
          });
          continue;
        }

        const body = await response.text();
        if (!normalizeText(body).includes(normalizeText(source.locator))) {
          findings.push({
            kind: "locator-missing",
            targetId: target.id,
            route: target.route,
            sourceUrl: source.url,
            detail: `Declared locator "${source.locator}" was not found in the fetched text.`,
          });
        }
      } catch (error) {
        findings.push({
          kind: "fetch-failed",
          targetId: target.id,
          route: target.route,
          sourceUrl: source.url,
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return {
    checkedSources,
    findings,
    markdown: renderReport(targets, checkedSources, findings),
  };
}

const fetchPublicSource: SourceFetcher = (url) =>
  fetchWithTimeout(
    url,
    {
      headers: {
        Accept:
          "text/html,application/xhtml+xml,text/plain,application/pdf;q=0.8,*/*;q=0.5",
        "User-Agent": "caisson-regulatory-claim-watch/1.0",
      },
    },
    { timeoutMs: FETCH_TIMEOUT_MS },
  );

function writeReport(report: string): void {
  process.stdout.write(`${report}\n`);
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  try {
    appendFileSync(summaryPath, `${report}\n`);
  } catch (error) {
    process.stdout.write(
      `_Could not append GITHUB_STEP_SUMMARY: ${error instanceof Error ? error.message : String(error)}_\n`,
    );
  }
}

async function main(): Promise<void> {
  try {
    const targets = discoverRegulatoryClaims(process.cwd());
    const report = await runRegulatoryClaimWatch(targets, fetchPublicSource);
    writeReport(report.markdown);
  } catch (error) {
    writeReport(
      [
        "## Regulatory claim watch — report-only",
        "",
        `Watch failed before completing (advisory, non-blocking): ${error instanceof Error ? error.message : String(error)}`,
        "",
        "No PASS is implied. Inspect discovery and rerun manually.",
      ].join("\n"),
    );
  }
}

if (import.meta.main) {
  // `main` handles all operational failures and deliberately leaves exitCode at zero: the workflow
  // is advisory, and the report is the output.
  void main();
}
