// The OPERATOR recorder (CAISSON-101) — NEVER runs in CI. Captures a sanitized cassette per watcher
// against the live world so the offline replay lane can grade real briefs. Usage:
//
//   bun run src/eval/record.cli.ts [watcher ...]     # default: every watcher in WATCHERS
//
// It walks each watcher against a RECORDING fetch wrapper (captures method/url/status/content-type/
// body — never request headers) and a READ-ONLY store wrapper (captures the watch_state it reads;
// setWatchState is a no-op so the live daemon's baselines are never advanced), then computes the
// CANONICAL findings by replaying over the scrubbed exchanges (so the recorded findings are byte-
// identical to what the eval lane will reproduce), judges each finding with one OpenRouter call, and
// writes a scrub-gated cassette to services/intel/__cassettes__/<watcher>.json.
//
// Requires OPENROUTER_API_KEY (the judge leg). After recording: BLESS=1 bun run eval to mint the
// baseline, then commit both. See intel-briefs.eval.test.ts for the full operator contract.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { fetchWithTimeout } from "@caisson/kernel";
import { judgeVerdictSchema } from "@caisson/ai-evals";
import type { JudgeVerdict } from "@caisson/ai-evals";
import { loadConfig } from "../config.ts";
import type { Config } from "../config.ts";
import { parseFinding } from "../finding.ts";
import type { Finding } from "../finding.ts";
import { fetchJson } from "../http.ts";
import type { Fetcher } from "../http.ts";
import { logger } from "../logger.ts";
import { PostgresStore } from "../store.ts";
import type { Store, UpsertResult } from "../store.ts";
import { findWatcher, WATCHERS } from "../watchers/index.ts";
import type { Watcher } from "../watchers/types.ts";
import { assertScrubbed, parseCassetteFile, scrubText } from "./cassette.ts";
import type {
  CassetteConfig,
  CassetteExchange,
  IntelCassette,
} from "./cassette.ts";
import { ACTIONABILITY_CRITERIA } from "./rubric.ts";
import { replayWatcher } from "./harness.ts";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const JUDGE_TIMEOUT_MS = 60_000;
const DEFAULT_JUDGE_MODEL = "anthropic/claude-sonnet-4.5";
const OUT_DIR = join(import.meta.dir, "..", "..", "__cassettes__");

/**
 * A read-only store wrapper over the LIVE store. `getWatchState` passes through and captures what was
 * read (that becomes the cassette's watchState). `setWatchState` is a RECORDED NO-OP: advancing the
 * live daemon's baselines here would make its next real tick MISS the very change this recording just
 * consumed. Watchers only ever touch watch_state (the types.ts contract), so every other Store method
 * throws-if-called — a loud signal that a watcher grew a new side effect the recorder must handle.
 */
class RecordingStore implements Store {
  readonly reads: Record<string, string> = {};
  constructor(private readonly inner: Store) {}

  async getWatchState(keys: string[]): Promise<Record<string, string>> {
    const state = await this.inner.getWatchState(keys);
    Object.assign(this.reads, state);
    return state;
  }
  setWatchState(): Promise<void> {
    return Promise.resolve();
  }
  upsertFinding(): Promise<UpsertResult> {
    return this.reject("upsertFinding");
  }
  openIncidentKeys(): Promise<string[]> {
    return this.reject("openIncidentKeys");
  }
  countNewFindings(): Promise<number> {
    return this.reject("countNewFindings");
  }
  startRun(): Promise<string> {
    return this.reject("startRun");
  }
  finishRun(): Promise<void> {
    return this.reject("finishRun");
  }
  pruneRuns(): Promise<void> {
    return this.reject("pruneRuns");
  }
  checkRoleIsolation(): Promise<boolean> {
    return this.reject("checkRoleIsolation");
  }
  close(): Promise<void> {
    return this.inner.close();
  }
  private reject<T>(method: string): Promise<T> {
    return Promise.reject(
      new Error(
        `recorder: watcher unexpectedly called store.${method} — only watch_state is recordable`,
      ),
    );
  }
}

/** A recording fetch wrapper: delegates to the real `fetchWithTimeout`, captures the exchange, and
 *  returns the ORIGINAL response (a clone is read for the body so the watcher still consumes its own).
 *  Request headers are never captured — they carry Bearer tokens. */
function recordingFetcher(exchanges: CassetteExchange[]): Fetcher {
  return async (input, init = {}, opts) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const method = (init.method ?? "GET").toUpperCase();
    const res = await fetchWithTimeout(input, init, opts);
    const body = await res.clone().text();
    const contentType = res.headers.get("content-type");
    exchanges.push({
      method,
      url,
      status: res.status,
      ...(contentType !== null ? { contentType } : {}),
      body,
    });
    return res;
  };
}

const chatResponseSchema = z.object({
  choices: z
    .array(z.object({ message: z.object({ content: z.string() }) }))
    .min(1),
});

/** Judge one finding's actionability with a single OpenRouter call. Fail-closed: a non-JSON or
 *  schema-invalid reply THROWS rather than recording a phantom verdict. */
async function judgeFinding(
  finding: Finding,
  apiKey: string,
  model: string,
): Promise<JudgeVerdict> {
  const prompt = [
    ACTIONABILITY_CRITERIA,
    "",
    'Respond with STRICT JSON ONLY: {"verdict":"pass"|"fail","score":<number 0..1>,"rationale":"<one sentence>"}.',
    "",
    `SOURCE: ${finding.source} / ${finding.kind}`,
    `TITLE: ${finding.title}`,
    `BRIEF: ${finding.body}`,
  ].join("\n");

  const raw = await fetchJson<unknown>(
    fetchWithTimeout,
    OPENROUTER_ENDPOINT,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    },
    JUDGE_TIMEOUT_MS,
  );

  const parsedResponse = chatResponseSchema.safeParse(raw);
  const content = parsedResponse.success
    ? parsedResponse.data.choices[0]?.message.content
    : undefined;
  if (content === undefined) {
    throw new Error(
      `judge returned no message content for finding "${finding.dedupKey}"`,
    );
  }
  let json: unknown;
  try {
    json = JSON.parse(content.trim());
  } catch {
    throw new Error(
      `judge returned non-JSON for finding "${finding.dedupKey}"`,
    );
  }
  return judgeVerdictSchema.parse(json);
}

/** The secret VALUES that must never survive into a written cassette. */
function collectSecrets(config: Config): string[] {
  return [
    config.githubToken,
    config.posthogApiKey,
    config.plausibleApiKey,
    config.openrouterApiKey,
    config.linearApiKey,
    config.tgBridgeAlertToken,
    // A Discord webhook URL embeds its auth token in the path — a secret VALUE, not just config.
    config.discordOpsWebhookUrl,
    config.databaseUrl,
  ].filter((s): s is string => typeof s === "string" && s.length > 0);
}

/** The non-secret config the watcher saw, plus the boolean creds-present markers. */
function cassetteConfigOf(config: Config): CassetteConfig {
  return {
    competitorUrls: config.competitorUrls,
    githubOrg: config.githubOrg,
    posthogApiHost: config.posthogApiHost,
    posthogProjectId: config.posthogProjectId,
    plausibleApiHost: config.plausibleApiHost,
    ...(config.plausibleSiteId !== undefined
      ? { plausibleSiteId: config.plausibleSiteId }
      : {}),
    credsPresent: {
      githubToken: config.githubToken !== undefined,
      posthogApiKey: config.posthogApiKey !== undefined,
      plausibleApiKey: config.plausibleApiKey !== undefined,
    },
  };
}

function scrubExchange(
  ex: CassetteExchange,
  secrets: readonly string[],
): CassetteExchange {
  return {
    ...ex,
    url: scrubText(ex.url, secrets),
    body: scrubText(ex.body, secrets),
  };
}

function scrubFinding(f: Finding, secrets: readonly string[]): Finding {
  const payload = JSON.parse(
    scrubText(JSON.stringify(f.payload), secrets),
  ) as Record<string, unknown>;
  return {
    ...f,
    title: scrubText(f.title, secrets),
    body: scrubText(f.body, secrets),
    payload,
  };
}

/** Record one watcher to a cassette on disk. */
async function recordWatcher(
  watcher: Watcher,
  config: Config,
  inner: Store,
  recordedAt: string,
  judgeApiKey: string,
  judgeModel: string,
): Promise<void> {
  const nowMs = Date.parse(recordedAt);
  const secrets = collectSecrets(config);
  // llmEnabled forced OFF on the ctx config: the cassette records PRE-enrichment findings so replay
  // stays deterministic (enrichment is a separate token-spending seam).
  const recordConfig: Config = { ...config, llmEnabled: false };

  // Pass 1 — walk the live world, capturing exchanges + the watch_state the watcher reads.
  const store = new RecordingStore(inner);
  const rawExchanges: CassetteExchange[] = [];
  await watcher.run({
    config: recordConfig,
    store,
    fetchImpl: recordingFetcher(rawExchanges),
    now: () => nowMs,
    logger,
  });

  // Scrub the exchanges, then derive the CANONICAL findings by replaying over the SCRUBBED exchanges
  // — this is the exact input the eval lane will replay, so the recorded findings are guaranteed to
  // match what accuracy grades (scrubbing that alters a hashed body can't desync recorded vs replay).
  const scrubbedExchanges = rawExchanges.map((ex) =>
    scrubExchange(ex, secrets),
  );
  const preCassette: IntelCassette = {
    schemaVersion: 1,
    watcher: watcher.name,
    recordedAt,
    config: cassetteConfigOf(config),
    watchState: store.reads,
    exchanges: scrubbedExchanges,
    findings: [],
    judge: { model: judgeModel, responses: {} },
  };
  const canonical = (await replayWatcher(preCassette)).map((f) =>
    parseFinding(scrubFinding(f, secrets)),
  );

  // Judge every canonical finding (fail-closed — an invalid verdict throws, never a phantom).
  const responses: Record<string, JudgeVerdict> = {};
  for (const finding of canonical) {
    responses[finding.dedupKey] = await judgeFinding(
      finding,
      judgeApiKey,
      judgeModel,
    );
  }

  const cassette: IntelCassette = {
    ...preCassette,
    findings: canonical,
    judge: { model: judgeModel, responses },
  };
  // Round-trip validate, then serialize, then run the fail-closed scrub gate BEFORE writing.
  const serialized = `${JSON.stringify(parseCassetteFile(cassette), null, 2)}\n`;
  assertScrubbed(serialized, secrets);
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, `${watcher.name}.json`), serialized);
  logger.info("recorded cassette", {
    watcher: watcher.name,
    findings: canonical.length,
    exchanges: scrubbedExchanges.length,
  });
}

export async function main(argv: readonly string[]): Promise<number> {
  const names = argv.length > 0 ? [...argv] : WATCHERS.map((w) => w.name);
  const watchers: Watcher[] = [];
  for (const name of names) {
    const watcher = findWatcher(name);
    if (watcher === undefined) {
      process.stderr.write(`unknown watcher "${name}"\n`);
      return 1;
    }
    watchers.push(watcher);
  }

  const config = loadConfig(process.env);
  const judgeApiKey = config.openrouterApiKey;
  if (judgeApiKey === undefined || judgeApiKey.length === 0) {
    process.stderr.write(
      "record.cli requires OPENROUTER_API_KEY (the judge leg) — set it and re-run\n",
    );
    return 1;
  }
  const judgeModel = process.env.INTEL_EVAL_JUDGE_MODEL ?? DEFAULT_JUDGE_MODEL;
  const recordedAt = new Date().toISOString();

  const inner = new PostgresStore(config.databaseUrl);
  try {
    for (const watcher of watchers) {
      await recordWatcher(
        watcher,
        config,
        inner,
        recordedAt,
        judgeApiKey,
        judgeModel,
      );
    }
  } finally {
    await inner.close();
  }
  return 0;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
