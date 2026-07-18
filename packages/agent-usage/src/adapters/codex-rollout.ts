// The Codex usage adapter (ADR-0360 U-4, AR-3 sibling of agent-trajectory's claude-transcript
// adapter — WRAPPED, not re-homed here: see index.ts). Reads a Codex CLI rollout JSONL file (each
// line `{ timestamp, type, payload }`) into `model.usage` trajectory events, `billingStatus:
// 'estimated'` (real adapter-extracted counts, not yet price-normalized — `priceUsage` in
// normalize.ts is the separate upgrade pass).
//
// Four binding, fixture-proven honesty bars:
//
//   1. Model is LATCHED from the nearest `turn_context.payload.model`; provider is read ONLY from
//      `session_meta.payload.model_provider`. Never hardcoded, never fallback-guessed (the ccusage
//      `gpt-5` display-fallback failure mode is explicitly rejected) — a `token_count` event seen
//      before either is latched is skipped, not attributed to a guess.
//   2. Per-turn usage comes from `last_token_usage` (the delta), never a running sum of the
//      cumulative `total_token_usage` counter (the documented "cumulative trap": summing cumulative
//      snapshots across turns wildly overcounts). `cached_input_tokens` is a SUBSET of
//      `last_token_usage.input_tokens` (OpenAI convention); it is subtracted out so the emitted
//      event uses this package's additive convention — see the comment on `toTrajectoryUsage`.
//   3. `reasoning_output_tokens` is already folded into `output_tokens` and is never re-added.
//   4. A rollout with zero `token_count` events (interactive TUI, a legacy log) yields ZERO usage
//      events and `unsupported: true` on the result — never a zero-valued `estimated` event faking
//      real adapter-extracted counts.
//
// Robustness contract (binding, matches the Claude adapter): a malformed line — invalid JSON, or a
// `token_count` event with no usable usage shape — is SKIPPED and COUNTED, never thrown.
import { TrajectoryEvent, TRAJECTORY_VERSION } from "@caisson/agent-trajectory";

export interface ParseCodexRolloutOptions {
  readonly runId: string;
  /** Event-id factory; defaults to `crypto.randomUUID`. Injected for deterministic tests. */
  readonly eventId?: () => string;
  /** Fallback `occurredAt` when a line has no usable timestamp; defaults to `new Date().toISOString`. */
  readonly now?: () => string;
}

export interface CodexRolloutParseResult {
  /** The `model.usage` events, one per `token_count` event_msg that resolved, in file order. */
  readonly events: TrajectoryEvent[];
  /** `token_count` events successfully turned into a `model.usage` event. */
  readonly linesParsed: number;
  /** Malformed JSON lines, or `token_count` events that could not produce a valid event. */
  readonly linesSkipped: number;
  /** True when the rollout carried no `token_count` event_msg at all (bar 4) — the whole run has no
   *  validated usage contract; the caller should treat it as `unsupported`, not zero usage. */
  readonly unsupported: boolean;
}

/** A finite non-negative integer, or `undefined` — never NaN/float/negative through the boundary. */
function intOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const REQUIRED_MISSING = -1;

export function parseCodexRollout(
  jsonl: string,
  options: ParseCodexRolloutOptions,
): CodexRolloutParseResult {
  const eventId = options.eventId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date().toISOString());

  const events: TrajectoryEvent[] = [];
  let linesSkipped = 0;
  let tokenCountLinesSeen = 0;

  // Latched state (bar 1): the nearest `turn_context.model` and the session's `model_provider`.
  // Neither ever falls back to a guessed value — a `token_count` line seen before both are latched
  // is skipped below.
  let provider: string | null = null;
  let model: string | null = null;

  for (const raw of jsonl.split("\n")) {
    const line = raw.trim();
    if (line === "") continue; // blank lines are structural, not skipped content

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      linesSkipped++; // malformed JSON
      continue;
    }

    if (!isRecord(parsed) || typeof parsed["type"] !== "string") {
      linesSkipped++; // not a recognizable rollout line
      continue;
    }

    if (parsed["type"] === "session_meta") {
      const payload = parsed["payload"];
      const reported = isRecord(payload)
        ? payload["model_provider"]
        : undefined;
      if (typeof reported === "string" && reported !== "") provider = reported;
      continue; // structural — latched, not a usage line, never counted as skipped
    }

    if (parsed["type"] === "turn_context") {
      const payload = parsed["payload"];
      const reported = isRecord(payload) ? payload["model"] : undefined;
      if (typeof reported === "string" && reported !== "") model = reported;
      continue; // structural — latched, not a usage line, never counted as skipped
    }

    const payload = parsed["payload"];
    if (
      parsed["type"] !== "event_msg" ||
      !isRecord(payload) ||
      payload["type"] !== "token_count"
    ) {
      continue; // other rollout line kinds (response_item, world_state, compacted, ...): not our
      // signal and not a failure — mirrors the Claude adapter's "structural, not skipped" reading.
    }

    tokenCountLinesSeen++;

    const info = payload["info"];
    const last = isRecord(info) ? info["last_token_usage"] : undefined;
    if (!isRecord(last)) {
      linesSkipped++; // a token_count event with no usable usage shape
      continue;
    }

    // Bar 1: no latched model/provider yet -> this turn cannot be honestly attributed. Skip, never
    // hardcode a fallback.
    if (provider === null || model === null) {
      linesSkipped++;
      continue;
    }

    const rawInputTokens = intOr(last["input_tokens"], REQUIRED_MISSING);
    const rawOutputTokens = intOr(last["output_tokens"], REQUIRED_MISSING);
    if (
      rawInputTokens === REQUIRED_MISSING ||
      rawOutputTokens === REQUIRED_MISSING
    ) {
      linesSkipped++; // malformed/missing required counters
      continue;
    }
    // `cached_input_tokens` absence reads as 0 cache reads (a legitimate turn), matching the Claude
    // adapter's own precedent for its optional cache field.
    const cachedInputTokens = intOr(last["cached_input_tokens"], 0);

    const occurredAt =
      typeof parsed["timestamp"] === "string" && parsed["timestamp"] !== ""
        ? parsed["timestamp"]
        : now();

    const candidate = {
      eventId: eventId(),
      runId: options.runId,
      seq: events.length,
      version: TRAJECTORY_VERSION,
      occurredAt,
      kind: "model.usage" as const,
      payload: {
        provider,
        model,
        // Bar 2: `last_token_usage.input_tokens` is cache-INCLUSIVE (OpenAI convention: a subset of
        // it was served from cache). Subtracting the cache count out yields this package's additive
        // convention (inputTokens = NEW tokens only, cachedInputTokens = the separate cache count) —
        // the same shape the Claude adapter already writes from Anthropic's own additive usage
        // fields. A malformed line where cached exceeds input goes negative here and is rejected by
        // the strict schema's `intNonneg` below (safeParse fails -> skipped, never thrown).
        inputTokens: rawInputTokens - cachedInputTokens,
        // Bar 3: `output_tokens` already includes `reasoning_output_tokens` — never add it again.
        outputTokens: rawOutputTokens,
        cachedInputTokens,
        credits: 0, // estimated: not price-normalized, not billing-grade
        billingStatus: "estimated" as const,
      },
    };

    const result = TrajectoryEvent.safeParse(candidate);
    if (!result.success) {
      linesSkipped++;
      continue;
    }
    events.push(result.data);
  }

  return {
    events,
    linesParsed: events.length,
    linesSkipped,
    unsupported: tokenCountLinesSeen === 0, // bar 4
  };
}
