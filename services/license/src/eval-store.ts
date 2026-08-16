// The evaluation-access application + grant store (ADR-0274 §2 / ADR-0280). One row per eval
// request through its whole lifecycle: pending_review → approved → issued → (expired | revoked), or
// straight to rejected. Time-boxed, non-renewing, revocable — the fail-closed anti-exfiltration
// grant the verification flow gates.
//
// NOT tenant-scoped (like `license_revocation` / `admin_action_log`): the anti-abuse invariants are
// inherently CROSS-account — "one active eval per org DOMAIN", a GLOBAL concurrent cap, and
// card-fingerprint reuse ACROSS nominally-different applicants (ADR-0280) — which a per-tenant RLS
// policy cannot express. So the table carries no RLS policy and is role-gated by GRANT to
// `admin_write`; every store fn runs inside `withAdminWrite` (the cross-tenant operator seam,
// @caisson/org-controls). This keeps applicant PII (emails, card fingerprints) OFF the buyer `app`
// role entirely — the same posture `license_revocation` takes for the deny-set.
//
// The eval LICENSE is self-contained: on issue we stamp `license_id` + `license_token` on THIS row
// (never a `license_grant` row — an eval and a later real purchase would collide on that table's
// (account, major) uniqueness). Early revocation writes the eval's `license_id` into
// `license_revocation` (the existing edge deny-set); natural window expiry needs no deny-set — the
// signed token's `expiry` fail-closes at the verifier (packages/license-verify) on its own.
import { randomUUID } from "node:crypto";
import { ConflictError, NotFoundError } from "@caisson/kernel";
import type { TenantExecutor } from "@caisson/tenancy-rls";
import type { EvalConfig } from "./eval-verification.ts";

/** Lifecycle states. `active` slot (holds the domain + counts toward the cap) = the first three. */
export const EVAL_ACTIVE_STATUSES = [
  "pending_review",
  "approved",
  "issued",
] as const;
export type EvalStatus =
  | (typeof EVAL_ACTIVE_STATUSES)[number]
  | "rejected"
  | "revoked"
  | "expired";

// No RLS: an operator table, role-gated by GRANT to admin_write (mirrors license_revocation). The
// partial unique index enforces "one ACTIVE eval per org domain" (ADR-0274 floor) — a rejected /
// revoked / expired row frees the domain for a fresh application. `entitlements` is the PURCHASED-id
// scope being evaluated (validated against the registry index at issue, never signed as the
// expansion — the repo invariant). Applied at the operator-gated admin DEPLOY + the PGlite test double.
export const EVAL_APPLICATION_SCHEMA_SQL = `
CREATE TABLE eval_application (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  email text NOT NULL,
  domain text NOT NULL,
  entitlements text[] NOT NULL,
  status text NOT NULL DEFAULT 'pending_review',
  risk integer NOT NULL,
  reason text NOT NULL,
  card_validated boolean NOT NULL DEFAULT false,
  card_fingerprint text,
  license_id text,
  license_token text,
  window_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  issued_at timestamptz,
  CONSTRAINT eval_application_status CHECK (
    status IN ('pending_review','approved','issued','rejected','revoked','expired')
  ),
  -- One-directional: an 'issued' row MUST carry its license fields. A later revoke/expire keeps
  -- them (the historical license the deny-set/audit still references), so this is an implication,
  -- never a biconditional — a terminal row that was once issued legitimately retains the fields.
  CONSTRAINT eval_application_issued_shape CHECK (
    status <> 'issued'
    OR (license_id IS NOT NULL AND license_token IS NOT NULL AND window_end IS NOT NULL)
  )
);

CREATE UNIQUE INDEX eval_application_active_domain_uniq
  ON eval_application (domain)
  WHERE status IN ('pending_review','approved','issued');

GRANT SELECT, INSERT, UPDATE ON eval_application TO admin_write;
`;

/** One eval application row, as read back. */
export interface EvalApplication {
  readonly id: string;
  readonly accountId: string;
  readonly email: string;
  readonly domain: string;
  readonly entitlements: string[];
  readonly status: EvalStatus;
  readonly risk: number;
  readonly reason: string;
  readonly cardValidated: boolean;
  readonly cardFingerprint: string | null;
  readonly licenseId: string | null;
  readonly licenseToken: string | null;
  readonly windowEnd: string | null;
  readonly createdAt: string;
  readonly decidedAt: string | null;
  readonly issuedAt: string | null;
}

interface EvalRow {
  id: string;
  account_id: string;
  email: string;
  domain: string;
  entitlements: string[];
  status: EvalStatus;
  risk: number;
  reason: string;
  card_validated: boolean;
  card_fingerprint: string | null;
  license_id: string | null;
  license_token: string | null;
  window_end: string | null;
  created_at: string;
  decided_at: string | null;
  issued_at: string | null;
}

function toApplication(row: EvalRow): EvalApplication {
  return {
    id: row.id,
    accountId: row.account_id,
    email: row.email,
    domain: row.domain,
    entitlements: row.entitlements,
    status: row.status,
    risk: row.risk,
    reason: row.reason,
    cardValidated: row.card_validated,
    cardFingerprint: row.card_fingerprint,
    licenseId: row.license_id,
    licenseToken: row.license_token,
    windowEnd: row.window_end,
    createdAt: row.created_at,
    decidedAt: row.decided_at,
    issuedAt: row.issued_at,
  };
}

export interface CreateEvalInput {
  accountId: string;
  email: string;
  domain: string;
  entitlements: readonly string[];
  /** The scorer's initial status: 'rejected' (auto_reject) · 'approved' (auto_approve) · 'pending_review' (review). */
  status: "rejected" | "approved" | "pending_review";
  risk: number;
  reason: string;
}

/**
 * Persist a scored eval application. FAIL-CLOSED anti-abuse, checked in-transaction:
 *  - a `rejected` application is always stored (an audit record; it never holds a domain slot, and
 *    the cap does not apply to it);
 *  - an ACTIVE application (approved/pending_review) is refused when the GLOBAL active cap is already
 *    met (`ConflictError`, reason `global-cap`) or the domain already has an active eval
 *    (`ConflictError`, reason `domain-active` — surfaced by the partial-unique-index conflict).
 * Returns the created application. Run inside `withAdminWrite`.
 *
 * // ponytail: the global-cap check is a count-then-insert, so two concurrent creates could both pass
 * // it and land at cap+1 — benign for a low-volume, operator-reviewed surface. The DOMAIN uniqueness
 * // is the hard guarantee (a partial unique index, not a count). Tighten to an advisory lock only if
 * // eval volume ever makes the cap a hard ceiling.
 */
export async function createEvalApplication(
  tx: TenantExecutor,
  input: CreateEvalInput,
  config: EvalConfig,
): Promise<EvalApplication> {
  if (input.status !== "rejected") {
    const c = await tx.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM eval_application
        WHERE status IN ('pending_review','approved','issued')`,
    );
    const active = Number(c.rows[0]?.n ?? "0");
    if (active >= config.globalActiveCap) {
      throw new ConflictError("global-cap");
    }
  }
  // A rejected application stamps decided_at (the decision is final at creation); an active one
  // leaves it NULL (a pending_review awaits the operator; an approved awaits the card leg + issue).
  const decidedAt = input.status === "rejected" ? "now()" : "NULL";
  const r = await tx.query<EvalRow>(
    `INSERT INTO eval_application
       (id, account_id, email, domain, entitlements, status, risk, reason, decided_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ${decidedAt})
     ON CONFLICT (domain) WHERE status IN ('pending_review','approved','issued') DO NOTHING
     RETURNING ${EVAL_COLUMNS}`,
    [
      randomUUID(),
      input.accountId,
      input.email,
      input.domain,
      [...input.entitlements],
      input.status,
      input.risk,
      input.reason,
    ],
  );
  const row = r.rows[0];
  // A rejected row can never conflict on the partial index (the index excludes 'rejected'), so an
  // undefined return here always means an active-domain collision.
  if (row === undefined) {
    throw new ConflictError("domain-active");
  }
  return toApplication(row);
}

const EVAL_COLUMNS =
  "id, account_id, email, domain, entitlements, status, risk, reason, card_validated, card_fingerprint, license_id, license_token, window_end, created_at, decided_at, issued_at";

/** Read one application by id, or null. Run inside `withAdminWrite`. */
export async function readEvalApplication(
  tx: TenantExecutor,
  evalId: string,
): Promise<EvalApplication | null> {
  const r = await tx.query<EvalRow>(
    `SELECT ${EVAL_COLUMNS} FROM eval_application WHERE id = $1`,
    [evalId],
  );
  const row = r.rows[0];
  return row === undefined ? null : toApplication(row);
}

/**
 * Operator review decision on a borderline application (ADR-0280 queue): `pending_review` →
 * `approved` | `rejected`, stamping `decided_at`. FAIL-CLOSED: only a `pending_review` row moves
 * (a re-decide of an already-decided/issued row throws `ConflictError`). Returns the updated row.
 * Run inside `withAdminWrite`. (The HTTP surface for this is the apps/admin review queue — out of
 * scope here; this is the store primitive it calls.)
 */
export async function decideEvalReview(
  tx: TenantExecutor,
  evalId: string,
  decision: "approved" | "rejected",
): Promise<EvalApplication> {
  const r = await tx.query<EvalRow>(
    `UPDATE eval_application
        SET status = $2, decided_at = now()
      WHERE id = $1 AND status = 'pending_review'
      RETURNING ${EVAL_COLUMNS}`,
    [evalId, decision],
  );
  const row = r.rows[0];
  if (row === undefined) {
    // Either no such row, or it was not pending_review. Distinguish for a precise error.
    const existing = await readEvalApplication(tx, evalId);
    if (existing === null) throw new NotFoundError(`eval ${evalId}`);
    throw new ConflictError(
      `eval ${evalId} is ${existing.status}, not pending_review`,
    );
  }
  return toApplication(row);
}

/**
 * Record the card-on-file validation (ADR-0280 card leg: Paddle free-trial checkout, zero charge).
 * Marks `card_validated = true` + stores the card `fingerprint` (the multi-accounting signal). Only
 * an `approved`, not-yet-issued row accepts it (fail-closed). Idempotent on the same fingerprint.
 * Returns the updated row. Run inside `withAdminWrite`. (The Paddle callback that calls this is out
 * of scope here — this is the store primitive + the reuse-signal source below.)
 */
export async function markEvalCardValidated(
  tx: TenantExecutor,
  evalId: string,
  fingerprint: string,
): Promise<EvalApplication> {
  const r = await tx.query<EvalRow>(
    `UPDATE eval_application
        SET card_validated = true, card_fingerprint = $2
      WHERE id = $1 AND status = 'approved'
      RETURNING ${EVAL_COLUMNS}`,
    [evalId, fingerprint],
  );
  const row = r.rows[0];
  if (row === undefined) {
    const existing = await readEvalApplication(tx, evalId);
    if (existing === null) throw new NotFoundError(`eval ${evalId}`);
    throw new ConflictError(
      `eval ${evalId} is ${existing.status}, not approved`,
    );
  }
  return toApplication(row);
}

/**
 * All ACTIVE applications sharing a card `fingerprint`, EXCLUDING `evalId` — the ADR-0280
 * card-fingerprint reuse alert (the same card across nominally-different applicants = a
 * multi-accounting signal to the operator). Cross-account by construction. Run inside `withAdminWrite`.
 */
export async function findActiveEvalsByCardFingerprint(
  tx: TenantExecutor,
  fingerprint: string,
  excludeEvalId: string,
): Promise<EvalApplication[]> {
  const r = await tx.query<EvalRow>(
    `SELECT ${EVAL_COLUMNS} FROM eval_application
      WHERE card_fingerprint = $1 AND id <> $2
        AND status IN ('pending_review','approved','issued')
      ORDER BY created_at`,
    [fingerprint, excludeEvalId],
  );
  return r.rows.map(toApplication);
}

export interface RecordIssuedEvalInput {
  evalId: string;
  licenseId: string;
  licenseToken: string;
  /** ISO-8601 window end — the same instant signed as the token's `expiry`. */
  windowEnd: string;
}

/**
 * Stamp an issued eval license onto its row: `approved` + `card_validated` → `issued`, recording
 * `license_id` / `license_token` / `window_end` / `issued_at`. FAIL-CLOSED: only an approved,
 * card-validated, not-yet-issued row transitions (a card-unvalidated approval, a pending_review, or
 * an already-issued/revoked row throws). Returns the updated row. Run inside `withAdminWrite`.
 */
export async function recordIssuedEval(
  tx: TenantExecutor,
  input: RecordIssuedEvalInput,
): Promise<EvalApplication> {
  const r = await tx.query<EvalRow>(
    `UPDATE eval_application
        SET status = 'issued', license_id = $2, license_token = $3,
            window_end = $4, issued_at = now()
      WHERE id = $1 AND status = 'approved' AND card_validated = true
      RETURNING ${EVAL_COLUMNS}`,
    [input.evalId, input.licenseId, input.licenseToken, input.windowEnd],
  );
  const row = r.rows[0];
  if (row === undefined) {
    const existing = await readEvalApplication(tx, input.evalId);
    if (existing === null) throw new NotFoundError(`eval ${input.evalId}`);
    throw new ConflictError(
      `eval ${input.evalId} not issuable (status=${existing.status}, cardValidated=${String(existing.cardValidated)})`,
    );
  }
  return toApplication(row);
}

/**
 * Revoke an eval (ADR-0274 "revocable ... deny-set applies immediately on abuse"): any active
 * (pending_review/approved/issued) row → `revoked`. When the eval had already been ISSUED, its
 * signed `license_id` is written to the edge deny-set (`license_revocation`) so the offline token is
 * killed BEFORE its natural window expiry. Idempotent (an already-terminal row is a no-op → returns
 * false). Returns whether a row was revoked. Run inside `withAdminWrite`.
 */
export async function revokeEval(
  tx: TenantExecutor,
  evalId: string,
  reason: string | null = "eval-revoked",
): Promise<boolean> {
  // RETURNING both license_id AND account_id in the SAME UPDATE (IN-03) — the row already carries
  // its own account_id, so a second SELECT (readEvalApplication) to fetch it back is redundant
  // (and, between the UPDATE and a separate read, would be racing a theoretical concurrent write).
  const r = await tx.query<{ license_id: string | null; account_id: string }>(
    `UPDATE eval_application
        SET status = 'revoked'
      WHERE id = $1 AND status IN ('pending_review','approved','issued')
      RETURNING license_id, account_id`,
    [evalId],
  );
  const row = r.rows[0];
  if (row === undefined) return false;
  if (row.license_id !== null) {
    // Kill the offline token at the edge immediately (the deny-set the Worker reads). The eval's
    // account id anchors the row like any other revocation; no admin_action_id (this is not an
    // apps/admin purchase_revoke action).
    await tx.query(
      `INSERT INTO license_revocation (license_id, account_id, admin_action_id, reason)
       VALUES ($1, $2, NULL, $3)
       ON CONFLICT (license_id) DO NOTHING`,
      [row.license_id, row.account_id, reason],
    );
  }
  return true;
}

/**
 * Bookkeeping sweep (idempotent): flip `issued` rows whose `window_end` has elapsed → `expired`, and
 * `pending_review` / `approved` rows older than `applicationTtlDays` → `expired` (a stale application
 * must not hold its domain slot forever). This is STATE hygiene + frees the domain slot; it is NOT
 * the access gate — an issued eval's offline token already fail-closes at its signed `expiry` the
 * instant the window passes, with or without this sweep. Returns the number of rows expired. Run
 * inside `withAdminWrite`. `now` is injectable for deterministic tests.
 */
export async function expireEvals(
  tx: TenantExecutor,
  config: EvalConfig,
  now: Date = new Date(),
): Promise<number> {
  const nowIso = now.toISOString();
  const r = await tx.query<{ id: string }>(
    `UPDATE eval_application
        SET status = 'expired'
      WHERE (status = 'issued' AND window_end < $1)
         OR (status IN ('pending_review','approved')
             AND created_at < ($1::timestamptz - ($2 || ' days')::interval))
      RETURNING id`,
    [nowIso, String(config.applicationTtlDays)],
  );
  return r.rows.length;
}
