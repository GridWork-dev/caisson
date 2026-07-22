// Deterministic in-browser mirror of the @caisson audit-chain primitive for the "Break the chain"
// poke (ADR-0378 lock 2, flagship F2). The real chain lives in @caisson/kernel (audit-chain.ts +
// canonical.ts), but the kernel barrel pulls node:crypto (and node:dns via ssrf) that cannot enter
// the browser bundle — the exact constraint audit-worm-demo.tsx documents. So the SHA-256 chain is
// mirrored here over WebCrypto (crypto.subtle), and audit-worm-logic.test.ts pins every mirrored
// output byte-identical to the real kernel + the packages/audit-worm/src/__golden__/anchor.json
// fixture. Nothing here fetches, persists, or measures — pure functions over baked sample data.
//
// Sources mirrored: packages/kernel/src/canonical.ts (canonicalize + value types),
// packages/kernel/src/audit-chain.ts (hashChainLink/chainEntry/buildChain/anchorChain/verifyChain),
// packages/audit-worm/src/retain.ts (retention floor), packages/audit-worm/src/store.s3.ts
// (RetentionMode).

/** A JSON-serializable value (mirror of canonical.ts `JsonValue`). */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/** One entry in the append-only chain (mirror of canonical.ts `AuditChainEntry`). */
export interface AuditChainEntry {
  readonly seq: number;
  readonly prevHash: string | null;
  readonly payload: JsonValue;
  readonly hash: string;
}

/** A verify verdict (mirror of canonical.ts `ChainVerification`). */
export interface ChainVerification {
  readonly valid: boolean;
  readonly brokenAt: number | null;
}

/** The trusted out-of-chain commitment (mirror of canonical.ts `AuditChainAnchor`, core fields). */
export interface AuditChainAnchor {
  readonly length: number;
  readonly tipHash: string;
  readonly genesisHash?: string;
}

// --- Canonicalization (exact mirror of packages/kernel/src/canonical.ts) ---

/** Recursively sort object keys; preserve array order; reject non-finite numbers (not JSON). */
function sortValue(value: JsonValue): JsonValue {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error(
        `audit-chain: non-finite number is not canonicalizable: ${String(value)}`,
      );
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(sortValue);
  const obj = value as { readonly [key: string]: JsonValue };
  const out: { [key: string]: JsonValue } = {};
  for (const key of Object.keys(obj).sort()) {
    out[key] = sortValue(obj[key] as JsonValue);
  }
  return out;
}

/** Deterministic serialization: object keys sorted recursively, array order kept. */
export function canonicalize(value: JsonValue): string {
  return JSON.stringify(sortValue(value));
}

// --- SHA-256 chain over WebCrypto (mirror of packages/kernel/src/audit-chain.ts) ---

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/** SHA-256 over `canonicalize([prevHash, payload])` — the chain link hash. */
export async function hashChainLink(
  prevHash: string | null,
  payload: JsonValue,
): Promise<string> {
  return sha256Hex(canonicalize([prevHash, payload]));
}

/** Build the next entry; `prev = null` mints genesis (seq 0, prevHash null). */
export async function chainEntry(
  prev: AuditChainEntry | null,
  payload: JsonValue,
): Promise<AuditChainEntry> {
  const prevHash = prev === null ? null : prev.hash;
  const seq = prev === null ? 0 : prev.seq + 1;
  return {
    seq,
    prevHash,
    payload,
    hash: await hashChainLink(prevHash, payload),
  };
}

/** Fold a list of payloads into a complete chain, oldest first. */
export async function buildChain(
  payloads: readonly JsonValue[],
): Promise<AuditChainEntry[]> {
  const entries: AuditChainEntry[] = [];
  let prev: AuditChainEntry | null = null;
  for (const payload of payloads) {
    prev = await chainEntry(prev, payload);
    entries.push(prev);
  }
  return entries;
}

/** Mint the trusted anchor: length, tip hash, genesis hash. Throws on an empty chain (mirror). */
export function anchorChain(
  entries: readonly AuditChainEntry[],
): AuditChainAnchor {
  if (entries.length === 0) {
    throw new Error("audit-chain: cannot anchor an empty chain");
  }
  const tip = entries[entries.length - 1] as AuditChainEntry;
  return {
    length: entries.length,
    tipHash: tip.hash,
    genesisHash: (entries[0] as AuditChainEntry).hash,
  };
}

/**
 * Verify end to end. Returns the FIRST broken index. WITHOUT an anchor this proves only mutual
 * consistency (a tail truncation still returns valid); WITH an anchor, length + tip (+ genesis)
 * are asserted, catching truncation and wholesale rewrite. Exact mirror of audit-chain.ts.
 */
export async function verifyChain(
  entries: readonly AuditChainEntry[],
  anchor?: AuditChainAnchor,
): Promise<ChainVerification> {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i] as AuditChainEntry;
    const expectedPrev =
      i === 0 ? null : (entries[i - 1] as AuditChainEntry).hash;
    if (entry.seq !== i) return { valid: false, brokenAt: i };
    if (entry.prevHash !== expectedPrev) return { valid: false, brokenAt: i };
    if (entry.hash !== (await hashChainLink(entry.prevHash, entry.payload))) {
      return { valid: false, brokenAt: i };
    }
  }
  if (anchor !== undefined) {
    if (
      anchor.genesisHash !== undefined &&
      (entries.length === 0 ||
        (entries[0] as AuditChainEntry).hash !== anchor.genesisHash)
    ) {
      return { valid: false, brokenAt: 0 };
    }
    if (entries.length !== anchor.length) {
      return {
        valid: false,
        brokenAt: Math.min(entries.length, anchor.length),
      };
    }
    const tip = entries[entries.length - 1] as AuditChainEntry;
    if (tip.hash !== anchor.tipHash) {
      return { valid: false, brokenAt: entries.length - 1 };
    }
  }
  return { valid: true, brokenAt: null };
}

// --- WORM retention (mirror of packages/audit-worm/src/retain.ts + store.s3.ts) ---

/** Hard legal minimum, years. HIPAA §164.316(b)(2) = 6yr; SEC 17a-4 = 6yr. (retain.ts) */
export const MIN_RETENTION_YEARS = 6;
/** Conservative default when no explicit term is given — one year past the floor. (retain.ts) */
export const DEFAULT_RETENTION_YEARS = 7;

/** S3 Object-Lock mode (store.s3.ts). GOVERNANCE is bypassable; COMPLIANCE is root-proof. */
export type RetentionMode = "GOVERNANCE" | "COMPLIANCE";

/**
 * Mirror of `retainUntilFrom` (retain.ts): the `retain_until` date `years` after `now`, UTC and
 * calendar-correct (a Feb-29 anchor rolls FORWARD in a non-leap target). Below the floor throws.
 * The real function throws kernel `ValidationError`; this browser mirror throws a plain `Error` —
 * the parity test asserts the DATE output, not the error class.
 */
export function retainUntilFrom(
  now: Date,
  years: number = DEFAULT_RETENTION_YEARS,
): Date {
  const ms = now.getTime();
  if (Number.isNaN(ms)) {
    throw new Error("retainUntilFrom requires a valid anchor date");
  }
  if (!Number.isInteger(years) || years < MIN_RETENTION_YEARS) {
    throw new Error("retention term is below the WORM floor");
  }
  const until = new Date(ms);
  until.setUTCFullYear(until.getUTCFullYear() + years);
  return until;
}

/** Fixed seal instant → deterministic retain-until (no Date.now in any rendered path). */
export const SEALED_AT = new Date("2026-07-22T00:00:00.000Z");

/**
 * The retain-until date shown in the anchor panel. Computed from the real constants at the fixed
 * seal instant. `retain.ts` takes a term in YEARS, never a mode — GOVERNANCE and COMPLIANCE share
 * the same term (store.s3.ts), and the mode changes ENFORCEMENT (bypassable vs root-proof), not the
 * date. So this deliberately ignores mode; the mode's effect is the enforcement line in the UI.
 */
export function retainUntil(): Date {
  return retainUntilFrom(SEALED_AT, DEFAULT_RETENTION_YEARS);
}

// --- The poke model (baked sample data + state operations) ---

/** The seed chain: the same license-lifecycle events the Living Chain slide renders (audit-chain-sample.ts). */
export const SEED_PAYLOADS: readonly JsonValue[] = [
  { event: "license.issued", licenseId: "lic_8a2f", actor: "system" },
  { event: "entitlement.granted", module: "audit-worm", actor: "admin" },
  { event: "registry.pull", package: "@caisson/audit-worm", actor: "acme-co" },
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

export interface ChainState {
  readonly entries: readonly AuditChainEntry[];
  /** The trusted commitment held OUTSIDE the chain — the length + tip oracle. */
  readonly anchor: AuditChainAnchor;
}

/** The sealed starting chain + its freshly minted anchor. */
export async function initialState(): Promise<ChainState> {
  const entries = await buildChain(SEED_PAYLOADS);
  return { entries, anchor: anchorChain(entries) };
}

/** Append the next deterministic event and RE-MINT the anchor (store `AppendResult{ entry, anchor }`). */
export async function appendEntry(state: ChainState): Promise<ChainState> {
  if (state.entries.length >= MAX_ENTRIES) return state;
  const payload = APPEND_EVENTS[
    state.entries.length % APPEND_EVENTS.length
  ] as JsonValue;
  const prev = state.entries[state.entries.length - 1] ?? null;
  const entry = await chainEntry(prev, payload);
  const entries = [...state.entries, entry];
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

/** Per-row label — echoes the real RowStateChip register (packages/audit-worm/src/ui/row-state-chip.tsx). */
export type RowLabel = "Chain root" | "Verified" | "Tampered";

export interface Verdict {
  /** Internal-consistency pass (no anchor): catches tamper/insert/reorder/middle-drop. */
  readonly internal: ChainVerification;
  /** Anchored pass: additionally catches tail-truncation + wholesale rewrite. */
  readonly anchored: ChainVerification;
  readonly rows: readonly RowLabel[];
  readonly lengthMatches: boolean;
  readonly tipMatches: boolean;
}

export async function evaluate(state: ChainState): Promise<Verdict> {
  const internal = await verifyChain(state.entries);
  const anchored = await verifyChain(state.entries, state.anchor);
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
  v: Verdict,
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

/** Short display form of a 64-hex hash (mirror of audit-chain-sample.ts `shortHash`). */
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
