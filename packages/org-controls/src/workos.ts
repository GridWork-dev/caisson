// WorkOS SSO transport seam (ADR-0172). Sign-in scope ONLY — org provisioning/SCIM is ADR-0176, a
// different package. This module is framework-agnostic: it builds the WorkOS AuthKit/SSO
// authorization URL and exchanges the callback `code` for the authenticated user's id + email over
// api.workos.com. apps/site wires these two functions into better-auth's genericOAuth/SSO plugin
// config in a separate step — this package never imports better-auth.
//
// Lives in @caisson-sh/org-controls rather than @caisson-sh/auth (ADR-0257 §1.3): SSO is an org-level
// surface, so it belongs with the org module rather than the auth substrate.
import {
  ConfigError,
  InternalError,
  fetchWithTimeout,
  parseStrict,
  strictObject,
} from "@caisson-sh/kernel";
import { z } from "zod";

export interface WorkosSsoConfig {
  clientId: string;
  /** The WorkOS API key — sent as `client_secret` in the token exchange, never a module constant. */
  apiKey: string;
  /** A specific WorkOS Connection id. Omitted falls back to the AuthKit-managed authorize flow. */
  connectionId?: string;
  redirectUri: string;
}

export interface WorkosSsoProfile {
  userId: string;
  email: string;
}

/** The transport seam better-auth's SSO wiring needs: build the redirect, resolve the callback. */
export interface WorkosSsoProvider {
  authorizationUrl(state: string): string;
  exchangeCode(code: string): Promise<WorkosSsoProfile>;
}

const AUTHORIZE_ENDPOINT = "https://api.workos.com/sso/authorize";
const TOKEN_ENDPOINT = "https://api.workos.com/sso/token";

// WorkOS "Get a Profile and Token" response shape (docs.workos.com/reference/sso/profile). Strict
// at the boundary — an unexpected field or type on this response fails closed rather than silently
// passing through unvalidated data.
const tokenResponseSchema = strictObject({
  access_token: z.string(),
  profile: strictObject({
    object: z.literal("profile"),
    id: z.string(),
    connection_id: z.string(),
    connection_type: z.string(),
    organization_id: z.string().optional(),
    email: z.string(),
    first_name: z.string().nullable().optional(),
    last_name: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    idp_id: z.string(),
    role: z.unknown().optional(),
    custom_attributes: z.unknown().optional(),
  }),
});

/**
 * The WorkOS SSO driver. Config is injected — the package never reads `WORKOS_*` env itself; the
 * caller env-gates and passes config, exactly like the Resend/Paddle/Trigger.dev drivers. Fails
 * closed with `ConfigError` at construction when required config is missing, rather than at the
 * first call.
 */
export function createWorkosSsoProvider(
  config: WorkosSsoConfig,
): WorkosSsoProvider {
  if (
    config.clientId.length === 0 ||
    config.apiKey.length === 0 ||
    config.redirectUri.length === 0
  ) {
    throw new ConfigError(
      "createWorkosSsoProvider requires `clientId`, `apiKey`, and `redirectUri`",
    );
  }

  return {
    authorizationUrl(state: string): string {
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: "code",
        state,
      });
      if (config.connectionId !== undefined) {
        params.set("connection", config.connectionId);
      } else {
        params.set("provider", "authkit");
      }
      return `${AUTHORIZE_ENDPOINT}?${params.toString()}`;
    },

    async exchangeCode(code: string): Promise<WorkosSsoProfile> {
      const res = await fetchWithTimeout(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_id: config.clientId,
          client_secret: config.apiKey,
          code,
          grant_type: "authorization_code",
        }),
      });
      if (!res.ok) {
        // Do NOT include the response body — it can echo the client secret or user PII.
        throw new InternalError("WorkOS SSO code exchange failed");
      }
      const data = parseStrict(tokenResponseSchema, await res.json());
      return { userId: data.profile.id, email: data.profile.email };
    },
  };
}
