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
const BEARER = /^Bearer ([0-9a-f]{64})$/u;

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
  const supplied = Buffer.from(match[1] ?? "", "utf8");
  const expected = Buffer.from(
    createHmac("sha256", config.secret)
      .update(accountResult.data)
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
