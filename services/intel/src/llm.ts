// Tier-2 enrichment SEAM — deliberately off by default. Tier-1 detection already produced the
// finding deterministically with zero tokens; this optionally prepends a short LLM analysis to
// the body. It runs ONLY when `INTEL_LLM_ENABLED` is set AND `OPENROUTER_API_KEY` is present, and
// fails soft (any error returns the finding unchanged) — an enrichment outage never drops a
// finding. This is the single place tokens are ever spent.
import { z } from "zod";
import { fetchJson } from "./http.ts";
import type { Fetcher } from "./http.ts";
import type { Config } from "./config.ts";
import type { Finding } from "./finding.ts";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
// OpenRouter completions routinely exceed the shared http.ts default (10s); this is the one
// off-by-default outbound call slow enough to need its own longer budget.
const LLM_TIMEOUT_MS = 60_000;
// The finding's own strict boundary (finding.ts) caps body at 10,000 chars — bound the analysis
// well under that so `${analysis}\n\n${finding.body}` can never itself exceed the cap (an
// oversized composed body would make parseFinding throw and silently DROP the finding it was
// meant to enrich, the inverse of this seam's documented fail-soft promise).
const MAX_ANALYSIS_CHARS = 2_000;
const MAX_FINDING_BODY_CHARS = 10_000;

const ChatResponse = z.object({
  choices: z
    .array(z.object({ message: z.object({ content: z.string() }) }))
    .min(1),
});

/** The analysis prompt for one finding — a one-paragraph, decision-useful read of the signal. */
export function buildEnrichPrompt(finding: Finding): string {
  return [
    "You analyze operator intelligence signals for a software product. In ONE short paragraph,",
    "explain what this change likely means and whether it needs operator attention. Be concrete;",
    "do not speculate beyond the facts given.",
    "",
    `SOURCE: ${finding.source} / ${finding.kind}`,
    `TITLE: ${finding.title}`,
    `DETAIL: ${finding.body}`,
  ].join("\n");
}

async function analyze(
  finding: Finding,
  config: Config,
  apiKey: string,
  fetchImpl: Fetcher,
): Promise<string | null> {
  try {
    const raw = await fetchJson<unknown>(
      fetchImpl,
      OPENROUTER_ENDPOINT,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: config.llmModel,
          messages: [{ role: "user", content: buildEnrichPrompt(finding) }],
        }),
      },
      LLM_TIMEOUT_MS,
    );
    const parsed = ChatResponse.safeParse(raw);
    if (!parsed.success) return null;
    const content = parsed.data.choices[0]?.message.content.trim();
    // A prompt-injected "respond with N characters" is data, never executed/fetched/shelled —
    // the only real risk is an oversized string tripping parseFinding's cap downstream and
    // dropping the finding it was meant to enrich. Bound it here regardless of cause.
    return content === undefined || content.length === 0
      ? null
      : content.slice(0, MAX_ANALYSIS_CHARS);
  } catch {
    return null;
  }
}

/** Enrich findings when the seam is armed; a no-op returning the same findings otherwise. */
export async function enrichFindings(
  findings: Finding[],
  config: Config,
  fetchImpl: Fetcher,
): Promise<Finding[]> {
  const apiKey = config.openrouterApiKey;
  if (!config.llmEnabled || apiKey === undefined || apiKey.length === 0)
    return findings;
  return Promise.all(
    findings.map(async (finding) => {
      const analysis = await analyze(finding, config, apiKey, fetchImpl);
      if (analysis === null) return finding;
      // Final defensive cap on the COMPOSED body, independent of the analysis-only cap above —
      // the two bounds are deliberately redundant (belt-and-suspenders on the same failure mode).
      const body = `${analysis}\n\n${finding.body}`.slice(
        0,
        MAX_FINDING_BODY_CHARS,
      );
      return { ...finding, body };
    }),
  );
}
