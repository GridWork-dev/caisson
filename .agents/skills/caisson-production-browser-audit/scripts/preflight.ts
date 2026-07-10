import { z } from "zod";

const requiredCredentialKeys = [
  "CAISSON_E2E_ACCOUNT_EMAIL",
  "CAISSON_E2E_ACCOUNT_PASSWORD",
  "CAISSON_E2E_CF_CLIENT_ID",
  "CAISSON_E2E_CF_CLIENT_SECRET",
] as const;

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
    adminAuthorized: z.boolean(),
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
  if (!parsed.adminAuthorized)
    throw new Error("admin profile authorization is stale or unknown");
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
    profiles: { buyerDedicated: true, adminSeparateAndAuthorized: true },
    unresolvedCleanup: false,
    deniedMutations,
  } as const;
}
