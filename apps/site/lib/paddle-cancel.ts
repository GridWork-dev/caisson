// Server-side Paddle subscription cancel (ADR-0293 G14). Schedules cancellation at the END of the
// current billing period (`effective_from: "next_billing_period"` — Paddle's documented default) so
// a buyer keeps access through what they already paid for; this call NEVER mutates
// entitlement_grant / subscription_status itself — cancellation truth still arrives via Paddle's
// `subscription.canceled` webhook (apply-billing-event.ts), per ADR-0293's binding decision. Reuses
// the SAME env-selected base-URL convention services/license's Paddle driver uses (PADDLE_ENV,
// packages/billing-orchestration/src/drivers.ts `paddleApiBase`) — a SERVER secret
// (`PADDLE_API_KEY`), never exposed to the client (contrast `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`).
//
// The Paddle response is parsed TOLERANTLY (plain field reads, no Zod `.strict()`) — this is a
// third-party API response, not our own boundary; Paddle is free to add fields.
import { fetchWithTimeout } from "@caisson/kernel";

function paddleApiBase(env: string | undefined): string {
  return env === "production"
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com";
}

export type CancelResult =
  | { ok: true; status: string; effectiveAt: string | null }
  | { ok: false; reason: string };

type FetchImpl = typeof fetchWithTimeout;

/**
 * POST /subscriptions/{id}/cancel (developer.paddle.com/api-reference/subscriptions/cancel-
 * subscription). Never throws — a missing key, a non-2xx, or a network failure all resolve to
 * `{ ok: false }` with a generic, key-free reason (the raw response body is never echoed back: it
 * could carry account-identifying data).
 */
export async function cancelPaddleSubscription(
  subscriptionId: string,
  fetchImpl: FetchImpl = fetchWithTimeout,
): Promise<CancelResult> {
  const apiKey = process.env.PADDLE_API_KEY ?? "";
  if (apiKey.length === 0) {
    return { ok: false, reason: "cancellation is not configured" };
  }
  try {
    const res = await fetchImpl(
      `${paddleApiBase(process.env.PADDLE_ENV)}/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ effective_from: "next_billing_period" }),
      },
      { timeoutMs: 15_000 },
    );
    if (!res.ok) {
      return {
        ok: false,
        reason: `Paddle returned status ${String(res.status)}`,
      };
    }
    const data = (await res.json()) as {
      data?: {
        status?: string;
        scheduled_change?: { effective_at?: string } | null;
      };
    };
    return {
      ok: true,
      status: data.data?.status ?? "active",
      effectiveAt: data.data?.scheduled_change?.effective_at ?? null,
    };
  } catch {
    return {
      ok: false,
      reason: "could not reach Paddle to cancel the subscription",
    };
  }
}
