import { z } from "zod";

const requiredCredentialKeys = [
  "CAISSON_E2E_ACCOUNT_EMAIL",
  "CAISSON_E2E_ACCOUNT_PASSWORD",
  "CAISSON_E2E_CF_CLIENT_ID",
  "CAISSON_E2E_CF_CLIENT_SECRET",
] as const;

const ADMIN_SESSION_URL = "https://admin.caisson.sh/api/auth/get-session";
const nonEmptyRecord = z
  .record(z.unknown())
  .refine((value) => Object.keys(value).length > 0);
const adminSessionSchema = z
  .object({
    session: nonEmptyRecord,
    user: nonEmptyRecord,
  })
  .strict();

/** A browser-profile-bound fetch adapter. Its cookie jar stays inside the Computer Use profile. */
export type ProfileFetcher = (
  url: string,
  init: RequestInit,
) => Promise<Response>;

/**
 * Probe Ring 3 through the selected browser profile. Returns liveness only: no cookie, session id,
 * email, user id, response body, or value length crosses the preflight boundary.
 */
export async function probeAdminSession(
  profileFetch: ProfileFetcher,
): Promise<boolean> {
  let response: Response;
  try {
    response = await profileFetch(ADMIN_SESSION_URL, {
      method: "GET",
      credentials: "include",
      headers: { accept: "application/json" },
      cache: "no-store",
      redirect: "error",
    });
  } catch {
    return false;
  }
  if (!response.ok) return false;
  try {
    const body: unknown = await response.json();
    return adminSessionSchema.safeParse(body).success;
  } catch {
    return false;
  }
}

export const deniedMutations = [
  "real-purchase",
  "irreversible-cancel",
  "account-deletion",
  "identity-change",
  "email-change",
  "password-change",
  "permission-change",
  "real-recipient-message",
  "file-upload",
  "non-fixture-admin-mutation",
] as const;

const inputSchema = z
  .object({
    env: z.record(z.string().optional()),
    buyerProfile: z.string().trim().min(1),
    adminProfile: z.string().trim().min(1),
    adminSessionLive: z.boolean(),
    unresolvedMutations: z.number().int().nonnegative(),
  })
  .strict();

export function runPreflight(input: unknown) {
  const parsed = inputSchema.parse(input);
  const unsafeNames = new Set(["default", "personal", "shared", "guest"]);
  if (
    unsafeNames.has(parsed.buyerProfile.toLowerCase()) ||
    unsafeNames.has(parsed.adminProfile.toLowerCase()) ||
    parsed.buyerProfile === parsed.adminProfile
  ) {
    throw new Error("authenticated rings require separate dedicated profiles");
  }
  if (!parsed.adminSessionLive)
    throw new Error("admin profile session is expired, stale, or unknown");
  if (parsed.unresolvedMutations > 0) {
    throw new Error("unresolved cleanup journal blocks authenticated mutation");
  }
  const present = (key: (typeof requiredCredentialKeys)[number]): boolean =>
    typeof parsed.env[key] === "string" && parsed.env[key] !== "";
  return {
    ok: requiredCredentialKeys.every(present),
    credentials: {
      accountEmail: present("CAISSON_E2E_ACCOUNT_EMAIL"),
      accountPassword: present("CAISSON_E2E_ACCOUNT_PASSWORD"),
      cfClientId: present("CAISSON_E2E_CF_CLIENT_ID"),
      cfClientSecret: present("CAISSON_E2E_CF_CLIENT_SECRET"),
    },
    profiles: { buyerDedicated: true, adminSeparateAndLive: true },
    unresolvedCleanup: false,
    deniedMutations,
  } as const;
}
