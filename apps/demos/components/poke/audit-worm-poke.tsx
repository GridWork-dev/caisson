"use client";

// Flagship F2 "Break the chain" (ADR-0378 lock 2). A real SHA-256 audit chain, computed live in the
// browser. Append entries, tamper a historical row and watch every link after it break, or cut the
// tail and watch the trusted anchor catch it. Nothing leaves the page.
//
// This component drives the REAL packages: the hand-ported mirror (audit-worm-logic.ts) is deleted
// (ADR-0396). The chain algebra is `@caisson-sh/kernel/audit-verify` — the browser-safe entry whose
// WebCrypto twins (`chainEntryAsync`/`buildChainAsync`/`verifyChainAsync`) are pinned byte-for-byte
// against the node originals in the kernel's own cross-impl test — and `anchorChain` there is
// literally the same function the node builder calls. The WORM retention floor is the package's own
// `retain.ts`, imported by RELATIVE path: an internal module of a sold package, deliberately not a
// new public entry point (the access-review shape, ADR-0396). `RetentionMode` is a TYPE, so the
// statement-level `import type` is erased at emit and audit-worm's node-tainted barrel never enters
// the bundle graph.
//
// Browser-safety is proven by the static source-graph walk in audit-worm-poke.test.ts, NOT by a
// build: a bundler does not fail on a node builtin, it substitutes a polyfill and exits 0.
//
// What stays local here is sample data and presentation composition only — the seed events, the
// display formatting, and the row/verdict labels the UI renders.
import { useCallback, useEffect, useState } from "react";
import {
  anchorChain,
  buildChainAsync,
  chainEntryAsync,
  verifyChainAsync,
} from "@caisson-sh/kernel/audit-verify";
import type {
  AuditChainAnchor,
  AuditChainEntry,
  ChainVerification,
  JsonValue,
} from "@caisson-sh/kernel";
import type { RetentionMode } from "@caisson-sh/audit-worm";

import {
  DEFAULT_RETENTION_YEARS,
  MIN_RETENTION_YEARS,
  retainUntilFrom,
} from "../../../../packages/audit-worm/src/retain.ts";

import { PokeShell, Verdict } from "./poke-rig";
import styles from "./audit-worm-poke.module.css";

// --- Sample data (poke-local: baked fixtures, never a real audit trail) --------------------------

/** The seed chain: the same license-lifecycle events the Living Chain slide renders. */
export const SEED_PAYLOADS: readonly JsonValue[] = [
  { event: "license.issued", licenseId: "lic_8a2f", actor: "system" },
  { event: "entitlement.granted", module: "audit-worm", actor: "admin" },
  {
    event: "registry.pull",
    package: "@caisson-sh/audit-worm",
    actor: "acme-co",
  },
  { event: "evidence.exported", pack: "soc2-2026q3", actor: "auditor" },
];

/** Deterministic events for "Append entry" — indexed by chain length, no randomness. */
export const APPEND_EVENTS: readonly JsonValue[] = [
  { event: "artifact.locked", artifactId: "policy", version: 1 },
  { event: "artifact.superseded", artifactId: "policy", supersedes: 1 },
  { event: "evidence.exported", pack: "soc2-2026q4", actor: "auditor" },
];

/** Cap the visible chain so the strip stays readable. */
export const MAX_ENTRIES = 8;

/** Fixed seal instant → a deterministic retain-until (no `Date.now` in any rendered path). */
export const SEALED_AT = new Date("2026-07-22T00:00:00.000Z");

// --- The poke's state model (composition over the real primitives) ------------------------------

export interface ChainState {
  readonly entries: readonly AuditChainEntry[];
  /** The trusted commitment held OUTSIDE the chain — the length + tip oracle. */
  readonly anchor: AuditChainAnchor;
}

/** The sealed starting chain + its freshly minted anchor. */
export async function initialState(): Promise<ChainState> {
  const entries = await buildChainAsync(SEED_PAYLOADS);
  return { entries, anchor: anchorChain(entries) };
}

/** Append the next deterministic event and RE-MINT the anchor (the store's own append shape). */
export async function appendEntry(state: ChainState): Promise<ChainState> {
  if (state.entries.length >= MAX_ENTRIES) return state;
  const payload = APPEND_EVENTS[
    state.entries.length % APPEND_EVENTS.length
  ] as JsonValue;
  const prev = state.entries[state.entries.length - 1] ?? null;
  const entries = [...state.entries, await chainEntryAsync(prev, payload)];
  return { entries, anchor: anchorChain(entries) };
}

/** The classic edit: rewrite one payload field, keep the STORED hash. Anchor unchanged (out-of-band). */
function forge(payload: JsonValue): JsonValue {
  if (
    payload !== null &&
    typeof payload === "object" &&
    !Array.isArray(payload)
  ) {
    return { ...payload, actor: "mallory" };
  }
  return payload;
}

/** Tamper a historical row: mutate its payload without recomputing its hash → the link breaks there. */
export function tamperRow(state: ChainState, index: number): ChainState {
  if (index < 0 || index >= state.entries.length) return state;
  const entries = state.entries.map((entry, i) =>
    i === index ? { ...entry, payload: forge(entry.payload) } : entry,
  );
  return { ...state, entries };
}

/** Cut the tail: drop the last entry. The prefix stays consistent; the anchor's length catches it. */
export function cutTail(state: ChainState): ChainState {
  if (state.entries.length <= 1) return state;
  return { ...state, entries: state.entries.slice(0, -1) };
}

// --- Presentation (poke-local: labels, formatting, the rendered verdict) -------------------------

/** Per-row label — echoes the real RowStateChip register (packages/audit-worm/src/ui/row-state-chip.tsx). */
export type RowLabel = "Chain root" | "Verified" | "Tampered";

export interface ChainVerdict {
  /** Internal-consistency pass (no anchor): catches tamper/insert/reorder/middle-drop. */
  readonly internal: ChainVerification;
  /** Anchored pass: additionally catches tail-truncation + wholesale rewrite. */
  readonly anchored: ChainVerification;
  readonly rows: readonly RowLabel[];
  readonly lengthMatches: boolean;
  readonly tipMatches: boolean;
}

export async function evaluate(state: ChainState): Promise<ChainVerdict> {
  const internal = await verifyChainAsync(state.entries);
  const anchored = await verifyChainAsync(state.entries, state.anchor);
  const broken = internal.brokenAt;
  const rows = state.entries.map((_, i): RowLabel => {
    if (broken !== null && i >= broken) return "Tampered";
    return i === 0 ? "Chain root" : "Verified";
  });
  const tip = state.entries[state.entries.length - 1]?.hash ?? null;
  return {
    internal,
    anchored,
    rows,
    lengthMatches: state.entries.length === state.anchor.length,
    tipMatches: tip === state.anchor.tipHash,
  };
}

/** The headline verdict: computed from the passes, never asserted copy. No em dashes (ADR-0375). */
export function verdictLine(
  v: ChainVerdict,
  state: ChainState,
): { state: "ok" | "fail"; text: string } {
  if (!v.internal.valid) {
    return {
      state: "fail",
      text: `Tampered at entry ${v.internal.brokenAt ?? 0}. Every link after it breaks.`,
    };
  }
  if (!v.anchored.valid) {
    if (state.entries.length !== state.anchor.length) {
      return {
        state: "fail",
        text: `Anchor committed ${state.anchor.length} entries. ${state.entries.length} present.`,
      };
    }
    return {
      state: "fail",
      text: "Anchor tip does not match. The chain was rewritten.",
    };
  }
  return { state: "ok", text: "Chain verified. Anchor holds." };
}

/** Short display form of a 64-hex hash. */
export function shortHash(hash: string): string {
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

/** The payload's `event` name for display (payload is nullable JSON). */
export function eventName(payload: JsonValue): string {
  if (
    payload !== null &&
    typeof payload === "object" &&
    !Array.isArray(payload)
  ) {
    const event = (payload as { readonly [key: string]: JsonValue }).event;
    if (typeof event === "string") return event;
  }
  return "entry";
}

/** ISO date (YYYY-MM-DD) for the retain-until display. */
export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The retain-until date shown in the anchor panel, from the package's own `retainUntilFrom` at the
 * fixed seal instant. `retain.ts` takes a term in YEARS, never a mode: GOVERNANCE and COMPLIANCE
 * share the same term, and the mode changes ENFORCEMENT (bypassable vs root-proof), not the date.
 * So the date deliberately ignores mode; the mode's effect is the enforcement line below it.
 */
const RETAIN_UNTIL = formatDate(
  retainUntilFrom(SEALED_AT, DEFAULT_RETENTION_YEARS),
);

/** Both numbers come from retain.ts — the label can never drift from the shipped floor. */
const RETAIN_TERM_LABEL = `${DEFAULT_RETENTION_YEARS}yr term, ${MIN_RETENTION_YEARS}yr floor`;

const MODE_NOTE: Record<RetentionMode, string> = {
  GOVERNANCE: "Bypassable by a caller holding s3:BypassGovernanceRetention.",
  COMPLIANCE: "Root-proof. This data cannot be deleted before the date.",
};

const ROW_TONE: Record<string, string> = {
  "Chain root": "root",
  Verified: "ok",
  Tampered: "fail",
};

export default function AuditWormPoke() {
  const [state, setState] = useState<ChainState | null>(null);
  const [verdict, setVerdict] = useState<ChainVerdict | null>(null);
  const [mode, setMode] = useState<RetentionMode>("GOVERNANCE");

  const commit = useCallback(async (next: ChainState) => {
    setState(next);
    setVerdict(await evaluate(next));
  }, []);

  useEffect(() => {
    void initialState().then(commit);
  }, [commit]);

  const onReset = useCallback(() => {
    void initialState().then(commit);
  }, [commit]);

  if (state === null || verdict === null) {
    return (
      <PokeShell
        label="@caisson-sh/audit-worm"
        title="Append. Anchor. Then edit history and watch the verdict flip."
      >
        <p className={styles.loading}>Sealing the chain…</p>
      </PokeShell>
    );
  }

  const line = verdictLine(verdict, state);
  const atMax = state.entries.length >= MAX_ENTRIES;

  return (
    <PokeShell
      label="@caisson-sh/audit-worm"
      title="Append. Anchor. Then edit history and watch the verdict flip."
    >
      <ol className={styles.chain}>
        {state.entries.map((entry, i) => {
          const label = verdict.rows[i] ?? "Verified";
          return (
            <li
              key={entry.seq}
              className={styles.row}
              data-tone={ROW_TONE[label]}
            >
              <span className={styles.seq}>#{entry.seq}</span>
              <span className={styles.event}>{eventName(entry.payload)}</span>
              <code className={styles.hash}>{shortHash(entry.hash)}</code>
              <span className={styles.rowState} data-tone={ROW_TONE[label]}>
                {label}
              </span>
              <button
                type="button"
                className={styles.tamper}
                onClick={() => void commit(tamperRow(state, i))}
              >
                Tamper
              </button>
            </li>
          );
        })}
      </ol>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.action}
          onClick={() => void appendEntry(state).then(commit)}
          disabled={atMax}
        >
          Append entry
        </button>
        <button
          type="button"
          className={styles.action}
          onClick={() => void commit(cutTail(state))}
          disabled={state.entries.length <= 1}
        >
          Cut the tail
        </button>
        <button type="button" className={styles.action} onClick={onReset}>
          Re-seal
        </button>
      </div>

      <div className={styles.anchor}>
        <div className={styles.anchorHead}>
          <span className={styles.anchorTitle}>Anchor</span>
          <span
            className={styles.anchorState}
            data-tone={
              verdict.lengthMatches && verdict.tipMatches ? "ok" : "fail"
            }
          >
            {verdict.lengthMatches && verdict.tipMatches ? "Holds" : "Failed"}
          </span>
        </div>
        <dl className={styles.anchorGrid}>
          <dt>length</dt>
          <dd data-tone={verdict.lengthMatches ? "ok" : "fail"}>
            {state.anchor.length}
            {verdict.lengthMatches ? "" : ` (${state.entries.length} present)`}
          </dd>
          <dt>tipHash</dt>
          <dd>
            <code>{shortHash(state.anchor.tipHash)}</code>
          </dd>
          <dt>genesisHash</dt>
          <dd>
            <code>
              {state.anchor.genesisHash
                ? shortHash(state.anchor.genesisHash)
                : "none"}
            </code>
          </dd>
        </dl>

        <div className={styles.retain}>
          <div
            className={styles.modeToggle}
            role="group"
            aria-label="Retention mode"
          >
            {(["GOVERNANCE", "COMPLIANCE"] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={styles.modeButton}
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
              >
                {m}
              </button>
            ))}
          </div>
          <p className={styles.retainLine}>
            Retain until <strong>{RETAIN_UNTIL}</strong> ({RETAIN_TERM_LABEL})
          </p>
          <p className={styles.modeNote}>{MODE_NOTE[mode]}</p>
        </div>
      </div>

      <Verdict state={line.state}>{line.text}</Verdict>
    </PokeShell>
  );
}
