// The BROWSER half of the /api/ask SSE contract (ADR-0234): a pure state machine + SSE frame parser,
// no React, no fetch, no DOM — so the loading → streaming → cited / escalated / error transitions are
// unit-tested directly (bun test ./lib). handler.ts is the server source of truth for the wire format;
// the two small shapes below mirror it (kept in sync by the shared events() test in handler.test.ts).
//
// Wire (each frame `event: <name>\ndata: <json>\n\n`):
//   token      {delta:string}                     — 0+ incremental answer slices (resolved answers only)
//   citations  {citations:[{source,url}]}         — terminal, resolved answer
//   escalation {reason:EscalationReason}           — terminal fail-safe (UI renders the contact CTA)
//   done       {}                                  — stream end

/** A citation the UI renders as a chip: the source doc path + its `/docs/...` URL (null = not linkable,
 *  e.g. a package README Fumadocs does not host). Mirrors retrieve.ts `Citation`. */
export interface Citation {
  readonly source: string;
  readonly url: string | null;
}

/** Machine-readable escalation reasons (mirrors handler.ts). All render the same contact CTA; the copy
 *  differs by reason so the message stays honest (ADR-0080): "not in the docs" vs "at capacity" vs a
 *  generic service hiccup. */
export type EscalationReason =
  | "spend_cap"
  | "retrieval_unavailable"
  | "no_match"
  | "insufficient_context"
  | "leaked_framing"
  | "generation_failed";

/** Pre-stream transport failures (the request never reached the SSE happy path). */
export type ErrorKind = "request" | "challenge" | "network";

/** The widget state machine. `cited` is the resolved terminal (a resolved answer always carries ≥1
 *  citation — the server escalates `no_match` on empty retrieval). */
export type AskState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "streaming"; readonly answer: string }
  | {
      readonly status: "cited";
      readonly answer: string;
      readonly citations: readonly Citation[];
    }
  | { readonly status: "escalated"; readonly reason: EscalationReason }
  | { readonly status: "error"; readonly kind: ErrorKind };

export const INITIAL: AskState = { status: "idle" };

/** A parsed SSE event, or a synthesized transport error the hook injects (400/403/network). */
export type AskEvent =
  | { readonly type: "token"; readonly delta: string }
  | { readonly type: "citations"; readonly citations: Citation[] }
  | { readonly type: "escalation"; readonly reason: EscalationReason }
  | { readonly type: "done" }
  | { readonly type: "error"; readonly kind: ErrorKind };

const REASONS: ReadonlySet<string> = new Set<EscalationReason>([
  "spend_cap",
  "retrieval_unavailable",
  "no_match",
  "insufficient_context",
  "leaked_framing",
  "generation_failed",
]);

/** Advance the state machine by one event. Pure. */
export function reduceAsk(state: AskState, ev: AskEvent): AskState {
  switch (ev.type) {
    case "token": {
      const prev = state.status === "streaming" ? state.answer : "";
      return { status: "streaming", answer: prev + ev.delta };
    }
    case "citations": {
      const answer = state.status === "streaming" ? state.answer : "";
      return { status: "cited", answer, citations: ev.citations };
    }
    case "escalation":
      return { status: "escalated", reason: ev.reason };
    case "error":
      return { status: "error", kind: ev.kind };
    case "done":
      // A stream that ended after tokens but with no citations/escalation is a truncated resolve —
      // fail safe to the contact CTA rather than showing an uncited (thus ungrounded-looking) answer.
      if (state.status === "streaming") {
        return { status: "escalated", reason: "generation_failed" };
      }
      return state;
  }
}

function toEvent(name: string, payload: unknown): AskEvent | null {
  const o =
    typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)
      : {};
  switch (name) {
    case "token":
      return typeof o.delta === "string"
        ? { type: "token", delta: o.delta }
        : null;
    case "citations":
      return { type: "citations", citations: coerceCitations(o.citations) };
    case "escalation":
      return {
        type: "escalation",
        reason:
          typeof o.reason === "string" && REASONS.has(o.reason)
            ? (o.reason as EscalationReason)
            : "generation_failed",
      };
    case "done":
      return { type: "done" };
    default:
      return null;
  }
}

function coerceCitations(value: unknown): Citation[] {
  if (!Array.isArray(value)) return [];
  const out: Citation[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.source !== "string") continue;
    out.push({
      source: rec.source,
      url: typeof rec.url === "string" ? rec.url : null,
    });
  }
  return out;
}

/**
 * Parse complete SSE frames out of a running buffer (frames end at a blank line, `\n\n`). Returns the
 * decoded events plus the unconsumed tail (a partial final frame, kept for the next network chunk). Pure.
 */
export function parseSse(buffer: string): {
  events: AskEvent[];
  rest: string;
} {
  const events: AskEvent[] = [];
  let rest = buffer;
  let sep = rest.indexOf("\n\n");
  while (sep !== -1) {
    const block = rest.slice(0, sep);
    rest = rest.slice(sep + 2);
    let name = "";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) name = line.slice(6).trim();
      else if (line.startsWith("data:")) data = line.slice(5).trim();
    }
    if (name.length > 0) {
      let payload: unknown = {};
      try {
        if (data.length > 0) payload = JSON.parse(data);
      } catch {
        payload = null;
      }
      const ev = toEvent(name, payload);
      if (ev !== null) events.push(ev);
    }
    sep = rest.indexOf("\n\n");
  }
  return { events, rest };
}

/**
 * A short, readable label for a citation chip. Prefers the doc slug's last segment (de-hyphenated); an
 * `index`/`README` leaf is named by its parent section so a chip never just reads "index". Pure.
 */
export function citationLabel(c: Citation): string {
  const raw = (c.url ?? c.source).replace(/\.(mdx?|md)$/i, "");
  const parts = raw.split("/").filter((s) => s.length > 0);
  const last = parts[parts.length - 1] ?? raw;
  const leaf = last.toLowerCase();
  const seg =
    (leaf === "index" || leaf === "readme") && parts.length > 1
      ? (parts[parts.length - 2] as string)
      : last;
  return seg.replace(/[-_]/g, " ");
}
