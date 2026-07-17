// First AR-3 usage adapter: parse Claude Code JSONL transcript lines (ccusage-style) into
// `model.usage` trajectory events with real token counts + the model id. `billingStatus: 'estimated'`
// — the counts are REAL (read straight off the assistant turns) but NOT price-normalized, so they are
// deliberately not billing-grade until a price-normalization pass lands; `credits` is therefore 0.
//
// Robustness contract (binding): a malformed line — invalid JSON, or a well-formed line that is not
// an assistant turn carrying usage — is SKIPPED and COUNTED, never thrown. A transcript with subagent
// (`isSidechain`) turns is parsed the same way: every usage-bearing turn, main or subagent, yields
// one event (ccusage counts them all). The caller supplies `runId`; ids/clock are injectable so the
// output is deterministic under test.
import { TrajectoryEvent, TRAJECTORY_VERSION } from "../schema.ts";

export interface ParseClaudeTranscriptOptions {
  readonly runId: string;
  /** Event-id factory; defaults to `crypto.randomUUID`. Injected for deterministic tests. */
  readonly eventId?: () => string;
  /** Fallback `occurredAt` when a line has no usable timestamp; defaults to `new Date().toISOString`. */
  readonly now?: () => string;
}

export interface ClaudeTranscriptParseResult {
  /** The `model.usage` events, one per usage-bearing turn, in transcript order (seq 0..n-1). */
  readonly events: TrajectoryEvent[];
  /** Usage-bearing turns successfully turned into events. */
  readonly linesParsed: number;
  /** Non-empty lines that were malformed or carried no usage (skipped, not thrown). */
  readonly linesSkipped: number;
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

export function parseClaudeTranscript(
  jsonl: string,
  options: ParseClaudeTranscriptOptions,
): ClaudeTranscriptParseResult {
  const eventId = options.eventId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date().toISOString());

  const events: TrajectoryEvent[] = [];
  let linesSkipped = 0;

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

    if (
      !isRecord(parsed) ||
      parsed.type !== "assistant" ||
      !isRecord(parsed.message) ||
      !isRecord(parsed.message.usage) ||
      typeof parsed.message.model !== "string" ||
      parsed.message.model === ""
    ) {
      linesSkipped++; // not an assistant turn carrying usage (e.g. a user line)
      continue;
    }

    const usage = parsed.message.usage;
    const occurredAt =
      typeof parsed.timestamp === "string" && parsed.timestamp !== ""
        ? parsed.timestamp
        : now();

    const candidate = {
      eventId: eventId(),
      runId: options.runId,
      seq: events.length,
      version: TRAJECTORY_VERSION,
      occurredAt,
      kind: "model.usage" as const,
      payload: {
        provider: "anthropic",
        model: parsed.message.model,
        inputTokens: intOr(usage.input_tokens, 0),
        outputTokens: intOr(usage.output_tokens, 0),
        cachedInputTokens: intOr(usage.cache_read_input_tokens, 0),
        credits: 0, // estimated: not price-normalized, not billing-grade
        billingStatus: "estimated" as const,
      },
    };

    // Fail-closed at the boundary: a line that can't produce a valid event is skipped, never thrown.
    const result = TrajectoryEvent.safeParse(candidate);
    if (!result.success) {
      linesSkipped++;
      continue;
    }
    events.push(result.data);
  }

  return { events, linesParsed: events.length, linesSkipped };
}
