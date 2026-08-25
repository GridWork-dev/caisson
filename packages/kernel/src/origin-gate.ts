import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { ConfigError } from "./errors.ts";

export const ORIGIN_SECRET_HEADER = "x-gridwork-origin-secret";

const encodedSecretSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/);

const originEnvSchema = z
  .object({
    runtime: z.string().optional(),
    mode: z.string().optional(),
    current: z.string().optional(),
    next: z.string().optional(),
  })
  .strict();

const presentedHeaderSchema = z
  .object({ secret: encodedSecretSchema })
  .strict();

export interface OriginGateConfig {
  required: boolean;
  secrets: readonly Buffer[];
}

export interface OriginGateEnv {
  readonly [key: string]: string | undefined;
  NODE_ENV?: string;
  ORIGIN_SECRET_MODE?: string;
  ORIGIN_SECRET?: string;
  ORIGIN_SECRET_NEXT?: string;
}

export function originVerificationDisabledFor(
  nodeEnvironment: string | undefined,
  mode: string | undefined,
): boolean {
  return (
    mode === "disabled" &&
    (nodeEnvironment === "development" || nodeEnvironment === "test")
  );
}

export function loadOriginGateConfig(env: OriginGateEnv): OriginGateConfig {
  const parsed = originEnvSchema.safeParse({
    runtime: env.NODE_ENV,
    mode: env.ORIGIN_SECRET_MODE,
    current: env.ORIGIN_SECRET,
    next: env.ORIGIN_SECRET_NEXT,
  });
  if (!parsed.success) {
    throw new ConfigError("Invalid origin verification configuration");
  }
  // Doc 04 §4: fail closed by construction. An absent mode is armed, and production cannot opt
  // out under any mode value. Only an explicit local/test opt-out disables verification.
  if (originVerificationDisabledFor(parsed.data.runtime, parsed.data.mode)) {
    return { required: false, secrets: [] };
  }

  const current = encodedSecretSchema.safeParse(parsed.data.current);
  const next =
    parsed.data.next === undefined
      ? undefined
      : encodedSecretSchema.safeParse(parsed.data.next);
  if (!current.success || (next !== undefined && !next.success)) {
    throw new ConfigError(
      "Origin verification requires canonical 32-byte base64url secrets",
    );
  }

  const secrets = [
    Buffer.from(current.data, "base64url"),
    ...(next === undefined ? [] : [Buffer.from(next.data, "base64url")]),
  ];
  return { required: true, secrets };
}

export function originRequestAuthorized(
  request: Request,
  config: OriginGateConfig,
): boolean {
  if (!config.required) return true;

  const parsed = presentedHeaderSchema.safeParse({
    secret: request.headers.get(ORIGIN_SECRET_HEADER),
  });
  if (!parsed.success) return false;

  const presented = Buffer.from(parsed.data.secret, "base64url");
  let matched = false;
  for (const expected of config.secrets) {
    if (
      presented.length === expected.length &&
      timingSafeEqual(presented, expected)
    ) {
      matched = true;
    }
  }
  return matched;
}
