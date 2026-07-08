// The /api/ask orchestration (ADR-0234). Pure of I/O wiring: every side-effecting seam (turnstile,
// session, retrieval, generation, spend) is injected as a dep so the whole flow is exercised
// hermetically with fakes. route.ts builds the real deps. The flow mirrors rag.py's retrieve → ground →
// generate → decide, adapted to two model lanes (F2), a fail-closed HARD per-lane spend cap (F2 rider,
// reserve-before-generate, extended to the premium lane), a day-one Turnstile gate (F5), and SSE
// streaming.
//
// Response contract:
//   400 application/json {error:"invalid_request"}   — malformed body / Zod .strict() reject
//   403 application/json {error:"challenge_failed"}  — Turnstile missing/invalid (fail closed)
//   200 text/event-stream                            — SSE; every admitted request streams, incl. escalations
// SSE events (each `event: <name>\ndata: <json>\n\n`):
//   token      {delta:string}                        — 0+ incremental answer slices (resolved answers only)
//   citations  {citations:[{source,url}]}            — terminal, resolved answer
//   escalation {reason:EscalationReason}             — terminal, any fail-safe outcome (UI renders the CTA)
//   done       {}                                    — stream end
import { z } from "zod";
import {
  buildContext,
  composeSystem,
  isSentinelLead,
  leaksFraming,
} from "./rag.ts";
import { type Citation, type ScoredChunk, toCitations } from "./retrieve.ts";
import type { StreamEvent } from "./openrouter.ts";
import { dollarsToMicro } from "./spend.ts";

/** POST /api/ask body — `.strict()` at the trust boundary. `question` mirrors the docs contract bounds. */
export const AskBody = z
  .object({
    question: z.string().trim().min(1).max(2000),
    // The Cloudflare Turnstile client token. Bounded; verified server-side (F5).
    turnstileToken: z.string().max(2048).optional(),
  })
  .strict();
export type AskBody = z.infer<typeof AskBody>;

export type Lane = "public" | "premium";

/** Machine-readable escalation reasons the UI branches on (all render the same contact/Discord CTA). */
export type EscalationReason =
  | "spend_cap"
  | "retrieval_unavailable"
  | "no_match"
  | "insufficient_context"
  | "leaked_framing"
  | "generation_failed";

export interface SpendSeam {
  /** Atomically reserve one request's worst-case cost against `lane`'s daily cap (ADR-0234 F2 rider,
   * hardened + extended to both lanes). `false` means the reservation itself would breach the cap —
   * escalate WITHOUT any paid work; `true` means the reservation is held and MUST be settled below. */
  reserve: (lane: Lane) => Promise<boolean>;
  /** Settle a granted reservation with the real generation cost in micro-dollars (0 when no generation
   * happened at all). Best-effort; never throws into the response. */
  settle: (lane: Lane, actualMicro: number) => Promise<void>;
}

export interface AskDeps {
  /** Turnstile verification (F5, fail-closed). */
  verifyTurnstile: (token: string | undefined, ip: string) => Promise<boolean>;
  /** True when a valid better-auth session is present → premium lane (F1/F2). */
  isAuthed: () => Promise<boolean>;
  /** Retrieve grounding chunks; throws to signal retrieval-unavailable. */
  retrieve: (question: string) => Promise<ScoredChunk[]>;
  /** Stream a grounded completion (delta events + a terminal cost event). */
  stream: (args: {
    model: string;
    system: string;
    user: string;
  }) => AsyncIterable<StreamEvent>;
  spend: SpendSeam;
  /** The two model lanes (F2). */
  models: { public: string; premium: string };
  /** Question-text capture (ADR-0236, consent-noticed). Called once per admitted request with the
   * terminal outcome; best-effort — a capture failure never reaches the response. Optional so the
   * hermetic fixtures and any capture-less deployment stay valid. */
  capture?: (
    lane: Lane,
    question: string,
    outcome: "answered" | "escalated",
  ) => Promise<void>;
  /** File a support ticket for a question the assistant could not answer (G21 parity — the Discord
   * bot's own unresolved questions already get this treatment). Called once per genuinely-unanswered
   * request (never on `spend_cap`, a capacity signal, not a question a human needs to see — see the
   * call site). Best-effort; a failure never reaches the response. Optional for the same reason as
   * `capture`. */
  escalate?: (question: string, reason: EscalationReason) => Promise<void>;
}

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "Referrer-Policy": "no-referrer",
};

function jsonError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      ...SECURITY_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/** Prefer the Railway-set X-Real-IP (not spoofable by the client, unlike XFF), fall back to XFF's first hop. */
function clientIp(req: Request): string {
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp !== undefined && realIp.length > 0) return realIp;
  const xff = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return xff !== undefined && xff.length > 0 ? xff : "";
}

// ponytail: emit the guarded answer in fixed slices — token-GRANULAR live passthrough is deferred. The
// sentinel + leak guards must see the WHOLE reply (rag.py semantics, intact), so the answer is buffered,
// guarded, then streamed out as slices. An 800-token completion buffers within the model's own
// generation time; upgrade path = a sentinel/leak-safe hold-back window if first-token latency matters.
const SLICE = 180;
function* sliceAnswer(answer: string): Generator<string> {
  for (let i = 0; i < answer.length; i += SLICE) {
    yield answer.slice(i, i + SLICE);
  }
}

/** Handle one POST /api/ask. Never throws — every failure is a status code or a streamed escalation. */
export async function handleAsk(
  req: Request,
  deps: AskDeps,
): Promise<Response> {
  // 1. body — a bad body dies here, not at OpenRouter.
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return jsonError("invalid_request", 400);
  }
  const parsed = AskBody.safeParse(rawBody);
  if (!parsed.success) return jsonError("invalid_request", 400);
  const question = parsed.data.question;

  // 2. Turnstile gate (F5, fail closed) — before any paid work.
  const ip = clientIp(req);
  const passed = await deps.verifyTurnstile(parsed.data.turnstileToken, ip);
  if (!passed) return jsonError("challenge_failed", 403);

  // 3. lane selection (F1/F2): a valid session → premium; anonymous → public (spend-capped).
  const authed = await deps.isAuthed();
  const lane: Lane = authed ? "premium" : "public";
  const model = authed ? deps.models.premium : deps.models.public;

  // 4. stream. Everything admitted responds 200 SSE — including escalations (the honest fail-safe).
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: string, data: unknown): void => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };
      let escalationReason: EscalationReason | undefined;
      const escalate = (reason: EscalationReason): void => {
        escalationReason = reason;
        emit("escalation", { reason });
      };

      let costUsd: number | undefined;
      let reserved = false;
      // ADR-0236: every terminal path below is either a resolved answer or an escalation — the
      // assignment to "answered" happens only after all guards pass.
      let outcome: "answered" | "escalated" = "escalated";
      try {
        // 4a. hard per-lane spend cap (F2 rider, hardened + extended to both lanes) — reserve BEFORE
        // any paid work, atomically, so two concurrent requests near the cap can never both pass (closes
        // the check-then-charge race). Fails CLOSED to escalation.
        reserved = await deps.spend.reserve(lane);
        if (!reserved) {
          escalate("spend_cap");
          return;
        }

        // 4b. retrieve — a failure or empty result escalates rather than answering ungrounded.
        let chunks: ScoredChunk[];
        try {
          chunks = await deps.retrieve(question);
        } catch {
          escalate("retrieval_unavailable");
          return;
        }
        if (chunks.length === 0) {
          escalate("no_match");
          return;
        }

        // 4c. ground + generate. Retrieved context is fenced in the SYSTEM turn (untrusted data); the
        // USER turn carries only the question.
        const system = composeSystem(buildContext(chunks));
        let full = "";
        try {
          for await (const ev of deps.stream({
            model,
            system,
            user: question,
          })) {
            if (ev.type === "delta") full += ev.text;
            else costUsd = ev.usd;
          }
        } catch {
          escalate("generation_failed");
          return;
        }

        // 4d. decide (guards on the FULL reply — intact rag.py semantics).
        const answer = full.trim();
        if (answer.length === 0) {
          escalate("generation_failed");
          return;
        }
        if (isSentinelLead(answer)) {
          escalate("insufficient_context");
          return;
        }
        if (leaksFraming(answer)) {
          escalate("leaked_framing");
          return;
        }

        // 4e. resolved answer — stream it, then the deduped citations.
        outcome = "answered";
        for (const piece of sliceAnswer(answer))
          emit("token", { delta: piece });
        const citations: Citation[] = toCitations(chunks);
        emit("citations", { citations });
      } finally {
        // ADR-0236 capture — after the Turnstile gate by construction (this stream only exists for
        // admitted requests). Best-effort: never turn a capture failure into a user-facing error.
        try {
          await deps.capture?.(lane, question, outcome);
        } catch {
          /* best-effort */
        }
        // G21: file a support ticket for a genuinely-unanswered question — never for `spend_cap`,
        // which is a capacity signal (a traffic burst tripping the daily budget), not a question a
        // human needs to follow up on; ticketing every cap-hit would flood Triage during a burst.
        if (
          outcome === "escalated" &&
          escalationReason !== undefined &&
          escalationReason !== "spend_cap"
        ) {
          try {
            await deps.escalate?.(question, escalationReason);
          } catch {
            /* best-effort */
          }
        }
        // Settle the reservation with the real cost (0 when no generation happened at all — e.g.
        // retrieval failed after the reservation was granted, fully releasing it). Only when a
        // reservation was actually granted above (never after a spend_cap escalation, which reserved
        // nothing). A metering write must never fail the user's response — swallow.
        if (reserved) {
          const actualMicro =
            costUsd !== undefined ? dollarsToMicro(costUsd) : 0;
          try {
            await deps.spend.settle(lane, actualMicro);
          } catch {
            /* best-effort: never turn a metering-write failure into a user-facing error */
          }
        }
        emit("done", {});
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...SECURITY_HEADERS,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      // Disable proxy/Next buffering so SSE flushes incrementally through CF + Railway.
      "X-Accel-Buffering": "no",
    },
  });
}
