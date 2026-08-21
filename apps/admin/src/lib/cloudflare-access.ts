import { z } from "zod";
import { ConfigError } from "@caisson/kernel";
import { fetchWithTimeout } from "@caisson/kernel/fetch";
import {
  createRemoteJWKSet,
  customFetch,
  jwtVerify,
  type JWTVerifyGetKey,
} from "jose";

const teamDomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(253)
  .regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+cloudflareaccess\.com$/);

const accessEnvSchema = z
  .object({
    runtime: z.string().optional(),
    mode: z.string().optional(),
    teamDomain: teamDomainSchema.optional(),
    audience: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  })
  .strict();

const identityClaimsSchema = z
  .object({
    type: z.literal("app"),
    email: z.string().trim().email().max(320),
    subject: z.string().trim().min(1).max(256),
    identityNonce: z.string().trim().min(1).max(256),
    issuedAt: z.number().int().nonnegative(),
    notBefore: z.number().int().nonnegative(),
    expiresAt: z.number().int().positive(),
  })
  .strict();

export interface CloudflareAccessEnv {
  readonly [key: string]: string | undefined;
  NODE_ENV?: string;
  CF_ACCESS_MODE?: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
}

export type CloudflareAccessConfig =
  | { required: false }
  | {
      required: true;
      issuer: string;
      audience: string;
      jwks: JWTVerifyGetKey;
    };

function remoteJwks(issuer: string): JWTVerifyGetKey {
  const certsUrl = new URL("/cdn-cgi/access/certs", issuer);
  return createRemoteJWKSet(certsUrl, {
    timeoutDuration: 6_000,
    [customFetch]: (url, { headers, method, redirect }) =>
      fetchWithTimeout(
        url,
        { headers, method, redirect },
        { timeoutMs: 5_000 },
      ),
  });
}

export function loadCloudflareAccessConfig(
  env: CloudflareAccessEnv,
): CloudflareAccessConfig {
  const parsed = accessEnvSchema.safeParse({
    runtime: env.NODE_ENV,
    mode: env.CF_ACCESS_MODE,
    teamDomain: env.CF_ACCESS_TEAM_DOMAIN,
    audience: env.CF_ACCESS_AUD,
  });
  if (!parsed.success) {
    throw new ConfigError("Invalid Cloudflare Access configuration");
  }
  // Mirror the origin gate's fail-closed arming semantics. An absent mode stays armed, and no
  // production value can disable Access. Only an exact local/test opt-out bypasses it.
  if (
    parsed.data.mode === "disabled" &&
    (parsed.data.runtime === "development" || parsed.data.runtime === "test")
  ) {
    return { required: false };
  }

  if (
    parsed.data.teamDomain === undefined ||
    parsed.data.audience === undefined
  ) {
    throw new ConfigError(
      "Cloudflare Access requires a team domain and application audience",
    );
  }

  const issuer = new URL(`https://${parsed.data.teamDomain}`).origin;
  return {
    required: true,
    issuer,
    audience: parsed.data.audience,
    jwks: remoteJwks(issuer),
  };
}

export async function verifyCloudflareAccessRequest(
  request: Request,
  config: CloudflareAccessConfig,
): Promise<boolean> {
  if (!config.required) return true;

  const token = request.headers.get("cf-access-jwt-assertion");
  if (token === null || token.length === 0) return false;

  try {
    const { payload } = await jwtVerify(token, config.jwks, {
      algorithms: ["RS256"],
      issuer: config.issuer,
      audience: config.audience,
    });
    return identityClaimsSchema.safeParse({
      type: payload.type,
      email: payload.email,
      subject: payload.sub,
      identityNonce: payload.identity_nonce,
      issuedAt: payload.iat,
      notBefore: payload.nbf,
      expiresAt: payload.exp,
    }).success;
  } catch {
    return false;
  }
}
