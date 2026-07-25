"use client";

// The org-controls module's poke (ADR-0378 lock 2, kimi CANDIDATES §B "org-controls") — a live,
// deterministic run of the package's owner-only membership gate. Every function driving this
// component is the pure mirror in `org-controls-logic.ts` (see that file's header for why the real
// package isn't imported directly into a client bundle, and for the one function that IS a real
// import). Nothing here fetches, persists, or measures the visitor.
import { useEffect, useId, useMemo, useState } from "react";
import { Radio, StatusChip } from "@caisson/ui/components";

import { PokeShell, Verdict } from "./poke-rig";
import {
  SAMPLE_ACCOUNT_ID,
  SAMPLE_NEW_USER_ID,
  buildAuditEntry,
  buildMemberRow,
  checkManageMembers,
} from "./org-controls-logic";
import type { AuditChainRow, Role } from "./org-controls-logic";
import styles from "./org-controls-poke.module.css";

const ROLES: readonly Role[] = ["owner", "seat"];

export default function OrgControlsPoke() {
  const uid = useId();
  const [role, setRole] = useState<Role>("owner");
  const verdict = useMemo(() => checkManageMembers(role), [role]);
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
      label="@caisson/org-controls"
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
                primitive @caisson/audit-worm uses client-side, over Row 1,
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
