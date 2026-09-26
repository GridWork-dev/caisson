"use client";

// "Replay a run" (ADR-0378 lock 2, flagship F-agent-trajectory). The hand-ported mirror
// (agent-trajectory-logic.ts) is deleted: the sample trajectory below is poke-local FIXTURE data,
// and everything that judges it is the real package, imported through
// `@caisson-sh/agent-trajectory/browser` (ADR-0396).
//
//   - the fold is the shipped `project()` — replayed in recorded order and in reversed arrival,
//     and the two projections are compared byte-for-byte here rather than asserted;
//   - the tamper verdict is the shipped strict `TrajectoryEvent` schema. `TrajectoryEvent.safeParse`
//     is exactly the gate `createMemoryTrajectoryStore().append()` runs through kernel's
//     `parseStrict`, read in its non-throwing form so this component stays synchronous; the poke
//     test drives the REAL store to pin that the two agree.
//
// Sensitive bodies never render, only their DigestRef (digest + byte length) — the package's own
// AR-4 payload discipline, which the sample data honors.
import { useMemo, useState } from "react";
import {
  project,
  TrajectoryEvent,
  type DigestRef,
  type RunProjection,
} from "@caisson-sh/agent-trajectory/browser";

import { PokeShell, Verdict } from "./poke-rig";
import styles from "./agent-trajectory-poke.module.css";

/** The one `model.usage` variant of the real discriminated union — narrowed, never redeclared. */
type ModelUsageEvent = Extract<TrajectoryEvent, { kind: "model.usage" }>;

// --- Sample fixture (poke-local): a one-run narrative touching all eleven kinds ------------------
// A second `tool.proposed` carries the denied call. Every digest is 64 hex characters because the
// real schema rejects anything else; the poke test parses every event through it.

const DIGEST_INPUT = "4f3c2a1e".repeat(8);
const DIGEST_PROMPT = "9b7d1f60".repeat(8);
const DIGEST_ARGS_1 = "1a2b3c4d".repeat(8);
const DIGEST_RESULT_1 = "c0ffee01".repeat(8);
const DIGEST_ARGS_2 = "5e6f7a8b".repeat(8);
const DIGEST_STATE = "de0adbe1".repeat(8);
const DIGEST_OUTPUT = "f00dfeed".repeat(8);

const AT = "2026-07-21T09:00:00.000Z";
const RUN_ID = "run-sample-a1c9";

/** The credits committed by the recorded sample event (before any tamper). */
export const RECORDED_METERED_CREDITS = 5;

export const SAMPLE_RUN: readonly TrajectoryEvent[] = [
  {
    eventId: "11111111-1111-4111-8111-000000000000",
    runId: RUN_ID,
    seq: 0,
    version: 1,
    occurredAt: AT,
    kind: "run.started",
    payload: {
      agentId: "agent-github-triage",
      input: { digest: DIGEST_INPUT, byteLength: 214 },
    },
  },
  {
    eventId: "11111111-1111-4111-8111-000000000001",
    runId: RUN_ID,
    seq: 1,
    version: 1,
    occurredAt: AT,
    kind: "step.started",
    payload: { stepId: "s1", depth: 0, label: "triage-issue" },
  },
  {
    eventId: "11111111-1111-4111-8111-000000000002",
    runId: RUN_ID,
    seq: 2,
    version: 1,
    occurredAt: AT,
    kind: "model.call",
    payload: {
      stepId: "s1",
      provider: "anthropic",
      model: "claude-sonnet-5",
      prompt: { digest: DIGEST_PROMPT, byteLength: 1840 },
    },
  },
  {
    eventId: "11111111-1111-4111-8111-000000000003",
    runId: RUN_ID,
    seq: 3,
    version: 1,
    occurredAt: AT,
    kind: "model.usage",
    payload: {
      stepId: "s1",
      provider: "anthropic",
      model: "claude-sonnet-5",
      inputTokens: 812,
      outputTokens: 96,
      cachedInputTokens: 240,
      credits: RECORDED_METERED_CREDITS,
      billingStatus: "metered",
    },
  },
  {
    eventId: "11111111-1111-4111-8111-000000000004",
    runId: RUN_ID,
    seq: 4,
    version: 1,
    occurredAt: AT,
    kind: "tool.proposed",
    payload: {
      stepId: "s1",
      toolCallId: "call-1",
      name: "label_issue",
      args: { digest: DIGEST_ARGS_1, byteLength: 48 },
    },
  },
  {
    eventId: "11111111-1111-4111-8111-000000000005",
    runId: RUN_ID,
    seq: 5,
    version: 1,
    occurredAt: AT,
    kind: "tool.approved",
    payload: { toolCallId: "call-1", actor: "policy:auto-approve" },
  },
  {
    eventId: "11111111-1111-4111-8111-000000000006",
    runId: RUN_ID,
    seq: 6,
    version: 1,
    occurredAt: AT,
    kind: "tool.result",
    payload: {
      toolCallId: "call-1",
      ok: true,
      result: { digest: DIGEST_RESULT_1, byteLength: 12 },
      exitCode: 0,
    },
  },
  {
    eventId: "11111111-1111-4111-8111-000000000007",
    runId: RUN_ID,
    seq: 7,
    version: 1,
    occurredAt: AT,
    kind: "tool.proposed",
    payload: {
      stepId: "s1",
      toolCallId: "call-2",
      name: "close_repo",
      args: { digest: DIGEST_ARGS_2, byteLength: 20 },
    },
  },
  {
    eventId: "11111111-1111-4111-8111-000000000008",
    runId: RUN_ID,
    seq: 8,
    version: 1,
    occurredAt: AT,
    kind: "tool.denied",
    payload: {
      toolCallId: "call-2",
      actor: "policy:auto-approve",
      reason: "not allowlisted",
    },
  },
  {
    eventId: "11111111-1111-4111-8111-000000000009",
    runId: RUN_ID,
    seq: 9,
    version: 1,
    occurredAt: AT,
    kind: "checkpoint",
    payload: {
      checkpointId: "c1",
      label: "after-tools",
      state: { digest: DIGEST_STATE, byteLength: 3072 },
    },
  },
  {
    eventId: "11111111-1111-4111-8111-000000000010",
    runId: RUN_ID,
    seq: 10,
    version: 1,
    occurredAt: AT,
    kind: "step.finished",
    payload: { stepId: "s1", status: "ok" },
  },
  {
    eventId: "11111111-1111-4111-8111-000000000011",
    runId: RUN_ID,
    seq: 11,
    version: 1,
    occurredAt: AT,
    kind: "run.finished",
    payload: {
      status: "completed",
      output: { digest: DIGEST_OUTPUT, byteLength: 96 },
    },
  },
];

// --- Poke state (presentation composition over the real primitives) -----------------------------

export type TamperMove = "none" | "inflate" | "invariant";

export interface PokeState {
  readonly events: readonly TrajectoryEvent[];
  readonly tamper: TamperMove;
}

export function initialState(): PokeState {
  return { events: SAMPLE_RUN, tamper: "none" };
}

function withUsage(
  events: readonly TrajectoryEvent[],
  mutate: (p: ModelUsageEvent["payload"]) => ModelUsageEvent["payload"],
): TrajectoryEvent[] {
  return events.map((e) =>
    e.kind === "model.usage" ? { ...e, payload: mutate(e.payload) } : e,
  );
}

/** Tamper move 1: inflate a schema-valid field. The event stays well-formed; the projected total
 *  no longer matches what the run recorded. */
export function inflateCredits(state: PokeState): PokeState {
  return {
    events: withUsage(state.events, (p) => ({
      ...p,
      credits: p.credits * 100,
    })),
    tamper: "inflate",
  };
}

/** Tamper move 2: break the credits/billingStatus invariant itself — the exact shape the package's
 *  `ModelUsagePayload` refinement rejects at the ingestion boundary. */
export function breakInvariant(state: PokeState): PokeState {
  return {
    events: withUsage(state.events, (p) => ({
      ...p,
      billingStatus: "estimated",
    })),
    tamper: "invariant",
  };
}

export function reset(): PokeState {
  return initialState();
}

/** Reverse arrival order — the permutation the package's own replay test asserts folds identically
 *  (`project()` sorts by `seq` before folding, so order never matters). */
export function reversedArrival(
  events: readonly TrajectoryEvent[],
): TrajectoryEvent[] {
  return [...events].reverse();
}

export function usageEvent(
  events: readonly TrajectoryEvent[],
): ModelUsageEvent {
  const e = events.find((ev) => ev.kind === "model.usage");
  if (e === undefined)
    throw new Error("sample run always carries a model.usage event");
  return e;
}

export interface ReplayResult {
  readonly projection: RunProjection;
  /** True when replaying the reversed-arrival order folds to a byte-identical projection. */
  readonly orderIndependent: boolean;
  /** The shipped schema's own message for the current model.usage event, or null when it passes. */
  readonly usageIssue: string | null;
}

/**
 * Replay the current log twice (recorded order + reversed arrival) through the real `project()`,
 * and run the current (possibly tampered) `model.usage` event through the real strict schema. The
 * two never overlap — `project()` never re-validates, the store's `append` never re-projects — and
 * this poke shows both honestly.
 */
export function evaluate(state: PokeState): ReplayResult {
  const ordered = project(state.events);
  const reversed = project(reversedArrival(state.events));
  const parsed = TrajectoryEvent.safeParse(usageEvent(state.events));
  return {
    projection: ordered,
    orderIndependent: JSON.stringify(ordered) === JSON.stringify(reversed),
    usageIssue: parsed.success
      ? null
      : (parsed.error.issues[0]?.message ??
        "model.usage failed the trajectory schema."),
  };
}

export interface VerdictLine {
  readonly state: "ok" | "fail";
  readonly text: string;
}

/** The headline verdict, computed from the replay result, never asserted copy (ADR-0375: no em
 *  dashes). */
export function verdictLine(r: ReplayResult, state: PokeState): VerdictLine {
  if (!r.orderIndependent) {
    return {
      state: "fail",
      text: "Reversed-arrival replay produced a different projection. project() should never do this.",
    };
  }
  if (r.usageIssue !== null) {
    return { state: "fail", text: r.usageIssue };
  }
  const metered = r.projection.usageTotals.metered.credits;
  if (state.tamper === "inflate" && metered !== RECORDED_METERED_CREDITS) {
    return {
      state: "fail",
      text: `usageTotals.metered.credits reads ${metered}. The run recorded ${RECORDED_METERED_CREDITS}.`,
    };
  }
  return {
    state: "ok",
    text: "Replayed recorded order and reversed arrival: byte-identical projection.",
  };
}

// --- Display helpers (poke-local presentation) ---------------------------------------------------

/** Short display form of a digest (matches audit-worm-poke.tsx's presentation helper). */
export function shortDigest(digest: string): string {
  return `${digest.slice(0, 6)}…${digest.slice(-4)}`;
}

/** One-line human summary per event kind, for the timeline strip. Every field read here is real
 *  (the package's payload shape for that kind) — no invented labels. */
export function eventSummary(event: TrajectoryEvent): string {
  switch (event.kind) {
    case "run.started":
      return `agent ${event.payload.agentId}`;
    case "run.finished":
      return `status ${event.payload.status}`;
    case "step.started":
      return `${event.payload.label ?? event.payload.stepId} (depth ${event.payload.depth})`;
    case "step.finished":
      return `${event.payload.stepId} → ${event.payload.status}`;
    case "model.call":
      return `${event.payload.provider}/${event.payload.model}`;
    case "model.usage":
      return `${event.payload.provider}/${event.payload.model}, ${event.payload.inputTokens}in/${event.payload.outputTokens}out, ${event.payload.credits}cr (${event.payload.billingStatus})`;
    case "tool.proposed":
      return `${event.payload.name} (${event.payload.toolCallId})`;
    case "tool.approved":
      return `approved by ${event.payload.actor}`;
    case "tool.denied":
      return `denied by ${event.payload.actor}${event.payload.reason ? `, ${event.payload.reason}` : ""}`;
    case "tool.result":
      return `${event.payload.toolCallId} → ${event.payload.ok ? "ok" : "error"}`;
    case "checkpoint":
      return `${event.payload.label ?? event.payload.checkpointId}`;
    default:
      return "";
  }
}

/** The DigestRef carried by this event, if any (the field varies by kind) — never the body it
 *  references. */
export function eventDigest(event: TrajectoryEvent): DigestRef | undefined {
  switch (event.kind) {
    case "run.started":
      return event.payload.input;
    case "run.finished":
      return event.payload.output;
    case "model.call":
      return event.payload.prompt;
    case "tool.proposed":
      return event.payload.args;
    case "tool.result":
      return event.payload.result;
    case "checkpoint":
      return event.payload.state;
    default:
      return undefined;
  }
}

const KIND_TONE: Record<string, string> = {
  "run.started": "root",
  "run.finished": "root",
  "step.started": "ok",
  "step.finished": "ok",
  "model.call": "neutral",
  "model.usage": "neutral",
  "tool.proposed": "neutral",
  "tool.approved": "ok",
  "tool.denied": "fail",
  "tool.result": "ok",
  checkpoint: "root",
};

export default function AgentTrajectoryPoke() {
  const [state, setState] = useState<PokeState>(() => initialState());

  const result = useMemo(() => evaluate(state), [state]);
  const line = useMemo(() => verdictLine(result, state), [result, state]);

  const meteredCredits = result.projection.usageTotals.metered.credits;
  const creditsMismatch = meteredCredits !== RECORDED_METERED_CREDITS;

  return (
    <PokeShell
      label="@caisson-sh/agent-trajectory"
      title="Replay a run twice. Then tamper one event and watch the verdict flip."
    >
      <p className={styles.sample}>
        Sample run (fixed, not live): a governed agent triaging a repo issue.
      </p>

      <ol className={styles.timeline}>
        {state.events.map((event) => {
          const digest = eventDigest(event);
          return (
            <li
              key={event.eventId}
              className={styles.row}
              data-tone={KIND_TONE[event.kind] ?? "neutral"}
            >
              <span className={styles.seq}>#{event.seq}</span>
              <span className={styles.kind}>{event.kind}</span>
              <span className={styles.summary}>{eventSummary(event)}</span>
              {digest ? (
                <code className={styles.digest}>
                  digest {shortDigest(digest.digest)} · {digest.byteLength}B
                </code>
              ) : (
                <span className={styles.digestEmpty} aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.action}
          onClick={() => setState((s) => inflateCredits(s))}
        >
          Inflate credits
        </button>
        <button
          type="button"
          className={styles.action}
          onClick={() => setState((s) => breakInvariant(s))}
        >
          Break the invariant
        </button>
        <button
          type="button"
          className={styles.action}
          onClick={() => setState(reset())}
          disabled={state.tamper === "none"}
        >
          Reset
        </button>
      </div>

      <div className={styles.projection}>
        <div className={styles.projectionHead}>
          <span className={styles.projectionTitle}>Projection</span>
          <span
            className={styles.projectionState}
            data-tone={result.orderIndependent ? "ok" : "fail"}
          >
            {result.orderIndependent ? "Order-independent" : "Order-dependent"}
          </span>
        </div>
        <dl className={styles.projectionGrid}>
          <dt>status</dt>
          <dd>{result.projection.status}</dd>
          <dt>usageTotals.metered.credits</dt>
          <dd data-tone={creditsMismatch ? "fail" : "ok"}>
            {meteredCredits}
            {creditsMismatch ? ` (recorded ${RECORDED_METERED_CREDITS})` : ""}
          </dd>
          <dt>checkpoints</dt>
          <dd>{result.projection.checkpoints.length}</dd>
        </dl>
        <p className={styles.note}>
          model.call and tool.* fold to no projection state here, recorded and
          replayable, just not folded (replay.ts).
        </p>
      </div>

      <Verdict state={line.state}>{line.text}</Verdict>
    </PokeShell>
  );
}
