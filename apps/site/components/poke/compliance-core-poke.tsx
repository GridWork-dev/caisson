"use client";

// The compliance-core module's flagship "poke" (ADR-0378 lock 2, kimi CANDIDATES section B). Six
// cards, one per real @caisson/compliance-core evidence collector; each card's segmented control
// drives the collector's REAL branching logic (mirrored in ./compliance-core-logic.ts - see that
// file's header for what runs the real primitive vs what is mirrored, and why) over a fixed sample
// fact, so the rendered status is computed, never asserted. "Generate the evidence pack" runs the
// generator's real flag-never-guess phase: any collector still unresolved throws the real
// EvidencePackBlockedError shape (the break-it control); all six clear and the pack's honest,
// derived shape renders (readiness per control, summary counts, the posture sentence).
import { useEffect, useMemo, useState } from "react";

import { PokeShell, Verdict, type VerdictState } from "./poke-rig";
import {
  CHAIN_VERIFY_CARD,
  EVIDENCE_PACK_FORMAT_VERSION,
  EvidencePackBlockedErrorMirror,
  SAMPLE_FRAMEWORK,
  SAMPLE_TENANT_ID,
  SYNC_COLLECTOR_CARDS,
  chainVerifyCollectMirror,
  chainVerifyPreset,
  collectSync,
  generateEvidencePackMirror,
  type CollectorResultLike,
  type GeneratedPackLike,
  type PresetKind,
} from "./compliance-core-logic";
import styles from "./compliance-core-poke.module.css";

const PRESET_ORDER: readonly PresetKind[] = ["pass", "flagged", "unresolved"];
const PRESET_LABEL: Readonly<Record<PresetKind, string>> = {
  pass: "Pass",
  flagged: "Flagged",
  unresolved: "Unresolved",
};

interface BoardState {
  rlsForce: PresetKind;
  chainVerify: PresetKind;
  wormRetention: PresetKind;
  fieldCryptoPolicy: PresetKind;
  aiRiskRegister: PresetKind;
  impersonation: PresetKind;
}

// Nothing evidenced yet - every collector starts unresolved, matching a freshly onboarded tenant.
const INITIAL_BOARD: BoardState = {
  rlsForce: "unresolved",
  chainVerify: "unresolved",
  wormRetention: "unresolved",
  fieldCryptoPolicy: "unresolved",
  aiRiskRegister: "unresolved",
  impersonation: "unresolved",
};

interface GenerateOutcome {
  readonly state: VerdictState;
  readonly pack: GeneratedPackLike | null;
  readonly blocked: EvidencePackBlockedErrorMirror | null;
}

function statusDotClass(
  status: CollectorResultLike["status"] | "loading",
): string {
  if (status === "pass") return styles.dotPass ?? "";
  if (status === "flagged") return styles.dotFlagged ?? "";
  if (status === "unresolved") return styles.dotUnresolved ?? "";
  return styles.dotLoading ?? "";
}

export default function ComplianceCorePoke() {
  const [board, setBoard] = useState<BoardState>(INITIAL_BOARD);
  const [outcome, setOutcome] = useState<GenerateOutcome | null>(null);

  const rlsResult = useMemo(
    () => collectSync("rlsForce", board.rlsForce),
    [board.rlsForce],
  );
  const wormResult = useMemo(
    () => collectSync("wormRetention", board.wormRetention),
    [board.wormRetention],
  );
  const fieldResult = useMemo(
    () => collectSync("fieldCryptoPolicy", board.fieldCryptoPolicy),
    [board.fieldCryptoPolicy],
  );
  const riskResult = useMemo(
    () => collectSync("aiRiskRegister", board.aiRiskRegister),
    [board.aiRiskRegister],
  );
  const impersonationResult = useMemo(
    () => collectSync("impersonation", board.impersonation),
    [board.impersonation],
  );

  // The one async card: chain-verify recomputes the hash chain with the REAL WebCrypto primitive.
  const [chainResult, setChainResult] = useState<CollectorResultLike | null>(
    null,
  );
  useEffect(() => {
    let cancelled = false;
    void chainVerifyPreset(board.chainVerify)
      .then((fact) => chainVerifyCollectMirror(fact))
      .then((result) => {
        if (!cancelled) setChainResult(result);
      });
    return () => {
      cancelled = true;
    };
  }, [board.chainVerify]);

  const cards = [
    {
      meta: SYNC_COLLECTOR_CARDS.rlsForce,
      preset: board.rlsForce,
      result: rlsResult,
      set: (p: PresetKind) => setBoard((b) => ({ ...b, rlsForce: p })),
    },
    {
      meta: CHAIN_VERIFY_CARD,
      preset: board.chainVerify,
      result: chainResult,
      set: (p: PresetKind) => setBoard((b) => ({ ...b, chainVerify: p })),
    },
    {
      meta: SYNC_COLLECTOR_CARDS.wormRetention,
      preset: board.wormRetention,
      result: wormResult,
      set: (p: PresetKind) => setBoard((b) => ({ ...b, wormRetention: p })),
    },
    {
      meta: SYNC_COLLECTOR_CARDS.fieldCryptoPolicy,
      preset: board.fieldCryptoPolicy,
      result: fieldResult,
      set: (p: PresetKind) => setBoard((b) => ({ ...b, fieldCryptoPolicy: p })),
    },
    {
      meta: SYNC_COLLECTOR_CARDS.aiRiskRegister,
      preset: board.aiRiskRegister,
      result: riskResult,
      set: (p: PresetKind) => setBoard((b) => ({ ...b, aiRiskRegister: p })),
    },
    {
      meta: SYNC_COLLECTOR_CARDS.impersonation,
      preset: board.impersonation,
      result: impersonationResult,
      set: (p: PresetKind) => setBoard((b) => ({ ...b, impersonation: p })),
    },
  ];

  const handleGenerate = () => {
    if (chainResult === null) return;
    const results: CollectorResultLike[] = [
      rlsResult,
      chainResult,
      wormResult,
      fieldResult,
      riskResult,
      impersonationResult,
    ];
    try {
      const pack = generateEvidencePackMirror(
        results,
        SAMPLE_TENANT_ID,
        SAMPLE_FRAMEWORK,
      );
      setOutcome({ state: "ok", pack, blocked: null });
    } catch (err) {
      if (err instanceof EvidencePackBlockedErrorMirror) {
        setOutcome({ state: "fail", pack: null, blocked: err });
        return;
      }
      throw err;
    }
  };

  const verdict: { state: VerdictState; message: string } =
    outcome === null
      ? {
          state: "neutral",
          message: "Set every collector, then generate the pack.",
        }
      : outcome.state === "ok" && outcome.pack !== null
        ? {
            state: "ok",
            message: `Pack generated. ${outcome.pack.summary.posture}`,
          }
        : {
            state: "fail",
            message: `Blocked. ${outcome.blocked?.message ?? ""}`,
          };

  return (
    <PokeShell
      label={`@caisson/compliance-core · evidence pack v${EVIDENCE_PACK_FORMAT_VERSION}`}
      title="Clear every collector, then generate the evidence pack."
    >
      <div className={styles.grid}>
        {cards.map(({ meta, preset, result, set }) => (
          <div key={meta.key} className={styles.card}>
            <p className={styles.cardId}>{meta.id}</p>
            <p className={styles.cardTitle}>{meta.title}</p>
            <div
              className={styles.segmented}
              role="group"
              aria-label={`${meta.title} status`}
            >
              {PRESET_ORDER.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className={styles.segButton}
                  aria-pressed={preset === kind}
                  data-active={preset === kind}
                  onClick={() => set(kind)}
                >
                  {PRESET_LABEL[kind]}
                </button>
              ))}
            </div>
            <p
              className={styles.cardStatus}
              data-status={result?.status ?? "loading"}
            >
              <span
                className={`${styles.dot} ${statusDotClass(result?.status ?? "loading")}`}
                aria-hidden="true"
              />
              {result === null
                ? "computing…"
                : result.status === "pass"
                  ? result.item.summary
                  : (result.reason ?? result.item.summary)}
            </p>
          </div>
        ))}
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.generateButton}
          onClick={handleGenerate}
          disabled={chainResult === null}
        >
          Generate evidence pack
        </button>
      </div>

      {outcome?.blocked !== null && outcome?.blocked !== undefined ? (
        <div className={styles.report} data-kind="blocked">
          <p className={styles.reportHead}>
            {outcome.blocked.name} ({outcome.blocked.code} · HTTP{" "}
            {outcome.blocked.httpStatus})
          </p>
          <ul className={styles.unresolvedList}>
            {outcome.blocked.report.unresolved.map((u) => (
              <li key={`${u.controlId}:${u.collectorId}`}>
                <span className={styles.mono}>{u.controlId}</span> /{" "}
                <span className={styles.mono}>{u.collectorId}</span>: {u.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {outcome?.pack !== null && outcome?.pack !== undefined ? (
        <div className={styles.report} data-kind="pack">
          <p className={styles.reportHead}>
            formatVersion {outcome.pack.formatVersion} · tenant{" "}
            {outcome.pack.tenantId} · framework {outcome.pack.framework.id} v
            {outcome.pack.framework.version}
          </p>
          <table className={styles.controlsTable}>
            <tbody>
              {outcome.pack.controls.map((c) => (
                <tr key={c.controlId} data-readiness={c.readiness}>
                  <td className={styles.mono}>{c.controlId}</td>
                  <td>{c.readiness}</td>
                  <td>
                    {c.evidence.length} evidence item
                    {c.evidence.length === 1 ? "" : "s"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={styles.summaryLine}>
            {outcome.pack.summary.totalControls} controls ·{" "}
            {outcome.pack.summary.controlsReady} ready ·{" "}
            {outcome.pack.summary.controlsWithGaps} with gaps ·{" "}
            {outcome.pack.summary.totalEvidenceItems} evidence items
          </p>
        </div>
      ) : null}

      <Verdict state={verdict.state}>{verdict.message}</Verdict>
    </PokeShell>
  );
}
