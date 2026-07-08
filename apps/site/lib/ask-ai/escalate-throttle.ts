// G21 follow-up (SHIP review WR-01): `/api/ask` carries no edge rate-limit (the CF rule covers only
// `/query` + `/api/auth/*`), and a `no_match`/`retrieval_unavailable` escalation settles spend at 0 —
// it never consumes the daily cap. So a Turnstile-clearing burst, or a docs-service outage that makes
// EVERY question escalate, could flood the support-bot's Linear Triage sink unbounded. Two
// independent, cheap guards sit in front of the real push: a short duplicate-question dedup window,
// and a global escalations-per-minute cap (a burst of DISTINCT questions still can't exceed it).
//
// ponytail: in-memory, per-process state (this service runs a single Railway replica today) — move
// to a shared store (e.g. Postgres, mirroring @caisson/rate-limit's account-store.ts) if the site
// ever scales horizontally to more than one instance.
import { createHash } from "node:crypto";

/** How long a duplicate (normalized) question is suppressed after its last push. */
export const DEDUP_WINDOW_MS = 10 * 60 * 1000;
/** Max escalation pushes allowed in any rolling per-minute window. */
export const CAP_PER_MINUTE = 20;
const CAP_WINDOW_MS = 60 * 1000;

function normalize(question: string): string {
  return question.trim().toLowerCase().replace(/\s+/g, " ");
}

function hashQuestion(question: string): string {
  return createHash("sha256").update(normalize(question)).digest("hex");
}

/**
 * Wrap an escalation push with a dedup window + a global per-minute cap. Returns a function with
 * the same signature; a throttled call is a silent no-op (never throws, never calls `push`) — the
 * caller already treats escalation as best-effort. State lives in the closure, so call this ONCE per
 * process (module scope) and reuse the returned function across requests — constructing it per
 * request would reset both guards every time and defeat the point.
 */
export function throttleEscalate(
  push: (question: string, reason: string) => Promise<void>,
  now: () => number = Date.now,
): (question: string, reason: string) => Promise<void> {
  const seen = new Map<string, number>(); // normalized-question hash -> last-pushed-at
  let windowStart = now();
  let windowCount = 0;

  return async (question, reason) => {
    const t = now();
    const key = hashQuestion(question);

    const lastPushed = seen.get(key);
    if (lastPushed !== undefined && t - lastPushed < DEDUP_WINDOW_MS) return; // duplicate, suppressed

    if (t - windowStart >= CAP_WINDOW_MS) {
      windowStart = t;
      windowCount = 0;
    }
    if (windowCount >= CAP_PER_MINUTE) return; // over the per-minute cap

    // Opportunistic cleanup of expired dedup entries — low-volume surface, no need for a timer.
    for (const [k, ts] of seen) {
      if (t - ts >= DEDUP_WINDOW_MS) seen.delete(k);
    }

    seen.set(key, t);
    windowCount += 1;
    await push(question, reason);
  };
}
