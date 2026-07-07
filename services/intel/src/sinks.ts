// Alert sinks — two custom `AlertChannel`s the error-triage watcher drives through
// `@caisson/alerting`'s `processAlert`. Both are OPERATOR-configured destinations (env), not
// buyer-supplied URLs, so they deliberately skip the SSRF resolve-guard the package's built-in
// channels run on buyer destinations. Each self-catches into a failed DeliveryResult (per-channel
// isolation) and never puts a response body in an error — a body can echo a token or PII.
import { z } from "zod";
import { InternalError } from "@caisson/kernel";
import type {
  AlertChannel,
  AlertEvent,
  DeliveryResult,
} from "@caisson/alerting";
import type { Config } from "./config.ts";
import type { Fetcher } from "./http.ts";

const TIMEOUT_MS = 10_000;

function toError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export interface TgBridgeConfig {
  url: string;
  token: string;
}

/** Push to the operator's Telegram bridge `/alert` endpoint (Bearer-authed, loopback/tailnet). */
export function createTgBridgeChannel(
  config: TgBridgeConfig,
  fetchImpl: Fetcher,
): AlertChannel {
  return {
    name: "tg-bridge",
    async deliver(event: AlertEvent): Promise<DeliveryResult> {
      try {
        const res = await fetchImpl(
          config.url,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${config.token}`,
            },
            body: JSON.stringify({
              severity: event.severity,
              title: event.title,
              body: event.body,
              source: event.type,
            }),
            redirect: "error",
          },
          { timeoutMs: TIMEOUT_MS },
        );
        if (!res.ok) throw new InternalError("tg-bridge alert delivery failed");
        return { channel: "tg-bridge", ok: true };
      } catch (err) {
        return { channel: "tg-bridge", ok: false, error: toError(err) };
      }
    },
  };
}

export interface LinearConfig {
  apiKey: string;
  teamId: string;
}

const LINEAR_ENDPOINT = "https://api.linear.app/graphql";
const ISSUE_CREATE = `mutation IssueCreate($input: IssueCreateInput!) {
  issueCreate(input: $input) { success issue { identifier url } }
}`;

// GraphQL answers 200 even on error, so success is read from the body, not the status.
const LinearResponse = z.object({
  data: z
    .object({ issueCreate: z.object({ success: z.boolean() }).optional() })
    .optional(),
  errors: z.array(z.unknown()).optional(),
});

/** File a Linear Triage issue. Personal API keys authenticate as the raw `Authorization` value
 *  (no `Bearer` prefix — that form is OAuth-only). */
export function createLinearTriageChannel(
  config: LinearConfig,
  fetchImpl: Fetcher,
): AlertChannel {
  return {
    name: "linear",
    async deliver(event: AlertEvent): Promise<DeliveryResult> {
      try {
        const res = await fetchImpl(
          LINEAR_ENDPOINT,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: config.apiKey,
            },
            body: JSON.stringify({
              query: ISSUE_CREATE,
              variables: {
                input: {
                  teamId: config.teamId,
                  title: event.title,
                  description: event.body,
                },
              },
            }),
            redirect: "error",
          },
          { timeoutMs: TIMEOUT_MS },
        );
        if (!res.ok) throw new InternalError("linear issue create failed");
        const body: unknown = await res.json();
        const parsed = LinearResponse.safeParse(body);
        if (
          !parsed.success ||
          parsed.data.errors !== undefined ||
          parsed.data.data?.issueCreate?.success !== true
        ) {
          throw new InternalError("linear issue create rejected");
        }
        return { channel: "linear", ok: true };
      } catch (err) {
        return { channel: "linear", ok: false, error: toError(err) };
      }
    },
  };
}

/** The alert channels enabled by config — tg-bridge when its url+token are set, Linear when its
 *  key+team are set. An empty list is valid: findings still persist, alerts just go nowhere. */
export function buildAlertChannels(
  config: Config,
  fetchImpl: Fetcher,
): AlertChannel[] {
  const channels: AlertChannel[] = [];
  if (
    config.tgBridgeAlertUrl !== undefined &&
    config.tgBridgeAlertToken !== undefined
  ) {
    channels.push(
      createTgBridgeChannel(
        { url: config.tgBridgeAlertUrl, token: config.tgBridgeAlertToken },
        fetchImpl,
      ),
    );
  }
  if (config.linearApiKey !== undefined && config.linearTeamId !== undefined) {
    channels.push(
      createLinearTriageChannel(
        { apiKey: config.linearApiKey, teamId: config.linearTeamId },
        fetchImpl,
      ),
    );
  }
  return channels;
}
