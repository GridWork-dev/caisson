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
    required: z.enum(["true", "false"]).optional(),
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
  CF_ACCESS_REQUIRED?: string;
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
    required: env.CF_ACCESS_REQUIRED,
    teamDomain: env.CF_ACCESS_TEAM_DOMAIN,
    audience: env.CF_ACCESS_AUD,
  });
  if (!parsed.success) {
    throw new ConfigError("Invalid Cloudflare Access configuration");
  }
  // Same absent-is-not-opt-out rule as the origin gate (packages/kernel/src/origin-gate.ts): on
  // Cloud Run an omitted CF_ACCESS_REQUIRED would drop the entire Access layer while
  // CF_ACCESS_TEAM_DOMAIN/CF_ACCESS_AUD sit correctly mounted, and admin's sessionExempt paths
  // (/healthz, /login, /api/auth/*, /_next/*) delegate their protection to exactly this layer.
  if (env.K_SERVICE !== undefined && parsed.data.required !== "true") {
    throw new ConfigError("Cloudflare Access is mandatory on Cloud Run");
  }
  if (parsed.data.required !== "true") return { required: false };

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
