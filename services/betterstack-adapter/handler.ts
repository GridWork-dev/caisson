// Better Stack → Discord reshaper (CAISSON-53). Better Stack's Uptime plan alerts natively to
// email/Slack only; this is a minimal, stateless Cloudflare Worker that receives Better Stack's
// "Incident" outgoing webhook, validates + optionally authenticates it, and reshapes it into a
// Discord embed POST — unifying uptime alerts into the same ops Discord channel as the
// job/watcher alerting wired the same wave (packages/alerting's createDiscordChannel).
//
// Payload shape confirmed against Better Stack's own docs (get_code_context_exa, 2026-07-09):
//   https://betterstack.com/docs/uptime/api/create-outgoing-webhook-integration/ (the worked
//   `incident_change` example) + https://betterstack.com/docs/uptime/api/incidents-api-response-params/
//   (the full attributes table). The confirmed default `incident_change` webhook body:
//     { event?: string, data: { id, type: "incident",
//         attributes: { name, url, http_method, cause, started_at, acknowledged_at, resolved_at,
//                        response_content, response_url, screenshot_url, ...many more },
//         relationships?: { monitor?: { data: { id } } } },
//       comment?: {...} }  // present only when event === "comment"
// The `attributes` object carries MANY more fields than this adapter reads (team_name,
// incident_group_id, metadata, screenshot_url, ...) — the inner schema below is DELIBERATELY NOT
// `.strict()`. A `.strict()` provider-webhook envelope has broken every real delivery before in
// this repo (a hard-won P0 lesson — see PR #114 / knowledge memory
// "remediation-closeout-live-proofs": "never .strict() a provider webhook envelope"). Better
// Stack's payload evolves independent of what this adapter needs; only the outer route/response
// contract this Worker itself owns is strict.
//
// Auth: Better Stack does not sign outgoing webhooks — confirmed via
// https://betterstack.com/docs/errors/integrations/outgoing-webhooks/: "Webhook requests are not
// signed. Set up Basic HTTP authentication or add a custom header with a secret value and check
// it on your server." This Worker expects the operator to configure a custom header
// (`X-Betterstack-Secret: <value>`, via Better Stack's outgoing-webhook "Headers" advanced
// setting) carrying the same value as `BETTERSTACK_WEBHOOK_SECRET`. FAIL CLOSED: a public
// `workers_dev` endpoint with `BETTERSTACK_WEBHOOK_SECRET` unset rejects every request (401)
// unless `ALLOW_UNAUTHENTICATED` is explicitly set — a local-dev-only opt-out, never set on a
// real deploy (see README.md).
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { fetchWithTimeout } from "@caisson/kernel";

export type Fetcher = typeof fetchWithTimeout;

const HEADER_NAME = "x-betterstack-secret";
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

/**
 * SHA-256-then-`timingSafeEqual` — the variable-length-secret posture (`identity/security.md`):
 * a raw variable-length `timingSafeEqual` throws on a length mismatch, which leaks a boolean side
 * channel through caught-exception control flow. The operator-set header value is arbitrary
 * length, so hash both sides to a fixed 32-byte digest first.
 */
export function secretsMatch(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

// Not `.strict()` — see the module doc. Only the fields this adapter reads are declared.
const IncidentAttributesSchema = z.object({
  name: z.string().trim().min(1).max(500),
  url: z.string().trim().min(1).max(2000).optional(),
  http_method: z.string().trim().max(20).optional(),
  cause: z.string().trim().max(2000).optional(),
});

// The outer envelope IS strict about the shape it requires (`data`/`data.type`), but not about
// extra sibling keys Better Stack may add (e.g. `comment`, present only on comment events) — those
// are simply ignored, not rejected, since a real Better Stack payload always ships more top-level
// context than this adapter reads.
const IncidentWebhookBodySchema = z.object({
  event: z.string().trim().min(1).max(50).optional(),
  data: z.object({
    id: z.string().trim().min(1),
    type: z.literal("incident"),
    attributes: IncidentAttributesSchema,
    relationships: z
      .object({
        monitor: z
          .object({ data: z.object({ id: z.string().trim().min(1) }) })
          .optional(),
      })
      .optional(),
  }),
});
export type IncidentWebhookBody = z.infer<typeof IncidentWebhookBodySchema>;

const RESOLVED_COLOR = 0x2ecc71; // green
const TRIGGERED_COLOR = 0xe74c3c; // red
const INFO_COLOR = 0x3498db; // blue — acknowledged/reopened/comment: informational, not an outage

/**
 * Better Stack's `event` field (`created`/`acknowledged`/`resolved`/`reopened`/`comment` per
 * their docs) is treated permissively (substring match, not a strict enum) — the exact literal
 * spelling isn't pinned by any example this adapter's research turned up beyond `comment`, and a
 * permissive classifier degrading to TRIGGERED on an unrecognized value is the safer default
 * direction (never silently swallowing a real incident under an unfamiliar event name).
 */
export function classifyEvent(event: string | undefined): {
  label: string;
  color: number;
} {
  const e = (event ?? "").toLowerCase();
  if (e.includes("resolved"))
    return { label: "RESOLVED", color: RESOLVED_COLOR };
  if (e.includes("comment")) return { label: "COMMENT", color: INFO_COLOR };
  if (e.includes("acknowledged"))
    return { label: "ACKNOWLEDGED", color: INFO_COLOR };
  return { label: "TRIGGERED", color: TRIGGERED_COLOR };
}

// Discord's hard per-embed caps (title 256, field value 1024) — the schema above allows a `name`
// up to 500 and a `url`/`cause` up to 2000, both of which can exceed these, so a truncation-free
// embed can 400 at Discord and silently drop the alert. Mirrors the same slice-before-send intent
// as the sibling channel in packages/alerting/src/channels.ts (Discord description cap).
const DISCORD_TITLE_LIMIT = 256;
const DISCORD_FIELD_VALUE_LIMIT = 1024;

export function toDiscordEmbed(body: IncidentWebhookBody): unknown {
  const { attributes } = body.data;
  const { label, color } = classifyEvent(body.event);
  const fields: Array<{ name: string; value: string; inline: boolean }> = [];
  if (attributes.url !== undefined) {
    fields.push({
      name: "Monitor",
      value: attributes.url.slice(0, DISCORD_FIELD_VALUE_LIMIT),
      inline: true,
    });
  }
  if (attributes.cause !== undefined) {
    fields.push({
      name: "Cause",
      value: attributes.cause.slice(0, DISCORD_FIELD_VALUE_LIMIT),
      inline: true,
    });
  }
  return {
    embeds: [
      {
        title: `[${label}] ${attributes.name}`.slice(0, DISCORD_TITLE_LIMIT),
        color,
        fields,
      },
    ],
  };
}

export interface Env {
  /** The operator's Discord ops-channel webhook. Required — a 500 with no delivery attempted
   *  while unset (never silently drop an incident). */
  DISCORD_OPS_WEBHOOK_URL?: string;
  /** The shared secret — see the module doc's Auth section. Required on a real deploy; a public
   *  `workers_dev` endpoint with no secret configured fails closed (401) rather than accepting
   *  unauthenticated POSTs. */
  BETTERSTACK_WEBHOOK_SECRET?: string;
  /** Local-dev-only escape hatch: any non-empty value lets a request through when
   *  `BETTERSTACK_WEBHOOK_SECRET` is unset. Never set this on a real deploy. */
  ALLOW_UNAUTHENTICATED?: string;
}

/**
 * The route handler: `Fetcher`-injectable so tests never touch the network (mirrors this repo's
 * `services/intel` `Fetcher` DI convention). Fail-closed on a bad signature (401) or a malformed
 * body (400); the Discord destination is operator-configured (a Worker secret, not
 * buyer/attacker-supplied), so — like `services/intel/src/sinks.ts`'s tg-bridge/Linear
 * channels — this deliberately skips the buyer-facing SSRF resolve-guard `@caisson/alerting`'s
 * channels run.
 */
export async function handleRequest(
  request: Request,
  env: Env,
  fetchImpl: Fetcher = fetchWithTimeout,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const secret = env.BETTERSTACK_WEBHOOK_SECRET;
  if (secret === undefined || secret.length === 0) {
    // Fail closed: a public workers_dev endpoint with no shared secret must refuse traffic, not
    // silently accept it — mirrors services/license/src/deploy.ts's fail-closed posture on a
    // missing DATABASE_URL. ALLOW_UNAUTHENTICATED is the explicit local-dev opt-out.
    const devOverride = env.ALLOW_UNAUTHENTICATED;
    if (devOverride === undefined || devOverride.length === 0) {
      return jsonResponse({ error: "unauthorized" }, 401);
    }
  } else {
    const provided = request.headers.get(HEADER_NAME) ?? "";
    if (provided === "" || !secretsMatch(provided, secret)) {
      return jsonResponse({ error: "unauthorized" }, 401);
    }
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const parsed = IncidentWebhookBodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse({ error: "unexpected_payload_shape" }, 400);
  }

  const webhookUrl = env.DISCORD_OPS_WEBHOOK_URL;
  if (webhookUrl === undefined || webhookUrl.length === 0) {
    return jsonResponse({ error: "not_configured" }, 500);
  }

  try {
    const res = await fetchImpl(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(toDiscordEmbed(parsed.data)),
      // No redirect-follow: the destination is a fixed operator secret, a real Discord webhook
      // never legitimately redirects.
      redirect: "error",
    });
    if (!res.ok) {
      return jsonResponse({ error: "discord_delivery_failed" }, 502);
    }
  } catch {
    return jsonResponse({ error: "discord_delivery_failed" }, 502);
  }

  return jsonResponse({ ok: true }, 200);
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },
};
