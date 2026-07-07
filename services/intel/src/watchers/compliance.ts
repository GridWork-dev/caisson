// Compliance-framework watcher: OSCAL + oscal-content release bumps (zero-LLM Atom version
// compare), EU AI Act change detection (content hash over EUR-Lex + the AI Office guidance page),
// and new HHS OCR breach-portal entries (row set-difference). Cadence: daily. SOC 2 is a separate
// monthly watcher. First observation of any source records a silent baseline — only a CHANGE
// against stored state emits a finding.
import {
  contentHash,
  extractTableRows,
  latestAtomTag,
  newItems,
} from "../detect.ts";
import { dedupKey } from "../finding.ts";
import { fetchText } from "../http.ts";
import type { Finding } from "../finding.ts";
import type { Watcher, WatcherCtx } from "./types.ts";

interface Source {
  key: string;
  label: string;
  url: string;
  mode: "atom" | "hash";
}

// Source list is DATA, not logic — tuning a URL is a one-line edit.
// ponytail: the exact EUR-Lex / AI-Office URLs are content-hash targets, so detection is
// URL-agnostic; repoint them here if the official pages move.
const SOURCES: readonly Source[] = [
  {
    key: "oscal",
    label: "NIST OSCAL",
    url: "https://github.com/usnistgov/OSCAL/releases.atom",
    mode: "atom",
  },
  {
    key: "oscal-content",
    label: "NIST OSCAL content",
    url: "https://github.com/usnistgov/oscal-content/releases.atom",
    mode: "atom",
  },
  {
    key: "eu-ai-act-eurlex",
    label: "EU AI Act (EUR-Lex)",
    url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689",
    mode: "hash",
  },
  {
    key: "eu-ai-act-guidance",
    label: "EU AI Act (AI Office guidance)",
    url: "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai",
    mode: "hash",
  },
];

const HIPAA_URL = "https://ocrportal.hhs.gov/ocr/breach/breach_report.jsf";
const HIPAA_STATE_KEY = "compliance:hipaa:ids";

function stateKey(source: Source): string {
  return `compliance:${source.key}:${source.mode === "atom" ? "version" : "hash"}`;
}

/** All the watch_state keys this watcher reads/writes — the store fetches exactly these. */
export function complianceStateKeys(): string[] {
  return [...SOURCES.map(stateKey), HIPAA_STATE_KEY];
}

export interface FetchedSource {
  source: Source;
  text: string;
}

/** Tier-1 detection over the fetched Atom/HTML sources. Pure: fixtures in, findings + next state
 *  out. A source emits only when its stored value exists and differs (baseline-then-change). */
export function detectComplianceChanges(
  fetched: readonly FetchedSource[],
  prev: Record<string, string>,
): { findings: Finding[]; nextState: Record<string, string> } {
  const findings: Finding[] = [];
  const nextState: Record<string, string> = {};
  for (const { source, text } of fetched) {
    const key = stateKey(source);
    const current =
      source.mode === "atom" ? latestAtomTag(text) : contentHash(text);
    if (current === null) continue; // no signal (empty/unparseable feed)
    const before = prev[key];
    if (before !== undefined && before !== current) {
      findings.push({
        source: "compliance",
        kind: source.mode === "atom" ? "framework_release" : "framework_change",
        severity: "info",
        title:
          source.mode === "atom"
            ? `${source.label} released ${current}`
            : `${source.label} guidance changed`,
        body:
          source.mode === "atom"
            ? `${source.label} moved from ${before} to ${current}. Re-check the compliance mappings that cite it.`
            : `${source.label} content changed since the last check. Review the page for updates that affect the compliance mappings.`,
        dedupKey: dedupKey("compliance", source.key, current),
        payload: { url: source.url, previous: before, current },
      });
    }
    nextState[key] = current;
  }
  return { findings, nextState };
}

/** Tier-1 detection for the HHS OCR breach portal: new listing rows since the last run. */
export function detectHipaaBreaches(
  html: string,
  prev: Record<string, string>,
): { findings: Finding[]; nextState: Record<string, string> } {
  const rows = extractTableRows(html);
  const ids = rows.map((r) => contentHash(r));
  let previousIds: string[] = [];
  try {
    const raw: unknown = JSON.parse(prev[HIPAA_STATE_KEY] ?? "[]");
    if (Array.isArray(raw))
      previousIds = raw.filter((v): v is string => typeof v === "string");
  } catch {
    previousIds = [];
  }
  const findings: Finding[] = [];
  const hadBaseline = prev[HIPAA_STATE_KEY] !== undefined;
  const fresh = newItems(previousIds, ids);
  if (hadBaseline && fresh.length > 0) {
    findings.push({
      source: "compliance",
      kind: "hipaa_breach",
      severity: "warning",
      title: `${String(fresh.length)} new HIPAA breach portal ${fresh.length === 1 ? "entry" : "entries"}`,
      body: `The HHS OCR breach portal listing gained ${String(fresh.length)} new ${fresh.length === 1 ? "entry" : "entries"} since the last check — a signal for HIPAA compliance positioning.`,
      dedupKey: dedupKey("compliance", "hipaa", contentHash(fresh.join("|"))),
      payload: { url: HIPAA_URL, newCount: fresh.length },
    });
  }
  return { findings, nextState: { [HIPAA_STATE_KEY]: JSON.stringify(ids) } };
}

async function tryFetch(ctx: WatcherCtx, url: string): Promise<string | null> {
  try {
    return await fetchText(ctx.fetchImpl, url);
  } catch (err) {
    ctx.logger.warn("compliance source fetch failed", {
      url,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export const complianceWatcher: Watcher = {
  name: "compliance",
  cadenceMs: (config) => config.cadenceComplianceMs,
  async run(ctx: WatcherCtx): Promise<Finding[]> {
    const prev = await ctx.store.getWatchState(complianceStateKeys());

    const fetched: FetchedSource[] = [];
    for (const source of SOURCES) {
      const text = await tryFetch(ctx, source.url);
      if (text !== null) fetched.push({ source, text });
    }
    const sourceResult = detectComplianceChanges(fetched, prev);

    const findings = [...sourceResult.findings];
    const nextState = { ...sourceResult.nextState };

    const hipaaHtml = await tryFetch(ctx, HIPAA_URL);
    if (hipaaHtml !== null) {
      const hipaa = detectHipaaBreaches(hipaaHtml, prev);
      findings.push(...hipaa.findings);
      Object.assign(nextState, hipaa.nextState);
    }

    await ctx.store.setWatchState(nextState);
    return findings;
  },
};
