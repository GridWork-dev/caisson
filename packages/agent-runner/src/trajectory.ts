// Trajectory observation (PLAN T3). Map a completed run's stream-json transcript into the append-only
// `@caisson-sh/agent-trajectory` contract: `run.started` → per-turn `step.started`/`step.finished`
// (tool calls → `tool.proposed` + `tool.result`, bodies carried ONLY as sha256 digest refs, never raw
// per AR-4) → `run.finished` → a final `model.usage` with `billingStatus: "unsupported"` (the runner
// has NO validated usage contract, so it makes no token claims). Pure + deterministic given the
// transcript; recording is opt-in — absent a recorder the runner behaves byte-identically to today.
import { createHash } from "node:crypto";
import {
  TrajectoryEvent,
  TRAJECTORY_VERSION,
} from "@caisson-sh/agent-trajectory";

/** The subset of run metadata the trajectory mapping reads (structurally satisfied by `RunMeta`). */
export interface RecordableRun {
  readonly runId: string;
  readonly task: string;
  readonly binary: string;
  readonly model: string;
  readonly startedAt: string;
  readonly status: "running" | "done" | "killed" | "error";
  readonly endedAt?: string | undefined;
}

/** One parsed stream-json line (structurally satisfied by the runner's internal `StreamEvent`). */
export interface TranscriptLine {
  readonly type?: string;
  readonly result?: string;
  readonly message?: { readonly content?: unknown };
}

export interface BuildTrajectoryOptions {
  /** Event-id factory; defaults to `crypto.randomUUID`. Injected for deterministic tests. */
  readonly eventId?: () => string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** `{ digest: sha256-hex, byteLength }` for a body — the only shape sensitive content takes (AR-4). */
function digestRef(body: string): { digest: string; byteLength: number } {
  return {
    digest: createHash("sha256").update(body).digest("hex"),
    byteLength: Buffer.byteLength(body),
  };
}

function contentPieces(ev: TranscriptLine): Record<string, unknown>[] {
  const content = ev.message?.content;
  return Array.isArray(content) ? content.filter(isRecord) : [];
}

/** Stringify a tool_result body (string or content-block array) for its digest. */
function stringifyContent(content: unknown): string {
  return typeof content === "string"
    ? content
    : JSON.stringify(content ?? null);
}

/**
 * Project a completed run's transcript into a trajectory event log. Every candidate is validated
 * through the strict `TrajectoryEvent` schema (fail-closed — a malformed candidate is a bug, so it
 * throws rather than silently drops). `seq` is a gapless 0-based sequence the append-only store keys.
 */
export function buildTrajectoryEvents(
  meta: RecordableRun,
  events: readonly TranscriptLine[],
  opts: BuildTrajectoryOptions = {},
): TrajectoryEvent[] {
  // ponytail: the default eventId is a fresh randomUUID per call, so rebuilding the same run yields
  // different event bytes — a retry after a PARTIAL append hits the store's rewrite rejection
  // instead of no-oping. Fine while record() targets the in-memory store (cannot fail mid-loop); a
  // durable store should inject a deterministic factory (e.g. uuidv5 of `runId:seq`) via opts.eventId.
  const eventId = opts.eventId ?? (() => crypto.randomUUID());
  const startedAt = meta.startedAt;
  const endedAt = meta.endedAt ?? meta.startedAt;

  const candidates: unknown[] = [];
  let seq = 0;
  const add = (occurredAt: string, kind: string, payload: unknown): void => {
    candidates.push({
      eventId: eventId(),
      runId: meta.runId,
      seq: seq++,
      version: TRAJECTORY_VERSION,
      occurredAt,
      kind,
      payload,
    });
  };

  // The opening input is referenced by digest — never the task text itself (AR-4).
  add(startedAt, "run.started", {
    agentId: meta.binary,
    input: digestRef(meta.task),
  });

  let resultText = "";
  let stepIndex = 0;
  for (const ev of events) {
    if (ev.type === "assistant") {
      const stepId = `step-${stepIndex++}`;
      add(startedAt, "step.started", { stepId, depth: 0 });
      let toolIdx = 0;
      for (const p of contentPieces(ev)) {
        if (p["type"] === "tool_use" && typeof p["name"] === "string") {
          // Real transcripts carry a stable tool_use `id`; synthesize one only when absent so the
          // tool.result (keyed by tool_use_id) can still pair.
          const rawId = p["id"];
          const toolCallId =
            typeof rawId === "string" && rawId !== ""
              ? rawId
              : `${stepId}-t${toolIdx}`;
          toolIdx++;
          add(startedAt, "tool.proposed", {
            stepId,
            toolCallId,
            name: p["name"],
            args: digestRef(JSON.stringify(p["input"] ?? null)),
          });
        }
      }
      add(startedAt, "step.finished", { stepId, status: "ok" });
    } else if (ev.type === "user") {
      for (const p of contentPieces(ev)) {
        const toolUseId = p["tool_use_id"];
        if (
          p["type"] === "tool_result" &&
          typeof toolUseId === "string" &&
          toolUseId !== ""
        ) {
          add(startedAt, "tool.result", {
            toolCallId: toolUseId,
            ok: p["is_error"] !== true,
            result: digestRef(stringifyContent(p["content"])),
          });
        }
      }
    } else if (ev.type === "result" && typeof ev.result === "string") {
      resultText = ev.result;
    }
  }

  const status =
    meta.status === "done"
      ? "completed"
      : meta.status === "killed"
        ? "cancelled"
        : "failed";
  add(endedAt, "run.finished", {
    status,
    ...(resultText !== "" ? { output: digestRef(resultText) } : {}),
  });
  // No token claims: the runner sees only a transcript, not a metered usage contract (AR-3).
  add(endedAt, "model.usage", {
    provider: "agent-runner",
    model: meta.model,
    inputTokens: 0,
    outputTokens: 0,
    credits: 0,
    billingStatus: "unsupported",
  });

  return candidates.map((c) => TrajectoryEvent.parse(c));
}
