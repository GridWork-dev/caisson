// Pure allowlist logic for ADR-0283: the GitHub numeric-user-id allowlist gating admin sign-in.
// Kept dependency-free (no better-auth, no DB) so it unit-tests instantly and both the
// databaseHooks reject-at-signup gate (admin-auth-server.ts) and the per-request session recheck
// (admin-session.ts) share ONE source of truth for "is this id allowed" — NEVER the GitHub
// username/login (renameable/re-registerable; ADR-0283 pins the immutable numeric id instead).
//
// Fail-closed by construction: a missing/blank ADMIN_GITHUB_ALLOWED_USER_IDS env parses to an
// EMPTY Set, and an empty Set matches nothing — never "allow all" by omission.

/**
 * Parse the comma-separated numeric-id allowlist env into a Set. Non-numeric / blank entries are
 * dropped silently (a malformed id can never match anyone, and a typo in one entry must not break
 * parsing of the rest).
 */
export function parseAllowedGithubIds(raw: string | undefined): Set<string> {
  const ids = new Set<string>();
  if (raw === undefined) return ids;
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (/^[0-9]+$/.test(id)) ids.add(id);
  }
  return ids;
}

/**
 * Whether `githubAccountId` (the raw GitHub numeric user id, as a string — e.g. the OAuth
 * account's `accountId`) is on the allowlist. An EMPTY allowlist always denies, so a missing or
 * fully-blank env can never resolve to allow-all.
 */
export function isAllowedGithubId(
  githubAccountId: string,
  allowed: Set<string>,
): boolean {
  return allowed.size > 0 && allowed.has(githubAccountId.trim());
}
