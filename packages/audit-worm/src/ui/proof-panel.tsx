"use client";

// ProofPanel (T-U1) — the per-row proof detail an auditor expands: the three assertions (link
// recompute · per-length anchor equality · chain-vs-current-anchor) each pass/fail, the anchor
// metadata, a copyable JSON receipt, and — for a redacted row — the masked payload via ui-pro's
// PayloadViewer (this introduces the audit-worm/ui -> ui-pro dependency; both commercial).
//
// Fork f: the panel FETCHES the row's proof on open (the caller injects `fetchProof`, which calls the
// admin proof endpoint) — one WORM GET per inspected row, zero cost for passive viewing. The chip and
// every leg are the CLIENT's own recompute (M3, via useRowVerify), never the server's `checks`. A
// server `unverifiable` verdict (missing anchor) renders as an explicitly SERVER-asserted chip, and a
// redacted row's link-recompute leg reads "not applicable — payload redacted", never a pass (CR-06).
import { useEffect, useState, type CSSProperties } from "react";
import type { ChainVerification } from "@caisson-sh/kernel";
import type {
  PinnedAnchorKey,
  RowReceipt,
} from "@caisson-sh/kernel/audit-verify";
import { PayloadViewer } from "@caisson-sh/ui-pro";
import { RowStateChip, type ChipState } from "./row-state-chip.tsx";
import { useRowVerify } from "./use-row-verify.ts";

/** The proof-bundle the injected `fetchProof` returns — the admin endpoint's response contract. */
export interface ProofBundleSuccess {
  readonly receipt: RowReceipt;
  readonly redacted: boolean;
  readonly redactedPaths?: readonly string[];
  readonly chainLength: number;
}
export interface ProofBundleUnverifiable {
  readonly state: "unverifiable";
  readonly reason: string;
}
export type ProofBundleResponse = ProofBundleSuccess | ProofBundleUnverifiable;

export interface ProofPanelProps {
  /** The row's 0-based sequence — fetched (and re-fetched) whenever it changes. */
  seq: number;
  /** Fetch the row's proof bundle (calls the proof endpoint). Injected so the panel stays portable. */
  fetchProof: (seq: number) => Promise<ProofBundleResponse>;
  /** Optional chain-level verdict for the third assertion (chain vs current anchor). */
  chainStatus?: ChainVerification;
  /**
   * The pinned anchor-signing public key, injected OUT-OF-BAND from app config —
   * NEVER from the proof response. Only when it is supplied (and matches the anchor's `keyId`) does the
   * client run the signature leg and earn the "(signature-checked)" seal; absent → the honest base seal.
   */
  pinnedAnchorKey?: PinnedAnchorKey;
  /** Tenant-scoped WORM account independently known by the caller and bound into signature v2. */
  expectedAnchorAccountId?: string;
}

type Phase =
  | { readonly kind: "loading" }
  | { readonly kind: "error" }
  | { readonly kind: "server-unverifiable"; readonly reason: string }
  | { readonly kind: "loaded"; readonly bundle: ProofBundleSuccess };

const PANEL: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--cs-space-3)",
  padding: "var(--cs-space-4)",
  border: "1px solid var(--cs-border)",
  borderRadius: "var(--cs-radius-md)",
  background: "var(--cs-surface-1)",
};
const ROW: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "var(--cs-space-4)",
  fontSize: "var(--cs-text-sm)",
};
const MONO: CSSProperties = {
  fontFamily: "var(--cs-font-mono)",
  fontSize: "var(--cs-text-xs)",
  wordBreak: "break-all",
};
const MUTED: CSSProperties = { color: "var(--cs-fg-muted)" };

/**
 * The seal caption — the SPEC's exact copy-law strings for signed anchors, so the
 * proof panel states in words what the chip encodes. Only `verified` and the redacted state get a seal
 * sentence; every other state's chip label already says what it is without a further claim to qualify.
 *
 * The strong "(signature-checked)" wording is emitted ONLY when `signatureChecked` — i.e. the client's
 * own signature leg actually verified the anchor against a pinned, out-of-band key. When no signature
 * was checked (unsigned anchor, or no pinned key wired), the honest BASE seal is used: the panel never
 * claims a cryptographic signature check it did not perform (SPEC anti-overclaim copy law; the same
 * gate the evidence-pack README applies). Never "impossible to tamper".
 */
function sealCaption(
  state: ChipState,
  signatureChecked: boolean,
): string | null {
  if (state === "verified") {
    return signatureChecked
      ? "Verified against write-once anchor (signature-checked)."
      : "Verified against write-once anchor.";
  }
  if (state === "anchor-confirmed-original-not-disclosed") {
    return "Anchor confirmed — original not disclosed.";
  }
  return null;
}

/** One assertion row — a labelled pass/fail/na verdict. */
function Assertion({
  label,
  verdict,
}: {
  label: string;
  verdict: "pass" | "fail" | "na" | string;
}) {
  const text =
    verdict === "pass"
      ? "Pass"
      : verdict === "fail"
        ? "Fail"
        : verdict === "na"
          ? "Not applicable — payload redacted"
          : verdict;
  return (
    <div style={ROW} data-assertion={label} data-verdict={verdict}>
      <span>{label}</span>
      <span style={verdict === "fail" ? undefined : MUTED}>{text}</span>
    </div>
  );
}

/**
 * ProofPanel — expandable per-row proof detail. Presentational except for the single fetch-on-open
 * (fork f) + the client recompute (M3). No store, no direct DB/WORM access — the endpoint call is the
 * injected `fetchProof`.
 */
export function ProofPanel({
  seq,
  fetchProof,
  chainStatus,
  pinnedAnchorKey,
  expectedAnchorAccountId,
}: ProofPanelProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    setPhase({ kind: "loading" });
    fetchProof(seq)
      .then((res) => {
        if (!live) return;
        if ("state" in res) {
          setPhase({ kind: "server-unverifiable", reason: res.reason });
        } else {
          setPhase({ kind: "loaded", bundle: res });
        }
      })
      .catch(() => {
        if (live) setPhase({ kind: "error" });
      });
    return () => {
      live = false;
    };
  }, [seq, fetchProof]);

  const receipt = phase.kind === "loaded" ? phase.bundle.receipt : null;
  const verify = useRowVerify(
    receipt,
    pinnedAnchorKey,
    expectedAnchorAccountId,
  );

  if (phase.kind === "loading") {
    return (
      <div style={PANEL} data-phase="loading">
        <span style={MUTED}>Verifying row #{seq}…</span>
      </div>
    );
  }
  if (phase.kind === "error") {
    return (
      <div style={PANEL} data-phase="error">
        <span style={MUTED}>Could not load the proof for row #{seq}.</span>
      </div>
    );
  }
  if (phase.kind === "server-unverifiable") {
    // The server could not produce a per-length anchor for this row — a SERVER verdict the client
    // cannot independently recompute, shown as such (never dressed up as a local verification).
    return (
      <div style={PANEL} data-phase="server-unverifiable">
        <RowStateChip state="server-asserted" />
        <span style={MUTED}>Unverifiable (server verdict): {phase.reason}</span>
      </div>
    );
  }

  const { receipt: r, redactedPaths } = phase.bundle;
  const chainVerdict: string =
    chainStatus === undefined
      ? "—"
      : chainStatus.valid
        ? "pass"
        : `Broken at #${chainStatus.brokenAt ?? "?"}`;

  const copy = (): void => {
    void navigator.clipboard
      ?.writeText(JSON.stringify(r, null, 2))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        /* clipboard unavailable — the receipt stays selectable in the DOM */
      });
  };

  // nosemgrep: tools.security.semgrep-rules.no-insecure-token-compare -- verify.legs.signature is a pass/fail/na verdict, not a secret; the real Ed25519 check is crypto.subtle.verify in the kernel's verifyAnchorSignature. No timing side channel on a public verdict enum.
  const seal = sealCaption(verify.state, verify.legs?.signature === "pass");

  return (
    <div style={PANEL} data-phase="loaded" data-state={verify.state}>
      <RowStateChip state={verify.state} />
      {seal !== null ? <span data-testid="seal-caption">{seal}</span> : null}

      <Assertion
        label="Link recompute"
        verdict={verify.legs?.linkRecompute ?? "pending"}
      />
      <Assertion
        label="Per-length anchor equality"
        verdict={verify.legs?.anchorEquality ?? "pending"}
      />
      <Assertion label="Chain vs current anchor" verdict={chainVerdict} />

      <div style={ROW}>
        <span>Anchor length</span>
        <span style={MONO}>{r.anchor.length}</span>
      </div>
      <div style={ROW}>
        <span>Anchor tip hash</span>
        <span style={MONO} title={r.anchor.tipHash}>
          {r.anchor.tipHash}
        </span>
      </div>
      {r.redacted ? (
        <span style={MUTED}>
          {redactedPaths && redactedPaths.length > 0
            ? `${redactedPaths.length} field${redactedPaths.length === 1 ? "" : "s"} redacted — hash is over the original content, recomputable only with the unredacted payload.`
            : "Redacted — hash is over the original content."}
        </span>
      ) : null}

      <PayloadViewer value={r.raw.payload} ariaLabel="Row payload" />

      <button type="button" onClick={copy} style={{ alignSelf: "flex-start" }}>
        {copied ? "Copied" : "Copy proof receipt (JSON)"}
      </button>
    </div>
  );
}
