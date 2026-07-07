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
    const raw = await fetchJson<unknown>(fetchImpl, OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: config.llmModel,
        messages: [{ role: "user", content: buildEnrichPrompt(finding) }],
      }),
    });
    const parsed = ChatResponse.safeParse(raw);
    return parsed.success
      ? (parsed.data.choices[0]?.message.content.trim() ?? null)
      : null;
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
      return analysis === null
        ? finding
        : { ...finding, body: `${analysis}\n\n${finding.body}` };
    }),
  );
}
