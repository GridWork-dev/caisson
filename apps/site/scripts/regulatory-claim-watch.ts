// Report-only regulatory-claim watch. It discovers the two dated EU AI Act framework surfaces
// from their shared source contract plus every WRITING_PIECES record, then checks each declared
// public primary source for HTTP reachability and text evidence where the upstream exposes it.
//
// This is deliberately mechanical: it can catch a removed source, a failed public read, a missing
// source declaration, or a declared watch phrase that disappeared from HTML/plain text. It cannot
// interpret a changed regulation, decide whether prose remains legally correct, bypass an upstream
// interstitial, or extract a locator from a PDF reliably. Reachability-only checks are disclosed as
// notes, not mislabeled as legal verification. The CLI catches every failure and exits 0 because
// this weekly lane is advisory, never a merge gate.
import { appendFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { isAbsolute, resolve, sep } from "node:path";
import { Parser } from "htmlparser2";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { fetchWithTimeout } from "@caisson/kernel";

import EuAiActPage from "../app/frameworks/eu-ai-act/page";
import Article50Page from "../app/frameworks/eu-ai-act/article-50/page";
import {
  ARTICLE_50_PRIMARY_SOURCES,
  ARTICLE_50_SUMMARY_SOURCES,
  ARTICLE_50_VERIFIED_ON,
} from "../lib/article-50-sources";
import type { RegulatorySource } from "../lib/regulatory-source";
import { WRITING_PIECES } from "../lib/writing";

const FETCH_TIMEOUT_MS = 30_000;
const BODY_TIMEOUT_MS = 30_000;
const MAX_BODY_BYTES = 32 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

interface FrameworkTarget {
  id: string;
  route: string;
  sourceFile: string;
  page: ComponentType;
  verifiedOn: string;
  sources: readonly RegulatorySource[];
}

const FRAMEWORK_TARGETS: readonly FrameworkTarget[] = [
  {
    id: "framework-eu-ai-act",
    route: "/frameworks/eu-ai-act",
    sourceFile: "apps/site/app/frameworks/eu-ai-act/page.tsx",
    page: EuAiActPage,
    verifiedOn: ARTICLE_50_VERIFIED_ON,
    sources: ARTICLE_50_SUMMARY_SOURCES,
  },
  {
    id: "framework-eu-ai-act-article-50",
    route: "/frameworks/eu-ai-act/article-50",
    sourceFile: "apps/site/app/frameworks/eu-ai-act/article-50/page.tsx",
    page: Article50Page,
    verifiedOn: ARTICLE_50_VERIFIED_ON,
    sources: ARTICLE_50_PRIMARY_SOURCES,
  },
];

export interface RegulatoryClaimTarget {
  id: string;
  route: string;
  verifiedOn: string;
  sources: readonly RegulatorySource[];
}

export type RegulatoryWatchFindingKind =
  | "source-missing"
  | "source-invalid"
  | "fetch-failed"
  | "http-error"
  | "locator-missing"
  | "digest-changed"
  | "manual-review";

export interface RegulatoryWatchFinding {
  kind: RegulatoryWatchFindingKind;
  targetId: string;
  route: string;
  sourceUrl?: string;
  detail: string;
}

export interface RegulatoryWatchNote {
  kind: "reachability-only";
  targetId: string;
  route: string;
  sourceUrl: string;
  detail: string;
}

export interface RegulatoryWatchReport {
  checkedSources: number;
  findings: readonly RegulatoryWatchFinding[];
  notes: readonly RegulatoryWatchNote[];
  markdown: string;
}

export type SourceFetcher = (url: string) => Promise<Response>;
type PublicSourceTransport = (
  url: string,
  init: RequestInit,
) => Promise<Response>;

export interface RegulatoryWatchOptions {
  bodyTimeoutMs?: number;
  maxBodyBytes?: number;
}

/** Real-repo discovery. The test suite calls this against the checkout as the known-positive
 * smoke: a registry regression that discovers nothing must fail before the workflow can lie. */
export function discoverRegulatoryClaims(
  repoRoot: string,
): readonly RegulatoryClaimTarget[] {
  const resolvedRoot = resolve(repoRoot);
  const frameworkTargets = FRAMEWORK_TARGETS.map((target) => {
    if (isAbsolute(target.sourceFile)) {
      throw new Error(
        `regulatory-claim-watch framework source path must be relative: ${target.sourceFile}`,
      );
    }
    const sourcePath = resolve(resolvedRoot, target.sourceFile);
    if (
      sourcePath !== resolvedRoot &&
      !sourcePath.startsWith(`${resolvedRoot}${sep}`)
    ) {
      throw new Error(
        `regulatory-claim-watch framework source escapes repository root: ${target.sourceFile}`,
      );
    }
    // File existence/containment remains a discovery invariant. Linkage is validated against the
    // rendered disclosure so comments, dead expressions, and unused imports cannot false-green it.
    readFileSync(sourcePath, "utf8");
    const renderedMarkup = renderToStaticMarkup(createElement(target.page));
    assertFrameworkSourceLinkage(
      target.route,
      renderedMarkup,
      target.verifiedOn,
      target.sources,
    );
    return {
      id: target.id,
      route: target.route,
      verifiedOn: target.verifiedOn,
      sources: target.sources,
    };
  });
  const writingTargets = WRITING_PIECES.map((piece) => ({
    id: `writing-${piece.slug}`,
    route: `/writing/${piece.slug}`,
    verifiedOn: piece.verifiedOn,
    sources: piece.sources,
  }));
  const targets = [...frameworkTargets, ...writingTargets];
  assertKnownPositive(targets, { requireCanonicalTargets: true });
  return targets;
}

export function assertFrameworkSourceLinkage(
  route: string,
  renderedMarkup: string,
  verifiedOn: string,
  sources: readonly RegulatorySource[],
): void {
  for (const source of sources) {
    const escapedUrl = escapeRenderedValue(source.url);
    if (!renderedMarkup.includes(`href="${escapedUrl}"`)) {
      throw new Error(
        `regulatory-claim-watch target ${route} does not render declared source ${source.url}`,
      );
    }
    const escapedLocator = escapeRenderedValue(source.locator);
    if (!renderedMarkup.includes(escapedLocator)) {
      throw new Error(
        `regulatory-claim-watch target ${route} does not render declared source locator ${source.locator}`,
      );
    }
  }
  if (!renderedMarkup.includes(verifiedOn)) {
    throw new Error(
      `regulatory-claim-watch target ${route} does not render verification stamp ${verifiedOn}`,
    );
  }
}

function escapeRenderedValue(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function assertKnownPositive(
  targets: readonly RegulatoryClaimTarget[],
  options: { requireCanonicalTargets?: boolean } = {},
): void {
  if (targets.length === 0) {
    throw new Error(
      "regulatory-claim-watch discovered zero regulatory claim targets",
    );
  }
  if (!options.requireCanonicalTargets) return;

  const targetIds = new Set(targets.map((target) => target.id));
  for (const frameworkTarget of FRAMEWORK_TARGETS) {
    if (!targetIds.has(frameworkTarget.id)) {
      throw new Error(
        `regulatory-claim-watch missing canonical target ${frameworkTarget.id}`,
      );
    }
  }
  if (!targets.some((target) => target.id.startsWith("writing-"))) {
    throw new Error("regulatory-claim-watch discovered zero writing targets");
  }
}

function normalizeText(value: string): string {
  return value.replace(/\s+/gu, " ").trim().toLocaleLowerCase("en-US");
}

const NON_VISIBLE_HTML_TAGS = new Set([
  "head",
  "input",
  "noscript",
  "script",
  "style",
  "template",
]);

function hasHiddenStyle(style: string | undefined): boolean {
  if (style === undefined) return false;
  const declarations = style.toLocaleLowerCase("en-US").replace(/\s+/gu, "");
  return (
    declarations.includes("display:none") ||
    declarations.includes("visibility:hidden")
  );
}

function isNonVisibleElement(
  tagName: string,
  attributes: Readonly<Record<string, string>>,
): boolean {
  return (
    NON_VISIBLE_HTML_TAGS.has(tagName.toLocaleLowerCase("en-US")) ||
    Object.hasOwn(attributes, "hidden") ||
    Object.hasOwn(attributes, "inert") ||
    attributes["aria-hidden"]?.toLocaleLowerCase("en-US") === "true" ||
    hasHiddenStyle(attributes.style)
  );
}

function extractVisibleHtmlText(markup: string): string {
  const chunks: string[] = [];
  let nonVisibleDepth = 0;
  const parser = new Parser(
    {
      onopentag(tagName, attributes) {
        if (nonVisibleDepth > 0) {
          nonVisibleDepth++;
          return;
        }
        if (isNonVisibleElement(tagName, attributes)) {
          nonVisibleDepth = 1;
          return;
        }
        chunks.push(" ");
      },
      ontext(text) {
        if (nonVisibleDepth === 0) chunks.push(text);
      },
      onclosetag() {
        if (nonVisibleDepth > 0) {
          nonVisibleDepth--;
          return;
        }
        chunks.push(" ");
      },
    },
    { decodeEntities: true },
  );
  parser.end(markup);
  return chunks.join("");
}

function findingLine(finding: RegulatoryWatchFinding): string {
  const source = finding.sourceUrl ? ` · ${finding.sourceUrl}` : "";
  return `- **${finding.kind}** · \`${finding.route}\`${source} — ${finding.detail}`;
}

function noteLine(note: RegulatoryWatchNote): string {
  return `- **${note.kind}** · \`${note.route}\` · ${note.sourceUrl} — ${note.detail}`;
}

function renderReport(
  targets: readonly RegulatoryClaimTarget[],
  checkedSources: number,
  findings: readonly RegulatoryWatchFinding[],
  notes: readonly RegulatoryWatchNote[],
): string {
  const lines = [
    "## Regulatory claim watch — report-only",
    "",
    `- ${String(targets.length)} dated claim target${targets.length === 1 ? "" : "s"} discovered`,
    `- ${String(checkedSources)} source${checkedSources === 1 ? "" : "s"} checked`,
    `- ${String(findings.length)} finding${findings.length === 1 ? "" : "s"} for review`,
    "",
    "Mechanical scope: public-source reachability and declared watch-text presence where upstream text is observable.",
    "This report does not interpret legal meaning; precise human-review locators remain attached to every source.",
  ];

  if (findings.length === 0) {
    lines.push("", "### No mechanical drift detected");
  } else {
    lines.push("", "### Findings", "", ...findings.map(findingLine));
  }

  if (notes.length > 0) {
    lines.push("", "### Reachability-only checks", "", ...notes.map(noteLine));
  }

  lines.push(
    "",
    "Advisory only — source availability and findings never block a merge.",
  );
  return lines.join("\n");
}

interface SourceSnapshot {
  ok: boolean;
  status: number;
  contentType: string;
  body: Uint8Array;
}

async function readResponseBody(
  response: Response,
  { bodyTimeoutMs, maxBodyBytes }: Required<RegulatoryWatchOptions>,
): Promise<Uint8Array> {
  if (response.body === null) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          `source body read exceeded ${String(bodyTimeoutMs)}ms deadline`,
        ),
      );
    }, bodyTimeoutMs);
  });

  try {
    while (true) {
      const result = await Promise.race([reader.read(), deadline]);
      if (result.done) break;
      totalBytes += result.value.byteLength;
      if (totalBytes > maxBodyBytes) {
        throw new Error(
          `source body exceeded ${String(maxBodyBytes)} byte limit`,
        );
      }
      chunks.push(result.value);
    }
  } catch (error) {
    // Cancel the underlying stream so a source that sent headers and then stalled cannot retain
    // the connection after the report has classified the read as failed.
    void reader.cancel(error).catch(() => undefined);
    throw error;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

async function fetchSourceSnapshot(
  fetcher: SourceFetcher,
  url: string,
  options: Required<RegulatoryWatchOptions>,
): Promise<SourceSnapshot> {
  const response = await fetcher(url);
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok) {
    await discardResponseBody(response);
    return {
      ok: false,
      status: response.status,
      contentType,
      body: new Uint8Array(),
    };
  }
  return {
    ok: true,
    status: response.status,
    contentType,
    body: await readResponseBody(response, options),
  };
}

type SourceUrlKind = "source" | "redirect target" | "response";

function normalizedIpHostname(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
}

function assertSafeSourceUrl(url: URL, kind: SourceUrlKind): void {
  const ipHostname = normalizedIpHostname(url.hostname);
  if (url.protocol !== "https:") {
    throw new Error(`${kind} must use https: ${url.href}`);
  }
  if (url.username !== "" || url.password !== "") {
    throw new Error(`${kind} must not contain credentials: ${url.href}`);
  }
  if (url.port !== "" && url.port !== "443") {
    throw new Error(`${kind} must use the default https port: ${url.href}`);
  }
  if (isIP(ipHostname) !== 0) {
    throw new Error(`${kind} host must not be an IP literal: ${url.hostname}`);
  }
}

function assertTrustedSourceUrl(
  url: URL,
  trustedHosts: ReadonlySet<string>,
  kind: SourceUrlKind,
): void {
  assertSafeSourceUrl(url, kind);
  if (!trustedHosts.has(url.hostname)) {
    throw new Error(
      `${kind} host is outside the declared source set: ${url.hostname}`,
    );
  }
}

async function discardResponseBody(response: Response): Promise<void> {
  if (response.body === null) return;
  await response.body.cancel().catch(() => undefined);
}

/**
 * Build the production fetcher from the checked-in source declarations. Redirects are manual so
 * every hop remains HTTPS and on a non-IP host already present in the declaration set; native
 * redirect following would let an upstream 3xx silently leave that trust boundary.
 */
export function createPublicSourceFetcher(
  sources: readonly RegulatorySource[],
  transport: PublicSourceTransport = (url, init) =>
    fetchWithTimeout(url, init, { timeoutMs: FETCH_TIMEOUT_MS }),
): SourceFetcher {
  const trustedHosts = new Set<string>();
  for (const source of sources) {
    const declaredUrl = new URL(source.url);
    assertSafeSourceUrl(declaredUrl, "source");
    trustedHosts.add(declaredUrl.hostname);
  }

  return async (url) => {
    let current = new URL(url);

    for (
      let redirectCount = 0;
      redirectCount <= MAX_REDIRECTS;
      redirectCount++
    ) {
      assertTrustedSourceUrl(
        current,
        trustedHosts,
        redirectCount === 0 ? "source" : "redirect target",
      );
      const response = await transport(current.href, {
        redirect: "manual",
        headers: {
          Accept:
            "text/html,application/xhtml+xml,text/plain,application/pdf;q=0.8,*/*;q=0.5",
          "User-Agent": "caisson-regulatory-claim-watch/1.0",
        },
      });

      if (response.url !== "") {
        const responseUrl = new URL(response.url);
        assertTrustedSourceUrl(responseUrl, trustedHosts, "response");
        if (response.redirected || responseUrl.href !== current.href) {
          await discardResponseBody(response);
          throw new Error(
            `source transport followed an unvalidated redirect to ${responseUrl.href}`,
          );
        }
      }

      if (!REDIRECT_STATUSES.has(response.status)) return response;

      const location = response.headers.get("location");
      if (location === null) return response;
      if (redirectCount === MAX_REDIRECTS) {
        await discardResponseBody(response);
        throw new Error(
          `source exceeded ${String(MAX_REDIRECTS)} validated redirects`,
        );
      }

      const next = new URL(location, current);
      assertTrustedSourceUrl(next, trustedHosts, "redirect target");
      await discardResponseBody(response);
      current = next;
    }

    throw new Error("source redirect validation exhausted unexpectedly");
  };
}

export async function runRegulatoryClaimWatch(
  targets: readonly RegulatoryClaimTarget[],
  fetcher: SourceFetcher,
  options: RegulatoryWatchOptions = {},
): Promise<RegulatoryWatchReport> {
  assertKnownPositive(targets);

  const resolvedOptions: Required<RegulatoryWatchOptions> = {
    bodyTimeoutMs: options.bodyTimeoutMs ?? BODY_TIMEOUT_MS,
    maxBodyBytes: options.maxBodyBytes ?? MAX_BODY_BYTES,
  };
  let checkedSources = 0;
  const findings: RegulatoryWatchFinding[] = [];
  const notes: RegulatoryWatchNote[] = [];
  const sourceResponses = new Map<string, Promise<SourceSnapshot>>();

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
        let snapshotPromise = sourceResponses.get(source.url);
        if (snapshotPromise === undefined) {
          snapshotPromise = fetchSourceSnapshot(
            fetcher,
            source.url,
            resolvedOptions,
          );
          sourceResponses.set(source.url, snapshotPromise);
        }
        const snapshot = await snapshotPromise;
        if (!snapshot.ok) {
          findings.push({
            kind: "http-error",
            targetId: target.id,
            route: target.route,
            sourceUrl: source.url,
            detail: `Public source returned HTTP ${String(snapshot.status)}.`,
          });
          continue;
        }

        if (source.watch?.mode === "reachable") {
          notes.push({
            kind: "reachability-only",
            targetId: target.id,
            route: target.route,
            sourceUrl: source.url,
            detail: `${source.watch.reason} Human locator: ${source.locator}`,
          });
          continue;
        }

        if (source.watch?.mode === "digest") {
          const actual = createHash(source.watch.algorithm)
            .update(snapshot.body)
            .digest("hex");
          if (actual !== source.watch.digest) {
            findings.push({
              kind: "digest-changed",
              targetId: target.id,
              route: target.route,
              sourceUrl: source.url,
              detail: `The official downloadable source changed (${source.watch.algorithm}: expected ${source.watch.digest}, received ${actual}). ${source.watch.reason} Human locator: ${source.locator}`,
            });
          }
          continue;
        }

        const contentType = snapshot.contentType.toLocaleLowerCase("en-US");
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

        const decodedBody = new TextDecoder().decode(snapshot.body);
        const body =
          contentType.includes("text/html") ||
          contentType.includes("application/xhtml+xml")
            ? extractVisibleHtmlText(decodedBody)
            : decodedBody;
        const watchTexts =
          source.watch?.mode === "text" ? source.watch.texts : [source.locator];
        // A degenerate watch list asserts NOTHING while still incrementing `checkedSources`, so the
        // report renders an affirmative "no mechanical drift detected" over a source nobody is
        // actually watching. `[]` loops zero times; `[""]` is worse, since `includes("")` is always
        // true. Treat both as a configuration defect rather than a pass — this is the surviving
        // member of the false-green class the earlier fixes in this file were chasing.
        const usableWatchTexts = watchTexts.filter(
          (t) => normalizeText(t).length > 0,
        );
        if (usableWatchTexts.length === 0) {
          findings.push({
            kind: "locator-missing",
            targetId: target.id,
            route: target.route,
            sourceUrl: source.url,
            detail: `Source declares no non-empty watch text (human locator: "${source.locator}"), so this source was fetched but nothing was asserted against it.`,
          });
          continue;
        }
        for (const watchText of usableWatchTexts) {
          if (!normalizeText(body).includes(normalizeText(watchText))) {
            findings.push({
              kind: "locator-missing",
              targetId: target.id,
              route: target.route,
              sourceUrl: source.url,
              detail: `Declared watch text "${watchText}" was not found; human locator: "${source.locator}".`,
            });
          }
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
    notes,
    markdown: renderReport(targets, checkedSources, findings, notes),
  };
}

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
    const report = await runRegulatoryClaimWatch(
      targets,
      createPublicSourceFetcher(targets.flatMap((target) => target.sources)),
    );
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
