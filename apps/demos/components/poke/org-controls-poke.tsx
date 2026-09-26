"use client";

// The org-controls module's poke (ADR-0378 lock 2) — a live run of the package's REAL owner-only
// membership gate. The hand-ported mirror (org-controls-logic.ts) is deleted (ADR-0396):
// `assertCanManageMembers` is imported from `@caisson-sh/org-controls/browser`, the entry point that
// exists precisely so a client bundle can hold the gate without the package's `pg`-bound member
// writes or its `@clerk/backend` verifier. The audit hash is likewise the real
// `hashChainLinkAsync`. What stays local below is sample data and presentation composition only —
// nothing here fetches, persists, measures the visitor, or reads the clock in a rendered path.
import { useEffect, useId, useMemo, useState } from "react";
import { Radio, StatusChip } from "@caisson-sh/ui/components";
import { AuthzError } from "@caisson-sh/kernel";
import { hashChainLinkAsync } from "@caisson-sh/kernel/audit-verify";
import { assertCanManageMembers } from "@caisson-sh/org-controls/browser";
import type { Role } from "@caisson-sh/auth";

import { PokeShell, Verdict } from "./poke-rig";
import styles from "./org-controls-poke.module.css";

const ROLES: readonly Role[] = ["owner", "seat"];

export type RoleGateVerdict =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly error: AuthzError };

/**
 * Presentation adapter: run the REAL gate and turn its throw into something renderable. Every
 * `addAccountMember` / `removeAccountMember` call runs this same function first, unconditionally —
 * the code/httpStatus/message shown are the thrown `AuthzError`'s own, not a transcription. A
 * non-authz throw is re-raised rather than rendered as a denial.
 */
export function runGate(actorRole: Role): RoleGateVerdict {
  try {
    assertCanManageMembers(actorRole);
    return { allowed: true };
  } catch (err) {
    if (!(err instanceof AuthzError)) throw err;
    return { allowed: false, error: err };
  }
}

/** The shape `account_member` (packages/auth/src/schema.ts `ACCOUNT_MEMBER_SCHEMA_SQL`) carries. */
export interface AccountMemberRow {
  readonly account_id: string;
  readonly user_id: string;
  readonly role: Role;
  readonly created_at: string;
}

/** Sample account this demo adds a seat to. Labeled as a sample in the UI, never a real account. */
export const SAMPLE_ACCOUNT_ID = "acct_sample";
/** Sample user id an owner is adding as a seat. */
export const SAMPLE_NEW_USER_ID = "user_sample_new";
/**
 * A FIXED stand-in for the real INSERT's `created_at timestamptz NOT NULL DEFAULT now()` — this demo
 * never calls the clock, so the row shown is reproducible on every render.
 */
export const SAMPLE_CREATED_AT = "2026-01-01T00:00:00.000Z";
/** Matches `addAccountMember`'s own default for its `role` parameter. */
const DEFAULT_ADDED_ROLE: Role = "seat";

/**
 * Sample data, not package logic: the row `addAccountMember`'s `INSERT INTO account_member
 * (account_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING` would write over the
 * sample inputs above. The real function needs a `Transactor` — a database session a static site
 * does not have — so the poke shows its input row rather than pretending to run the write.
 */
export function buildMemberRow(): AccountMemberRow {
  return {
    account_id: SAMPLE_ACCOUNT_ID,
    user_id: SAMPLE_NEW_USER_ID,
    role: DEFAULT_ADDED_ROLE,
    created_at: SAMPLE_CREATED_AT,
  };
}

/** One link of a kernel audit chain (kernel/canonical.ts `AuditChainEntry`'s public shape). */
export interface AuditChainRow {
  readonly seq: number;
  readonly prevHash: string | null;
  readonly payload: AccountMemberRow;
  readonly hash: string;
}

/**
 * This demo's own first (genesis) chain entry over `row` — real `hashChainLinkAsync` (WebCrypto
 * SHA-256). `seq`/`prevHash` follow kernel `chainEntry`'s genesis case (`prev === null` → `seq: 0`,
 * `prevHash: null`); that arithmetic is the only part not imported (`chainEntry` itself lives in
 * the node-tainted `audit-chain.ts`, unreachable here).
 */
export async function buildAuditEntry(
  row: AccountMemberRow,
): Promise<AuditChainRow> {
  const prevHash: string | null = null;
  const hash = await hashChainLinkAsync(prevHash, { ...row });
  return { seq: 0, prevHash, payload: row, hash };
}

export default function OrgControlsPoke() {
  const uid = useId();
  const [role, setRole] = useState<Role>("owner");
  const verdict = useMemo(() => runGate(role), [role]);
  const memberRow = useMemo(() => buildMemberRow(), []);
  const [auditRow, setAuditRow] = useState<AuditChainRow | null>(null);

  // buildAuditEntry is the one async leg (WebCrypto digest) — everything else here is synchronous.
  useEffect(() => {
    if (!verdict.allowed) {
      setAuditRow(null);
      return;
    }
    let live = true;
    void buildAuditEntry(memberRow).then((row) => {
      if (live) setAuditRow(row);
    });
    return () => {
      live = false;
    };
  }, [verdict.allowed, memberRow]);

  return (
    <PokeShell
      label="@caisson-sh/org-controls"
      title="Switch the role. Only an owner is allowed to add a seat."
    >
      <div className={styles.layout}>
        <fieldset className={styles.optionGroup}>
          <legend className={styles.legend}>
            Actor role (Role, assertCanManageMembers)
          </legend>
          <div className={styles.optionRow}>
            {ROLES.map((r) => (
              <Radio
                key={r}
                name={`${uid}-role`}
                label={r}
                checked={role === r}
                onChange={() => setRole(r)}
                className={styles.option}
              />
            ))}
          </div>
        </fieldset>

        <p className={styles.note}>
          addAccountMember(db, actorRole, accountId, userId) on account{" "}
          <span className={styles.mono}>{SAMPLE_ACCOUNT_ID}</span>, adding{" "}
          <span className={styles.mono}>{SAMPLE_NEW_USER_ID}</span> (sample
          account and user, not real data).
        </p>

        {verdict.allowed ? (
          <>
            <Verdict state="ok">
              assertCanManageMembers passed. The write lands two rows.
            </Verdict>

            <div className={styles.outputPanel}>
              <p className={styles.panelTitle}>
                Row 1, account_member (the mutation)
              </p>
              <dl className={styles.register}>
                <dt>account_id</dt>
                <dd>{memberRow.account_id}</dd>
                <dt>user_id</dt>
                <dd>{memberRow.user_id}</dd>
                <dt>role</dt>
                <dd>{memberRow.role}</dd>
                <dt>created_at</dt>
                <dd>{memberRow.created_at} (sample, not the real clock)</dd>
              </dl>
            </div>

            <div className={styles.outputPanel}>
              <p className={styles.panelTitle}>
                Row 2, audit-chain link (kernel/audit-verify, ADR-0006)
              </p>
              {auditRow ? (
                <dl className={styles.register}>
                  <dt>seq</dt>
                  <dd>{auditRow.seq}</dd>
                  <dt>prevHash</dt>
                  <dd>null (this demo&apos;s genesis entry)</dd>
                  <dt>hash</dt>
                  <dd className={styles.hash}>{auditRow.hash}</dd>
                </dl>
              ) : (
                <p className={styles.note}>Hashing…</p>
              )}
              <p className={styles.note}>
                org-controls does not wire a live audit table for account_member
                yet. This row runs the real hashChainLinkAsync, the same
                primitive @caisson-sh/audit-worm uses client-side, over Row 1,
                showing the tamper-evident link a real audit-trail entry would
                carry.
              </p>
            </div>
          </>
        ) : (
          <>
            <Verdict state="fail">
              assertCanManageMembers threw. A seat cannot manage members or
              billing.
            </Verdict>
            <dl className={styles.register}>
              <dt>code</dt>
              <dd>{verdict.error.code}</dd>
              <dt>httpStatus</dt>
              <dd>{verdict.error.httpStatus}</dd>
              <dt>message</dt>
              <dd>{verdict.error.message}</dd>
            </dl>
          </>
        )}

        <div className={styles.chipsRow}>
          {ROLES.map((r) => (
            <StatusChip
              key={r}
              label={r}
              tone={role === r ? "accent" : "muted"}
            />
          ))}
        </div>
      </div>
    </PokeShell>
  );
}
