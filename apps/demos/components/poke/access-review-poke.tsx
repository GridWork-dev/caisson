"use client";

// The access-review module's poke (ADR-0378 lock 2) — a live run of the campaign closer against a
// fixed sample roster. Decide each reviewee, then try to close. Closing early with anyone still
// undecided is refused (the SAME typed ConflictError closeCampaign itself throws — closeCampaign
// delegates to evaluateCampaignClose, so there is one guard, not a mirror of one); closing past
// the deadline reports the undecided as unresolved, never auto-approved.
//
// This component drives the REAL @caisson-sh/access-review: the hand-ported mirror
// (access-review-logic.ts) is deleted. The pure half of the campaign kernel lives in the
// package's src/decisions.ts — no node builtin, no @caisson-sh/tenancy-rls, no db; its only
// non-relative edge is the browser-safe @caisson-sh/kernel barrel — and is imported here by
// RELATIVE path (an internal module, deliberately not a public entry point of the sold package).
// Browser-safety is proven by the static source-graph walk in risk-register-poke.test.ts /
// access-review-poke.test.ts — NOT by a build; a bundler substitutes node builtins instead of
// failing on them. Nothing here fetches, persists, or measures the visitor.
import { useCallback, useId, useMemo, useState } from "react";
import { Button, Checkbox, StatusChip } from "@caisson-sh/ui/components";
import type { AuditChainEntry } from "@caisson-sh/kernel";

import {
  CAMPAIGN_CLOSED_RECORD,
  CAMPAIGN_DECISION_RECORD,
  REVIEW_DECISIONS,
  evaluateCampaignClose,
  scanCampaignDecisions,
} from "../../../../packages/access-review/src/decisions.ts";
import type {
  CampaignCloseVerdict,
  ReviewDecision,
} from "../../../../packages/access-review/src/decisions.ts";

import { PokeShell, Verdict } from "./poke-rig";
import styles from "./access-review-poke.module.css";

// A sample campaign roster (campaign.ts's AccessReviewCampaign shape: one reviewer, a frozen
// reviewee list). Labeled as sample below; nothing here is a real access grant. Exported so the
// poke test drives the same fixtures the UI does.
export const SAMPLE_CAMPAIGN_ID = "8f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const SAMPLE_REVIEWER_ID = "reviewer-jordan";
export const SAMPLE_REVIEWEES: readonly string[] = [
  "morgan.lee",
  "priya.nair",
  "sam.osei",
  "chidi.eze",
  "dana.ruiz",
];

/** A sample decision entry for the poke's in-memory log. The prevHash/hash strings are INERT
 *  sample values — never rendered, never read by scanCampaignDecisions (it reads only seq +
 *  payload); real chain hashing is @caisson-sh/audit-worm's job and is not what this poke
 *  demonstrates. They exist only to satisfy the real AuditChainEntry shape. */
export function decisionEntry(
  seq: number,
  revieweeId: string,
  decision: ReviewDecision,
): AuditChainEntry {
  return {
    seq,
    prevHash: seq === 0 ? null : `sample-${seq - 1}`,
    hash: `sample-${seq}`,
    payload: {
      kind: CAMPAIGN_DECISION_RECORD,
      campaignId: SAMPLE_CAMPAIGN_ID,
      revieweeId,
      decision,
    },
  };
}

const DECISION_LABEL: Record<ReviewDecision, string> = {
  approve: "Approve",
  revoke: "Revoke",
};

export default function AccessReviewPoke() {
  const uid = useId();
  const [log, setLog] = useState<readonly AuditChainEntry[]>([]);
  const [isDue, setIsDue] = useState(false);
  const [verdict, setVerdict] = useState<CampaignCloseVerdict | null>(null);

  const scan = useMemo(
    () => scanCampaignDecisions(log, SAMPLE_CAMPAIGN_ID, SAMPLE_REVIEWEES),
    [log],
  );
  const closed = verdict?.outcome === "closed";

  const decide = useCallback(
    (revieweeId: string, decision: ReviewDecision) => {
      if (closed) return; // recordDecision refuses once closeCampaign has run (campaign.ts).
      setLog((prev) => [
        ...prev,
        decisionEntry(prev.length, revieweeId, decision),
      ]);
      setVerdict(null);
    },
    [closed],
  );

  const onClose = useCallback(() => {
    setVerdict(evaluateCampaignClose(scan, SAMPLE_CAMPAIGN_ID, isDue));
  }, [scan, isDue]);

  const onReset = useCallback(() => {
    setLog([]);
    setIsDue(false);
    setVerdict(null);
  }, []);

  return (
    <PokeShell
      label="@caisson-sh/access-review"
      title="Decide every reviewee, or try closing the campaign early."
    >
      <div className={styles.layout}>
        <p className={styles.field}>
          Sample campaign, reviewer {SAMPLE_REVIEWER_ID},{" "}
          {SAMPLE_REVIEWEES.length} reviewees.
        </p>

        <ul className={styles.roster}>
          {SAMPLE_REVIEWEES.map((revieweeId) => {
            const decision = scan.decisions.get(revieweeId);
            return (
              <li key={revieweeId} className={styles.row}>
                <span className={styles.name}>{revieweeId}</span>
                <StatusChip
                  label={decision ? DECISION_LABEL[decision] : "undecided"}
                  tone={
                    decision === "approve"
                      ? "success"
                      : decision === "revoke"
                        ? "accent"
                        : "muted"
                  }
                />
                <div
                  className={styles.decisionGroup}
                  role="group"
                  aria-label={`Decision for ${revieweeId}`}
                >
                  {REVIEW_DECISIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={styles.decisionButton}
                      data-decision={d}
                      aria-pressed={decision === d}
                      disabled={closed}
                      onClick={() => decide(revieweeId, d)}
                    >
                      {DECISION_LABEL[d]}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>

        <p className={styles.note}>
          {scan.unresolved.length === 0
            ? "Every reviewee has decided."
            : `${scan.unresolved.length} reviewee${scan.unresolved.length === 1 ? "" : "s"} still undecided: ${scan.unresolved.join(", ")}.`}
        </p>

        <div className={styles.controlsRow}>
          <Checkbox
            id={`${uid}-due`}
            label="Simulate the deadline reached (closeCampaign's isDue)"
            checked={isDue}
            onChange={(e) => {
              setIsDue(e.target.checked);
              setVerdict(null);
            }}
            disabled={closed}
          />
        </div>

        <div className={styles.controlsRow}>
          <Button onClick={onClose} disabled={closed}>
            Close campaign
          </Button>
          <Button variant="ghost" onClick={onReset}>
            Reset sample campaign
          </Button>
        </div>

        {verdict === null ? null : verdict.outcome === "refused" ? (
          <div className={styles.outputPanel}>
            <Verdict state="fail">
              Refused. Not every reviewee has decided and the deadline
              hasn&apos;t passed, so closeCampaign will not force a partial
              close.
            </Verdict>
            <dl className={styles.register}>
              <dt>code</dt>
              <dd>{verdict.error.code}</dd>
              <dt>httpStatus</dt>
              <dd>{verdict.error.httpStatus}</dd>
              <dt>details.campaignId</dt>
              <dd>{String(verdict.error.details?.["campaignId"] ?? "")}</dd>
            </dl>
            <p className={styles.note}>
              No {CAMPAIGN_CLOSED_RECORD} record is appended. The refusal
              happens before any chain write.
            </p>
          </div>
        ) : (
          <div className={styles.outputPanel}>
            <Verdict state="ok">
              {verdict.reason === "completed"
                ? "Closed. Every reviewee decided."
                : `Closed at the deadline. ${verdict.unresolved.length} reviewee${verdict.unresolved.length === 1 ? "" : "s"} left undecided, flagged unresolved, never approved.`}
            </Verdict>
            <dl className={styles.register}>
              <dt>kind</dt>
              <dd>{CAMPAIGN_CLOSED_RECORD}</dd>
              <dt>reason</dt>
              <dd>{verdict.reason}</dd>
              <dt>unresolved</dt>
              <dd>
                {verdict.unresolved.length === 0
                  ? "[]"
                  : verdict.unresolved.join(", ")}
              </dd>
            </dl>
          </div>
        )}
      </div>
    </PokeShell>
  );
}
