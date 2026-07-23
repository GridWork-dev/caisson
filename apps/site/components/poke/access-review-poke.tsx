"use client";

// The access-review module's poke (ADR-0378 lock 2) — a live run of the campaign closer against a
// fixed sample roster. Decide each reviewee, then try to close. Closing early with anyone still
// undecided is refused (the typed ConflictError closeCampaign itself throws); closing past the
// deadline reports the undecided as unresolved, never auto-approved. Every function driving this
// component is the pure mirror in `access-review-logic.ts` (see that file's header for why the
// real package isn't imported directly into a client bundle). Nothing here fetches, persists, or
// measures the visitor.
import { useCallback, useId, useMemo, useState } from "react";
import { Button, Checkbox, StatusChip } from "@caisson/ui/components";

import { PokeShell, Verdict } from "./poke-rig";
import {
  CAMPAIGN_CLOSED_RECORD,
  CAMPAIGN_DECISION_RECORD,
  REVIEW_DECISIONS,
  evaluateClose,
  scanCampaignDecisions,
} from "./access-review-logic";
import type {
  CampaignCloseVerdict,
  DecisionChainEntry,
  ReviewDecision,
} from "./access-review-logic";
import styles from "./access-review-poke.module.css";

// A sample campaign roster (campaign.ts's AccessReviewCampaign shape: one reviewer, a frozen
// reviewee list). Labeled as sample below; nothing here is a real access grant.
const SAMPLE_CAMPAIGN_ID = "8f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const SAMPLE_REVIEWER_ID = "reviewer-jordan";
const SAMPLE_REVIEWEES: readonly string[] = [
  "morgan.lee",
  "priya.nair",
  "sam.osei",
  "chidi.eze",
  "dana.ruiz",
];

const DECISION_LABEL: Record<ReviewDecision, string> = {
  approve: "Approve",
  revoke: "Revoke",
};

export default function AccessReviewPoke() {
  const uid = useId();
  const [log, setLog] = useState<readonly DecisionChainEntry[]>([]);
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
        {
          seq: prev.length,
          payload: {
            kind: CAMPAIGN_DECISION_RECORD,
            campaignId: SAMPLE_CAMPAIGN_ID,
            revieweeId,
            decision,
          },
        },
      ]);
      setVerdict(null);
    },
    [closed],
  );

  const onClose = useCallback(() => {
    setVerdict(evaluateClose(scan, SAMPLE_CAMPAIGN_ID, isDue));
  }, [scan, isDue]);

  const onReset = useCallback(() => {
    setLog([]);
    setIsDue(false);
    setVerdict(null);
  }, []);

  return (
    <PokeShell
      label="@caisson/access-review"
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
              <dd>{verdict.error.details.campaignId}</dd>
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
