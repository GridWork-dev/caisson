// The pay-as-you-go AI-citation probe loop (ADR-0254, gap #9). Probes the 18 canonical
// questions in `docs/gtm/aeo-citation-tracking.md` against 3 OpenRouter-routed engines,
// detects a case-insensitive "caisson"/"caisson.sh" mention, appends a dated snapshot
// section to that doc, and fires one `aeo_citation_probe` PostHog event per probe.
//
// Doctrine note (brief §3): cross-vendor LLM work normally routes through PAL, but PAL is a
// session-time MCP tool and can't run from an unattended cron job — this calls OpenRouter's
// REST API directly with `OPENROUTER_API_KEY`, the same sanctioned egress sink, bypassing
// only the MCP wrapper (same pattern as `gridwork-dream-llm` / `exa-monitors`).
//
// The 18 questions are PARSED from the doc itself at runtime (never hardcoded here) so
// there is exactly one canonical list, per ADR-0254 Decision 2 — amend the doc, not this file.
//
// Usage: bun tooling/scripts/aeo-probe.ts [--dry-run]
// Exit: 0 = ran (or skipped gracefully with no OPENROUTER_API_KEY); 1 = unexpected error.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const REPO_ROOT = join(import.meta.dir, "..", "..");
export const DOC_PATH = join(
  REPO_ROOT,
  "docs",
  "gtm",
  "aeo-citation-tracking.md",
);
const SNAPSHOT_MARKER =
  "<!-- SNAPSHOTS BELOW THIS LINE — append-only, newest at the bottom -->";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

// ponytail: tooling/scripts has no package.json (it's a standalone-script directory, not a
// workspace package — vault-parity-check.ts / sot-check.ts follow the same rule), so it can't
// import @caisson-sh/kernel's fetchWithTimeout. Inline the same AbortController pattern (ADR-0002:
// AbortSignal.timeout() is forbidden on Bun) rather than promote this directory to a package
// for one helper.
async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs = 30_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================================================
// Pure: question parsing (from the canonical doc)
// ============================================================================================

const QUESTION_LINE_RE = /^\d+\.\s+"(.+)"\s*$/;
// The section-3/4 items land inline after a bold heading, e.g. `**AI Production Kit — 3:** 7. "..."`
const INLINE_QUESTION_RE = /\d+\.\s+"([^"]+)"/g;

/** Extract the 18 quoted questions, in order, from the probe-set doc's markdown text. */
export function parseQuestions(mdText: string): string[] {
  const questions: string[] = [];
  for (const line of mdText.split("\n")) {
    const m = QUESTION_LINE_RE.exec(line.trim());
    if (m) {
      questions.push(m[1] as string);
      continue;
    }
    for (const im of line.matchAll(INLINE_QUESTION_RE)) {
      questions.push(im[1] as string);
    }
  }
  return questions;
}

// ============================================================================================
// Pure: engines + request/response shape
// ============================================================================================

export interface Engine {
  slug: string;
  /** Whether to attach the OpenRouter web-search server tool (`:online` + the `web` plugin are
   * deprecated as of 2026 — verified live against openrouter.ai/docs, see the doc's Engines table). */
  useWebSearchTool: boolean;
  mode: string;
}

export const ENGINES: readonly Engine[] = [
  { slug: "openai/gpt-5", useWebSearchTool: true, mode: "web_search" },
  {
    slug: "anthropic/claude-sonnet-5",
    useWebSearchTool: true,
    mode: "web_search",
  },
  { slug: "perplexity/sonar-pro", useWebSearchTool: false, mode: "native" },
];

export function buildRequestBody(
  engine: Engine,
  question: string,
): Record<string, unknown> {
  return {
    model: engine.slug,
    messages: [{ role: "user", content: question }],
    max_tokens: 800,
    ...(engine.useWebSearchTool
      ? { tools: [{ type: "openrouter:web_search" }] }
      : {}),
  };
}

// ponytail: no .strict() — this validates OpenRouter's chat-completions response, a
// third-party API boundary, not our own (matches the precedent in vault-parity-check.ts).
const ChatCompletionSchema = z.object({
  choices: z
    .array(z.object({ message: z.object({ content: z.string().nullable() }) }))
    .min(1),
});

/** Case-insensitive "caisson" mention detector. Returns the sentence carrying the mention
 * (truncated) as evidence, or null when not cited. */
export function detectCitation(text: string): {
  cited: boolean;
  excerpt: string;
} {
  const re = /caisson(\.sh)?/i;
  const match = re.exec(text);
  if (!match) return { cited: false, excerpt: "" };
  // Grab a short window of surrounding text as the evidence excerpt.
  const start = Math.max(0, match.index - 60);
  const end = Math.min(text.length, match.index + match[0].length + 100);
  const excerpt = text.slice(start, end).replace(/\s+/g, " ").trim();
  return { cited: true, excerpt };
}

// ============================================================================================
// Pure: snapshot markdown rendering
// ============================================================================================

export interface ProbeRow {
  index: number;
  question: string;
  engine: string;
  cited: boolean;
  excerpt: string;
}

function renderRows(rows: readonly ProbeRow[]): string[] {
  return rows.map((r) => {
    const truncated =
      r.question.length > 30 ? `${r.question.slice(0, 27)}...` : r.question;
    const excerpt = r.cited ? r.excerpt.replace(/\|/g, "\\|") : "—";
    return `| ${r.index} | ${truncated} | ${r.engine} | ${r.cited ? "yes" : "no"} | ${excerpt} |`;
  });
}

export function renderSnapshotSection(
  date: string,
  engines: readonly Engine[],
  rows: readonly ProbeRow[],
  aiOverviewsNote: string,
  aiOverviewRows: readonly ProbeRow[] = [],
): string {
  const engineList = engines.map((e) => `${e.slug} (${e.mode})`).join(" · ");
  const header = [
    `## ${date} run`,
    "",
    `**Engines:** ${engineList}`,
    `**AI Overviews leg:** ${aiOverviewsNote}`,
    "",
    "| # | Question (truncated) | Engine | Cited | Excerpt |",
    "| - | --------------------- | ------ | ----- | ------- |",
  ];
  const sections = [...header, ...renderRows(rows)];
  if (aiOverviewRows.length > 0) {
    sections.push(
      "",
      "**Google AI Overviews (DataForSEO):**",
      "",
      "| # | Question (truncated) | Engine | Cited | Excerpt |",
      "| - | --------------------- | ------ | ----- | ------- |",
      ...renderRows(aiOverviewRows),
    );
  }
  return sections.join("\n");
}

/** Idempotent per-day insert: if a section for `date` already exists, returns `doc` unchanged
 * (never duplicates a day's snapshot within/across runs). Otherwise appends below the marker. */
export function insertSnapshot(
  doc: string,
  date: string,
  section: string,
): string {
  if (doc.includes(`## ${date} run`)) return doc;
  if (!doc.includes(SNAPSHOT_MARKER)) {
    throw new Error(`snapshot marker not found in ${DOC_PATH}`);
  }
  return doc.replace(SNAPSHOT_MARKER, `${SNAPSHOT_MARKER}\n\n${section}`);
}

// ============================================================================================
// Impure: OpenRouter call + PostHog capture
// ============================================================================================

async function callOpenRouter(
  apiKey: string,
  engine: Engine,
  question: string,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  try {
    const res = await fetchWithTimeout(
      OPENROUTER_ENDPOINT,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(buildRequestBody(engine, question)),
      },
      30_000,
    );
    if (!res.ok) {
      return { ok: false, error: `HTTP ${String(res.status)}` };
    }
    const json = (await res.json()) as unknown;
    const parsed = ChatCompletionSchema.parse(json);
    return { ok: true, text: parsed.choices[0]?.message.content ?? "" };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

const DATAFORSEO_ENDPOINT =
  "https://api.dataforseo.com/v3/serp/google/organic/live/advanced";

/** Optional 4th leg (ADR-0254): Google AI Overviews via DataForSEO's SERP API — the one
 * surface no model API reaches. Gated on DATAFORSEO_LOGIN/PASSWORD; returns null (not run)
 * when either is unset or on any error — this leg never fails the whole probe run. Detects a
 * caisson mention anywhere inside the SERP's `ai_overview` item (schema per
 * docs.dataforseo.com/v3/serp/google/organic/live/advanced — `load_async_ai_overview: true`). */
async function probeAiOverview(
  login: string,
  password: string,
  question: string,
): Promise<{ cited: boolean; excerpt: string } | null> {
  try {
    const auth = Buffer.from(`${login}:${password}`).toString("base64");
    const res = await fetchWithTimeout(
      DATAFORSEO_ENDPOINT,
      {
        method: "POST",
        headers: {
          authorization: `Basic ${auth}`,
          "content-type": "application/json",
        },
        body: JSON.stringify([
          {
            keyword: question,
            location_code: 2840, // United States
            language_code: "en",
            device: "desktop",
            load_async_ai_overview: true,
          },
        ]),
      },
      30_000,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as unknown;
    // ponytail: no zod schema here — this scans the whole task result for an `ai_overview`
    // item and stringifies it for a substring check, rather than asserting DataForSEO's full
    // (large, third-party) result shape. Robust to fields we don't otherwise read.
    const overviewItem = findAiOverviewItem(json);
    if (overviewItem === null) return { cited: false, excerpt: "" };
    return detectCitation(JSON.stringify(overviewItem));
  } catch {
    return null;
  }
}

/** Depth-bounded search for the first `{ type: "ai_overview", ... }` item in a DataForSEO
 * SERP response, without asserting the surrounding shape. */
export function findAiOverviewItem(node: unknown, depth = 0): unknown | null {
  if (depth > 8 || node === null || typeof node !== "object") return null;
  const obj = node as Record<string, unknown>;
  if (obj.type === "ai_overview") return obj;
  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findAiOverviewItem(item, depth + 1);
        if (found !== null) return found;
      }
    } else if (typeof value === "object" && value !== null) {
      const found = findAiOverviewItem(value, depth + 1);
      if (found !== null) return found;
    }
  }
  return null;
}

/** Fire one `aeo_citation_probe` PostHog event. NEVER throws (config-gated, never-throw
 * contract) — an analytics miss must never fail the probe run. */
async function capturePostHogProbe(
  key: string,
  host: string,
  props: { engine: string; query: string; cited: boolean; run_date: string },
): Promise<void> {
  try {
    const res = await fetchWithTimeout(
      `${host}/capture/`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          api_key: key,
          event: "aeo_citation_probe",
          distinct_id: "aeo-probe-loop",
          properties: props,
        }),
      },
      10_000,
    );
    if (!res.ok) {
      process.stderr.write(
        `[aeo-probe] posthog capture non-2xx: ${String(res.status)}\n`,
      );
    }
  } catch {
    process.stderr.write("[aeo-probe] posthog capture failed\n");
  }
}

// ============================================================================================
// Main
// ============================================================================================

async function main(): Promise<void> {
  const dryRun = process.argv.slice(2).includes("--dry-run");

  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (apiKey === undefined || apiKey.length === 0) {
    process.stdout.write(
      "aeo-probe: OPENROUTER_API_KEY not set — skipping gracefully (no-op, exit 0).\n",
    );
    return;
  }

  if (!existsSync(DOC_PATH)) {
    process.stderr.write(`aeo-probe: doc not found at ${DOC_PATH}\n`);
    process.exit(1);
  }
  const doc = readFileSync(DOC_PATH, "utf8");
  const allQuestions = parseQuestions(doc);
  if (allQuestions.length === 0) {
    process.stderr.write(
      "aeo-probe: parsed zero questions from the doc — aborting.\n",
    );
    process.exit(1);
  }
  const questions = dryRun ? allQuestions.slice(0, 1) : allQuestions;

  const posthogKey = process.env.POSTHOG_CAPTURE_KEY?.trim() ?? "";
  const posthogHost = (
    process.env.POSTHOG_CAPTURE_HOST?.trim() || "https://us.i.posthog.com"
  ).replace(/\/+$/, "");

  const dataForSeoLogin = process.env.DATAFORSEO_LOGIN?.trim();
  const dataForSeoPassword = process.env.DATAFORSEO_PASSWORD?.trim();
  const dataForSeoArmed = Boolean(dataForSeoLogin && dataForSeoPassword);

  const date = new Date().toISOString().slice(0, 10);
  const rows: ProbeRow[] = [];
  const aiOverviewRows: ProbeRow[] = [];

  for (const [qi, question] of questions.entries()) {
    for (const engine of ENGINES) {
      const result = await callOpenRouter(apiKey, engine, question);
      const { cited, excerpt } = result.ok
        ? detectCitation(result.text)
        : { cited: false, excerpt: `error: ${result.error}` };
      rows.push({
        index: qi + 1,
        question,
        engine: engine.slug,
        cited,
        excerpt,
      });

      if (posthogKey.length > 0) {
        await capturePostHogProbe(posthogKey, posthogHost, {
          engine: engine.slug,
          query: question,
          cited,
          run_date: date,
        });
      }
    }

    if (dataForSeoArmed) {
      const overview = await probeAiOverview(
        dataForSeoLogin as string,
        dataForSeoPassword as string,
        question,
      );
      if (overview !== null) {
        aiOverviewRows.push({
          index: qi + 1,
          question,
          engine: "google-ai-overview",
          cited: overview.cited,
          excerpt: overview.excerpt,
        });
      }
    }
  }

  const aiOverviewsNote = dataForSeoArmed
    ? `ran ${String(aiOverviewRows.length)}/${String(questions.length)} queries via DataForSEO`
    : "not run (DATAFORSEO_LOGIN/PASSWORD unset)";

  const section = renderSnapshotSection(
    date,
    ENGINES,
    rows,
    aiOverviewsNote,
    aiOverviewRows,
  );
  const updated = insertSnapshot(doc, date, section);
  if (updated === doc) {
    process.stdout.write(
      `aeo-probe: a ${date} snapshot already exists — doc left unchanged (idempotent).\n`,
    );
    return;
  }
  writeFileSync(DOC_PATH, updated, "utf8");
  process.stdout.write(
    `aeo-probe: ${dryRun ? "dry-run " : ""}wrote ${String(rows.length)} rows for ${date} to ${DOC_PATH}\n`,
  );
}

if (import.meta.main) {
  main().catch((err: unknown) => {
    process.stderr.write(`aeo-probe: ${(err as Error).message}\n`);
    process.exit(1);
  });
}
