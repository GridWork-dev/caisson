// src/anchor-ots.ts — the OpenTimestamps `externally-transparent` drop-in (v1.1, Fork R-γ / ADR-0346
// §6: SHIPPED AS MINIMAL CODE behind the same TransparencyLog port).
//
// OTS is the "safer-to-ship-first" public-transparency proof (spike Q8): NO per-entry signature (the
// calendar Merkle-trees all submitters and commits the root to Bitcoin), idempotent-ish submission
// (a re-submit just re-aggregates — no duplicate irrevocable entry, unlike Rekor), and free aggregation.
// So the `AnchorSubmissionSigner`/verifier surface is UNUSED here — this validates that the target-
// agnostic port family holds for a very different proof shape.
//
// SCOPE (Fork R-γ): v1.1 ships the SUBMIT leg (calendar POST → durable `PendingAttestation`) + a stub.
// FULL verification is a documented seam: an `.ots` proof is verified by upgrading it (`ots upgrade`
// against the calendar) and confirming the Bitcoin commitment via block headers — a Bitcoin-node/header
// dependency that v1.1 does NOT take on. `verifyExternal` therefore fails closed (honestly) for an OTS
// target rather than claim a grade it cannot prove offline. The live calendar transport is un-exercised
// in CI (ADR-0047 ethos); the stub drives the port round-trip.
import { createHash } from "node:crypto";
import { fetchWithTimeout, ValidationError } from "@caisson-sh/kernel";
import {
  isIrreversiblePublicityOptIn,
  type IrreversiblePublicityOptIn,
  type OtsReceipt,
  type TransparencyLog,
} from "./anchor-transparency.ts";

/** OTS calendars accept a digest submit within a few seconds; default a conservative timeout. */
const DEFAULT_OTS_TIMEOUT_MS = 20_000;
/** The calendar digest-submission path. */
const OTS_DIGEST_PATH = "/digest";

export interface OpenTimestampsAnchorLogConfig {
  /** Calendar servers (e.g. `https://a.pool.opentimestamps.org`). At least one; https only. */
  readonly calendars: readonly string[];
  /** Fork D: the typed irreversible-publicity consent. WITHOUT it, this log cannot be constructed. */
  readonly optIn: IrreversiblePublicityOptIn;
  /** Outbound timeout (ms). Default 20s; below 1s is refused. */
  readonly timeoutMs?: number;
  /** Clock for `submittedAt`. Default: wall clock. */
  readonly now?: () => Date;
}

/**
 * The OpenTimestamps `TransparencyLog`. Construction REFUSES without the irreversible-publicity opt-in
 * (Fork D). `submit` POSTs `sha256(anchorBytes)` to the calendars (no key material) and returns a
 * `pending` OTS receipt holding the first calendar's `PendingAttestation` — durable evidence that is
 * upgraded to a Bitcoin proof later. Egress is a bare 32-byte digest (hashes only, no PII).
 */
export class OpenTimestampsAnchorLog implements TransparencyLog {
  readonly #calendars: readonly string[];
  readonly #timeoutMs: number;
  readonly #now: () => Date;

  constructor(config: OpenTimestampsAnchorLogConfig) {
    if (!isIrreversiblePublicityOptIn(config.optIn)) {
      throw new ValidationError(
        "OpenTimestampsAnchorLog requires a valid irreversible-publicity opt-in (Fork D)",
      );
    }
    if (config.calendars.length === 0) {
      throw new ValidationError(
        "OpenTimestampsAnchorLog requires at least one calendar URL",
      );
    }
    for (const url of config.calendars) {
      if (new URL(url).protocol !== "https:") {
        throw new ValidationError("OTS calendar URLs must be https endpoints");
      }
    }
    const timeoutMs = config.timeoutMs ?? DEFAULT_OTS_TIMEOUT_MS;
    if (!Number.isFinite(timeoutMs) || timeoutMs < 1_000) {
      throw new ValidationError("OTS timeout must be a finite value >= 1000ms");
    }
    this.#calendars = [...config.calendars];
    this.#timeoutMs = timeoutMs;
    this.#now = config.now ?? ((): Date => new Date());
  }

  async submit(anchorBytes: Uint8Array): Promise<OtsReceipt> {
    const digest = createHash("sha256").update(anchorBytes).digest();
    const messageImprint = Buffer.from(digest).toString("hex");
    // Submit to the first reachable calendar; the aggregation is shared, so one attestation suffices.
    let proof: string | undefined;
    let lastError = "no calendar reached";
    for (const calendar of this.#calendars) {
      try {
        const resp = await fetchWithTimeout(
          `${calendar.replace(/\/+$/, "")}${OTS_DIGEST_PATH}`,
          {
            method: "POST",
            headers: {
              "content-type": "application/octet-stream",
              accept: "application/octet-stream",
            },
            body: digest,
          },
          { timeoutMs: this.#timeoutMs },
        );
        if (!resp.ok) {
          lastError = `calendar responded ${String(resp.status)}`;
          continue;
        }
        proof = Buffer.from(await resp.arrayBuffer()).toString("base64");
        break;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }
    if (proof === undefined) {
      throw new ValidationError("OTS calendar submission failed", {
        reason: lastError,
      });
    }
    return {
      algorithm: "opentimestamps",
      messageImprint,
      calendars: [...this.#calendars],
      proof,
      status: "pending",
      submittedAt: this.#now().toISOString(),
    };
  }
}

/**
 * A deterministic, network-free `OpenTimestampsAnchorLog` test double. Reproduces the imprint a real
 * calendar aggregates (`sha256(anchorBytes)`) and returns a stable `pending` `PendingAttestation`, so
 * the whole checkpoint flow (submitted → receipted through the outbox) is exercised in CI without a
 * live calendar. NOT for production. Requires the opt-in like the real log — the guard is the point.
 */
export class StubOpenTimestampsLog implements TransparencyLog {
  readonly #calendars: readonly string[];
  readonly #clock: Date;

  constructor(options: {
    readonly optIn: IrreversiblePublicityOptIn;
    readonly calendars?: readonly string[];
    readonly now?: Date;
  }) {
    if (!isIrreversiblePublicityOptIn(options.optIn)) {
      throw new ValidationError(
        "StubOpenTimestampsLog requires a valid irreversible-publicity opt-in (Fork D)",
      );
    }
    this.#calendars = options.calendars ?? [
      "https://a.pool.opentimestamps.org",
    ];
    this.#clock = options.now ?? new Date(0);
  }

  submit(anchorBytes: Uint8Array): Promise<OtsReceipt> {
    const messageImprint = createHash("sha256")
      .update(anchorBytes)
      .digest("hex");
    const proof = Buffer.from(`ots-pending|${messageImprint}`, "utf8").toString(
      "base64",
    );
    return Promise.resolve({
      algorithm: "opentimestamps",
      messageImprint,
      calendars: [...this.#calendars],
      proof,
      status: "pending",
      submittedAt: this.#clock.toISOString(),
    });
  }
}
