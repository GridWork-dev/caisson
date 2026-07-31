import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const accountIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(256)
  .refine(
    // eslint-disable-next-line no-control-regex -- the account id becomes HMAC input and a server-side storage selector.
    (value) => !/[\u0000-\u001f\u007f-\u009f\s]/u.test(value),
    "account id has whitespace or control characters",
  );
const privateHostSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(253)
  .regex(/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/u)
  .refine(
    (value) => value.endsWith(".railway.internal"),
    "internal proof host must use Railway private DNS",
  );
const configSchema = z
  .object({
    secret: z.string().trim().min(32).max(4096),
    internalHost: privateHostSchema,
  })
  .strict();
// Credential format (release-audit v2026.07.27.1 F3): the issuer sends "<unix-seconds>.<hmac-hex>"
// where the HMAC covers "<unix-seconds>\n<accountId>" (the account id schema rejects whitespace, so
// "\n" is an unambiguous separator), giving the bearer a bounded lifetime instead of being valid
// until the secret rotates.
//
// The pre-F3 bare-hex form (HMAC over the account id alone, no expiry) was accepted alongside it
// ONLY so this verifier could deploy ahead of the issuer without 401ing the seam mid-rollout. That
// window closed with the v2026.07.30 train, whose leg 4 deployed both halves at `d9ae893e` — admin
// 19:21:41Z, then site 19:24:27Z — so the timestamp is now mandatory. Keeping it optional would
// have left F3 unmet: a leaked pre-F3 credential stays valid until the secret rotates, which is the
// exact hole the timestamp exists to close.
const BEARER = /^Bearer (\d{1,13})\.([0-9a-f]{64})$/u;
/** Accept a timestamped credential minted within this many seconds, either direction (skew). */
const TIMESTAMP_WINDOW_SEC = 300;

export type InternalProofAuthConfig = z.infer<typeof configSchema>;

export function parseInternalProofAuthConfig(input: {
  readonly secret: string | undefined;
  readonly internalHost: string | undefined;
}): InternalProofAuthConfig | null {
  const parsed = configSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

export function authenticateInternalProofRequest(
  request: Request,
  config: InternalProofAuthConfig,
  nowMs: number = Date.now(),
): { readonly accountId: string } | null {
  let requestHost: string;
  try {
    requestHost = new URL(request.url).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (requestHost !== config.internalHost) return null;

  const accountResult = accountIdSchema.safeParse(
    request.headers.get("x-caisson-account-id"),
  );
  if (!accountResult.success) return null;

  const match = request.headers.get("authorization")?.match(BEARER);
  if (match === undefined || match === null) return null;
  const timestamp = match[1] ?? "";
  const issuedAtSec = Number.parseInt(timestamp, 10);
  const nowSec = Math.floor(nowMs / 1000);
  // Fail-closed shape: the negated comparison rejects on NaN instead of falling through.
  if (!(Math.abs(nowSec - issuedAtSec) <= TIMESTAMP_WINDOW_SEC)) return null;
  const supplied = Buffer.from(match[2] ?? "", "utf8");
  const expected = Buffer.from(
    createHmac("sha256", config.secret)
      .update(`${timestamp}\n${accountResult.data}`)
      .digest("hex"),
    "utf8",
  );
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    return null;
  }
  return { accountId: accountResult.data };
}
