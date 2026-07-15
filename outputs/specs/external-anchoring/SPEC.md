# SPEC — External transparency anchoring for the audit-worm chain

- **Status:** SHIPPED — v1 only (PR #239, 2026-07-15; forks locked → ADR-0332, PLAN locks ADR-0346): TSA leg + durable outbox + chain-level `verifyExternal`. The v1.1 Rekor leg is still NOT built — its gating protocol spike is now COMPLETE (`SPIKE-rekor-v2-protocol.md:3`, 'GO to decompose v1.1') but no PLAN has decomposed the Rekor work yet.
- **Tags:** `security` · `external-system` · product (Compliance bundle / premium provenance)
- **Sibling spec:** SPEC-per-row-verification-ui.md — that spec renders verification; this one supplies the external trust root it chains up to.
- **Prior art in-repo:** ADR-0056 already reserves "DSSE/in-toto + Sigstore/Rekor transparency" as the **premium provenance tier — un-wired seam**, and `packages/signing-primitive/src/sign.ts` already ships the RFC-3161 `TimestampAuthority` port (stub-doubled, live transport un-wired). This spec **wires that reserved seam** and extends it from evidence-pack signatures to the chain itself. External prior art: Sectum (Rekor-anchored evidence packs, pre-alpha).

## Amendment record (2026-07-13)

This spec was DRAFT going into the 2026-07-13 adversarial audit round (18-lane red-team + Codex `gpt-5.6-sol` cross-vendor review). Codex's verdict on the draft was **rethink** (`codex-adversarial-review.md` CR-01/CR-02/CR-03/CR-04/CR-16, all BLOCKER); the synthesis (`AUDIT-SYNTHESIS.md` §B "External anchoring") concurred, and the operator re-locked at the challenged forks (`FORK-LOCKS.md` ✅ RE-LOCKS row "Anchoring": _"Grade-split + Rekor v1.1"_). This amendment implements that re-lock. Five findings drove it:

- **CR-01** — the port's `submit(anchorBytes)` shape can't produce a valid Rekor v2 entry (no signature, no verifier material, no shard/TUF handling); the effort sketch's "one module ≈ `sign.ts`" estimate was wrong by roughly 2–3×. → Rekor demoted to v1.1, gated on a protocol spike; the port is redesigned around a signed submission.
- **CR-02** — the checkpoint job had an unrecoverable crash window between "submitted externally" and "receipt persisted," and Rekor v2 dropped online proof retrieval, so a lost receipt is unrecoverable after the fact. → a durable outbox lands in v1, before any Rekor leg exists.
- **CR-03** — TSA-default doesn't deliver the spec's own sellable claim ("outside parties detect rewrite"), and ADR-0056 already RFC-3161-countersigns evidence-pack signatures, so TSA-as-anchoring partially duplicates an existing tier. → trust grades split into `trusted-timestamped` and `externally-transparent`; the sellable line is rewritten to attach only to the latter.
- **CR-04** — a hash chain has no compact per-row external inclusion proof. → external status renders at chain/checkpoint level only in v1 and v1.1; per-row external proof is an explicit future fork owned by the sibling spec.
- **CR-16** — the scheduled handler can't live in Apache-2.0 `packages/jobs` without creating an upward dependency on commercial `audit-worm`, which violates ADR-0094. → job ownership is pinned to the commercial side.

Superseded by this amendment: the FORK-LOCKS draft's Fork A ("TSA + Rekor tiles both ship v1") and Fork E ("offline inclusion-proof verification in `verifyExternal` v1"). Cadence (Fork B), infra posture (Fork C), and naming (Fork F) were not contested and carry forward unchanged.

## Goal

Upgrade the trust claim of `@caisson/audit-worm` beyond _"tamper/truncation/rewrite evident to anyone who trusts our WORM store."_ Today the chain (`audit_chain_entry`) and its write-once anchor (`{length, tipHash, genesisHash}` in the `ArtifactStore`) both live inside the buyer's trust domain — `chain-store.ts` calls the WORM store "the trusted length oracle," but the oracle is self-hosted: a privileged actor who rewrites the DB **and** replaces the object store (trivial under GOVERNANCE mode, the default) leaves nothing for a third party to catch. Publishing periodic chain-anchor checkpoints into an external log — timestamped, or (v1.1) publicly transparent — closes part of that hole: the anchor is hashes-only (`length`/`tipHash`/`genesisHash` — no payload, no PII), so the buyer's data never egresses. But the strength of the claim depends entirely on which external target receives the checkpoint — see **Trust grades**, this spec no longer makes one undifferentiated claim.

**The sellable line (amended, CR-03):** _"Your audit chain's roots can be anchored in a public transparency log — even a root-privileged insider can't rewrite history without it being provable to a party who holds nothing of yours."_ This claim attaches **only** to the `externally-transparent` grade. A TSA-only deployment is never marketed with this line.

## Trust grades (CR-03 — the load-bearing amendment)

The draft made one undifferentiated claim ("retroactive rewriting is detectable by an outside party") regardless of anchor target. That's false for a TSA-only deployment: a receipt stored in the buyer's own WORM store doesn't defeat an insider who can destroy both the chain and the receipt. Two honestly-distinct grades replace it:

| Grade                    | Target                                 | Egress                                                                                                     | What it actually proves                                                                                                                                                | What it does NOT defeat                                                                                                                      |
| ------------------------ | -------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `trusted-timestamped`    | RFC-3161 TSA                           | Imprint only (hash of anchor bytes)                                                                        | The anchor existed at time T, attested by a third-party clock. Receipt lives in the buyer's own trust domain.                                                          | A privileged insider who rewrites the chain, the WORM store, _and_ the receipt together. Never marketed as "outside parties detect rewrite." |
| `externally-transparent` | Public log (Rekor v2 / OpenTimestamps) | Anchor bytes committed into a public, append-only log; existence + rough cadence become permanently public | The anchor state at T is provable to a party who holds **nothing** of the buyer's — the log itself is the escrow. This is the only grade the sellable line applies to. | Nothing within its threat model; the residual is the log operator's own availability/integrity, out of scope here.                           |

**Overlap with ADR-0056:** ADR-0056 already RFC-3161-countersigns evidence-pack _signatures_ at export time. `trusted-timestamped` chain-anchoring is adjacent, not identical — it timestamps the **chain's periodic checkpoint**, not a specific exported pack — but the two are close enough in trust value that this spec positions `trusted-timestamped` as _reusing_ that existing tier's honest ceiling, not a new marketing claim layered on top of it. Docs and UI copy must say "a private, third-party-clock-attested receipt" for this grade, never "externally verifiable" or "outside parties can detect rewrite."

`externally-transparent` (Rekor v2 today; OTS as a documented drop-in) is the only grade that unlocks the goal's sellable line, and it ships in **v1.1** after the protocol spike below — not v1.

## Non-goals

- The per-row verification UI (sibling spec; interface defined below — amended, see **Interface to the per-row verification UI**).
- DSSE/in-toto envelopes for evidence signatures (stays the separate ADR-0056 premium seam).
- Running or requiring a witness/monitor network; we produce verifiable receipts, we don't operate log infrastructure.
- Changing the per-append WORM anchor mechanics in `chain-store.ts` (they stay exactly as shipped; anchoring is additive and **never inside the append transaction** — the KNOWN-BOUND comment's discipline about external side effects in txns is binding here).
- **(amended)** A compact per-row external inclusion proof (CR-04) — a SHA-256 linked chain has no succinct proof that row `s` is covered by a _later_ external checkpoint without replaying the intervening prefix. v1 and v1.1 both render external status at chain/checkpoint level only; a Merkle commitment or deployment-wide super-root for compact per-row proofs is an explicit future fork, owned by the sibling spec, not this one.
- **(amended)** The scheduled handler living in Apache-2.0 `packages/jobs` (CR-16) — see **Job ownership**.

## Design

**Shape: an async checkpoint job + a port, composing what exists — v1 ships the TSA leg only; the Rekor leg is v1.1, gated on the protocol spike below.**

1. **Port, split by grade.** The draft's single `ExternalAnchorLog.submit(anchorBytes)` shape is wrong for a public-log target (CR-01) — it survives unchanged only for the timestamped grade:

   ```ts
   // v1 — trusted-timestamped grade only
   interface TrustedTimestampLog {
     submit(anchorBytes: Uint8Array): Promise<TimestampReceipt>;
   }
   ```

   `TsaAnchorLog` implements this by reusing the RFC-3161 pattern already in `sign.ts` — imprint-only egress, private receipt. This is the only concrete implementation in v1.

   The `externally-transparent` grade needs a different, signed shape (v1.1, post-spike — see **Rekor protocol spike** and **Effort sketch**):

   ```ts
   // v1.1 — externally-transparent grade, post-spike
   interface ExternalAnchorSubmission {
     anchorBytes: Uint8Array;
     digest: Uint8Array;
     signature: Uint8Array;
     verifier: PublicKeyMaterial;
     target: TransparencyTarget;
   }
   interface TransparencyLog {
     submit(entry: ExternalAnchorSubmission): Promise<TransparencyReceipt>;
   }
   ```

   `RekorAnchorLog` implements this against the Rekor v2 `hashedrekord` entry contract (artifact digest + signature + certificate/public key), binding to the **existing per-tenant Ed25519 signer** from `signing-primitive` — that binding is itself spike scope, not assumed. `OpenTimestampsAnchorLog` is a documented v1.1+ drop-in behind the same interface (calendar-aggregated, no per-entry signature required, so it degrades gracefully if the Rekor spike stalls). Test doubles in CI, live transports behind `fetchWithTimeout` — same ADR-0047 ethos as the TSA seam.

2. **What gets submitted:** the **canonical anchor bytes already produced by `encodeAnchor()`** (or their sha256, per target log's entry format). Nothing new is hashed; the anchor already transitively commits the entire chain prefix via `tipHash`. For the v1.1 signed shape, the digest and signature are computed over the same bytes — no second commitment.

3. **Durable outbox (CR-02, v1, before any target ships).** The draft's "submit, then write the receipt" sequence has an unrecoverable crash window: a failure between accept and receipt-persistence loses the only verification bundle, and Rekor v2 removed online proof retrieval — there is no way to re-fetch a lost receipt after the fact. v1 ships a durable outbox in front of every target (TSA included, so the discipline is proven before Rekor lands in v1.1):
   - Keyed `(accountId, target, anchorLength, anchorDigest)`.
   - States: `pending → submitted → receipted`, or `→ failed`. Persisted **before** egress, not after.
   - A crash or timeout after the target accepts but before the receipt is durably written resolves to an **operator-reconciliation state** — surfaced, not silently retried. Blind retry against a public log risks duplicate irrevocable public entries; that failure mode is worse than a delayed checkpoint.
   - Exact recovery semantics (does the target expose an idempotency key? a lookup-by-digest? neither?) are protocol-spike scope for the Rekor leg — the outbox state machine ships in v1 target-agnostic; target-specific recovery logic ships with each target.

4. **Checkpoint job** (scheduled, e.g. via a pg-boss lane — see **Job ownership** for where it registers from): per tenant, read the current WORM anchor (`anchors/<len>.json`), skip if already receipted, enqueue into the outbox, submit, and on success **write the receipt back into the WORM store** under a length-keyed, write-once sibling key (`{account_id}/audit-chain/receipts/<len>.<target>.json`) with the same retention floor. Receipts are evidence; they live where evidence lives. The outbox row and the WORM receipt are two different durability layers — the outbox recovers a stuck submission, the WORM object is the long-lived evidence artifact.

5. **Verification (v1 scope, amended — CR-04 / FORK-LOCKS ✅ Anchoring):** `verifyExternal(accountId)` beside `verify()`. **v1** checks: the latest receipt exists, and the receipted anchor bytes match the WORM anchor. It does **not** attempt offline inclusion-proof verification in v1 — there's no public-log target to verify against yet (TSA receipts have no inclusion-proof concept; they're an imprint plus a timestamp token, verified against the TSA's certificate, which v1 does perform). **v1.1** adds Rekor's offline inclusion-proof verification (checkpoint + log public key) once the target ships. Fail-closed like everything else in the package, at whichever depth is currently wired.

6. **Evidence packs:** `compliance-core`'s generator includes the newest `AnchorReceipt` beside the existing chain-anchor binding — an exported pack proves the chain state it was sealed against, tagged with **which trust grade** backs that proof (`trusted-timestamped` in v1; `externally-transparent` once v1.1 ships and a buyer opts in).

7. **Honest limit (stated in docs, amended per CR-03):** `trusted-timestamped` receipts stored in the same trust domain only defeat rewriters who can't also destroy receipts (COMPLIANCE-mode retention makes destruction hard, GOVERNANCE doesn't) — this grade is never marketed as transparency anchoring. **Only `externally-transparent` targets (Rekor/OTS) make rewrite detectable by parties who hold nothing** — the log itself is the escrow. This asymmetry drives Fork A/D, not a phrasing choice.

## Job ownership (CR-16)

The scheduled anchoring handler must **never** live in Apache-2.0 `packages/jobs` — `audit-worm` is commercial, and a generic open package registering a concrete commercial handler is an upward dependency that violates ADR-0094's open↔commercial boundary (the same boundary the standards-gate enforces elsewhere in the repo).

- `packages/jobs` keeps only **generic scheduling ports** (register a named job, a cron/interval trigger, retry policy) — no knowledge of anchoring, chains, or WORM keys.
- The concrete handler (reads the WORM anchor, drives the outbox, calls the port, writes the receipt) registers from the **commercial composition package** (`packages/compliance`, which already depends on jobs-adjacent commercial modules) — or stays entirely inside `audit-worm` and is registered into the generic scheduler from there. Either shape is acceptable; registering the concrete handler _from_ `packages/jobs` is not.

## Rekor protocol spike (required before the v1.1 PLAN — CR-01)

The draft's port shape (`submit(anchorBytes): Promise<AnchorReceipt>`) cannot produce a valid Rekor v2 entry. Rekor v2 accepts `hashedrekord` entries carrying an artifact digest, a signature, and verifier material (certificate or public key) — not a bare byte blob. Before the Rekor leg reaches PLAN, a protocol spike must resolve, live against the Rekor v2 client contract:

- **Signed-submission binding.** The existing per-tenant Ed25519 signer (`signing-primitive`) has to sign the anchor digest for submission — the spike designs that binding (key material access from the anchoring job, signing scope, failure mode if the tenant key is unavailable).
- **SigningConfig discovery** — how the client learns which signing/verification material the target instance expects.
- **TUF trust roots** — Rekor v2 clients are TUF-distributed; the spike proves out root pinning/update and CI reproducibility (no live TUF fetch in tests — pinned fixtures).
- **Rotating shards** — v2 shards log data; the spike confirms the client library handles shard discovery/rotation rather than this codebase reimplementing it.
- **Checkpoint verification** — the shape of the offline inclusion-proof check that `verifyExternal` will perform in v1.1.
- **Key-format tests** — Ed25519 is the tenant signer's existing algorithm; confirm it's an accepted Rekor v2 key format end-to-end, not assumed.

Until this spike lands as a document, the Rekor leg has no estimate better than "unknown, budget the bulk of v1.1's effort here" (see Effort sketch). No PLAN task decomposes Rekor work before the spike's findings exist.

## Cadence design

Per-entry submission is rejected: it would put a 2–20s network call (Rekor v2 blocks on checkpoint publication; timeouts ≥20s recommended by its client guide) near the hot append path, hit public-instance courtesy limits at volume, and leak per-event activity timing. **Periodic checkpoints + on-evidence-pack-generation** is the recommended shape: a daily (configurable, hourly floor) tick anchors each active tenant's current anchor through the durable outbox; pack generation additionally anchors the tip it seals against. Detection latency = cadence; a buyer who wants tighter latency turns the dial. Because every anchor commits its full prefix, coverage is always total — cadence only affects how _fresh_ the externally-provable state is. This cadence design is target-agnostic and unchanged by the v1/v1.1 split — it applies to `trusted-timestamped` today and to `externally-transparent` once v1.1 ships.

## Tenant story

Per-tenant chains → per-tenant submissions (one per tenant per tick; skip-if-unchanged makes idle tenants free). No new Merkle aggregation layer in v1 or v1.1 (a deployment-wide super-root batching all tenants into one external entry is a documented later optimization if tenant-count × cadence ever meets rate limits, and the same structure CR-04 flags as the eventual answer for compact per-row external proofs — OTS calendars effectively give aggregation for free already). Receipts are tenant-scoped WORM objects under the existing `{account_id}/…` key discipline (`assertSafeKey` unchanged); outbox rows are tenant-scoped operational state, not WORM objects.

## Self-hosted buyer story

Caisson sells self-hostable foundations — anchoring is **buyer-configured**: the port's target + URL/keys live in the buyer's deployment config. **v1 defaults to `trusted-timestamped`** (freetsa/digicert-class TSAs; imprint-only egress) under the honest weaker claim from Trust grades above. **v1.1 adds `externally-transparent`** as a strictly opt-in upgrade (Rekor v2 public instance: GA Oct 2025, 99.5% SLO, TUF-distributed shard discovery; OTS calendars as a documented drop-in) — never default-on, per Fork D. Air-gapped deployments run with anchoring **off** entirely and the residual risk documented (their WORM COMPLIANCE mode remains the strongest available claim). No phone-home to Caisson is required for the feature to work at either grade — consistent with offline license verification (ADR-0010) and the data-custody posture. A private-Rekor-per-buyer deployment guide is docs-only support (Fork C) — not code Caisson ships or operates.

## Data-custody / egress check

Anchor bytes are hashes and a counter — no payload, no PII, and crypto-shred (ADR-0055) is unaffected since chained PII is committed as ciphertext (the external log commits the same ciphertext hashes; key destruction doesn't invalidate receipts). For `trusted-timestamped`, egress is imprint-only to the TSA — no residual public exposure. For `externally-transparent` (v1.1), residual leak of a **public** log target is: existence, cadence/timing, and rough activity volume of a tenant's compliance events, permanently and irrevocably public. That is a positioning question, not a technical one → Fork D (strictly typed opt-in, never default). A new external egress sink (TSA URL today; sigstore.dev / OTS calendars at v1.1) must land in the buyer-facing security docs the same change — and for caisson's own deployment, a row in gridwork's `identity/security-surfaces.md` per the invariant.

## Interface to the per-row verification UI (sibling) — amended, CR-04

The draft proposed three per-row trust grades culminating in a per-row `externally-anchored` state, implying a compact external inclusion proof for any given row. That's not available on a hash chain: a SHA-256 linked list has no succinct proof that row `s` is covered by a _later_ external checkpoint short of replaying the intervening prefix. Fetching only `anchor(s+1)` proves row `s` against the buyer-controlled WORM domain, not against a later external checkpoint.

Amended contract: an **anchored checkpoint** is `(length L, anchor A_L, receipt R_L, grade G)`. External trust status renders **at the chain/checkpoint level only** in v1 and v1.1 — "this chain, as of length L, is `trusted-timestamped`/`externally-transparent` as of receipt R_L" — never as a per-row badge implying row `s` itself carries an external proof. A compact per-row external proof is an explicit **future fork**, not this spec's or the sibling's v1/v1.1 scope, and requires one of: full-prefix/range replay (budgeted, not free), or a Merkle commitment / deployment-wide super-root purpose-built for compact inclusion proofs. The sibling spec owns rendering; this spec owns not overclaiming what's checkable — the sibling's per-row UI must not render checkpoint-level trust as if it were row-level.

## Effort sketch (amended, CR-01 — honest estimate replaces "one module ≈ sign.ts")

**v1 (TSA leg + outbox + verifyExternal, plan-ready now):**

- `anchor-transparency.ts` in `audit-worm`: `TrustedTimestampLog` port + `TsaAnchorLog` (reuses the existing `sign.ts` RFC-3161 pattern) + receipt schema + durable outbox state machine + `verifyExternal` (existence + byte-match only) + doubles. Comparable in size to `sign.ts` — this estimate holds for the TSA leg specifically, not for the whole feature.
- One scheduled job registration, from the commercial side per **Job ownership**.
- Generator inclusion in `compliance-core` (grade-tagged).
- Docs: Trust grades table, honest-limit language, security-surfaces ledger row for the TSA egress sink.
- No schema migration (receipts are WORM objects, not rows; outbox rows are new operational state — small table or KV, not a chain-format change).

**v1.1 (Rekor leg, gated on the protocol spike, NOT estimated as a fixed size):** the spike above resolves signed-submission binding, SigningConfig discovery, TUF trust roots, shard rotation, and checkpoint verification before any task decomposition. Once resolved, the known-large piece is the **Rekor tiles client work** (submission construction, live transport, offline inclusion-proof verification in `verifyExternal`) — budget the bulk of v1.1's effort there; the port interface itself is a small, already-sketched shape (`ExternalAnchorSubmission`, above). Do not carry the draft's "one module ≈ `sign.ts`" estimate forward for this leg — CR-01 found it wrong by roughly 2–3×, per the audit synthesis's own cross-check against the SPEC's original effort sketch.

## Forks (LOCKED, re-locked 2026-07-13 → ADR-0332)

**A. Anchor target**

- **LOCKED: Pluggable port; TSA ships v1, Rekor tiles is the flagship default and ships v1.1 post-spike.** Supersedes the draft's "TSA + Rekor tiles both ship v1." Public detectability (the actual trust upgrade) is real but not free — CR-01 found the submission contract incomplete; the port stays target-agnostic so TSA, Rekor, and OTS are all drop-ins behind the same shape family.

**B. Cadence**

- **LOCKED: Periodic (daily default, configurable, hourly floor) + on-evidence-pack-generation.** Total coverage, bounded egress, no hot-path coupling. Unchanged from the draft — not contested by the audit.

**C. Whose infrastructure**

- **LOCKED: Buyer-configured direct to public-good/OTS/TSA instances, defaults included.** No new Caisson service, no custody question, works self-hosted. Plus a **private-Rekor-per-buyer deployment guide, docs-only** (no code Caisson ships or operates). A Caisson-operated anchoring relay (batching + receipt escrow as a premium service) is **deferred until a buyer asks** — it would create a new Caisson egress/custody surface and an SLO obligation this spec doesn't take on speculatively.

**D. Egress posture**

- **LOCKED: TSA (`trusted-timestamped`) default-on, under the honest weaker claim from Trust grades — public log (`externally-transparent`) strictly typed opt-in, surfaced next to the COMPLIANCE retention opt-in.** This is the operator's original override of the "opt-in everything" recommendation, **preserved by the re-lock** — but CR-03 forced the honesty fix that makes the default safe to ship: TSA-default no longer implies the sellable "outside parties detect rewrite" line, because that line now attaches only to the opt-in grade. The irreversible-publicity property of a public log keeps the same typed-opt-in respect as irreversible retention (ADR-0051 pattern); the private-receipt default does not carry that irreversibility and so can stay default-on.

**E. Receipt verification depth**

- **LOCKED (amended): `verifyExternal` v1 checks receipt existence + receipted-anchor-byte-match only. Offline inclusion-proof verification rides the Rekor v1.1 leg.** Supersedes the draft's "offline inclusion-proof verification in v1" — there is no public-log target in v1 to hold an inclusion proof against. The per-row/chain-level UI (per the amended Interface section above) must not render `externally-transparent` trust until v1.1's inclusion-proof check actually exists — a receipt Caisson hasn't independently verified is not "externally anchored," it's "submission recorded."

**F. Naming/positioning**

- **LOCKED: "External anchoring" as the feature name, target-agnostic.** Unchanged — survives Fork A's v1/v1.1 split cleanly, which is exactly why it was chosen.

## Acceptance

Forks A–F are **LOCKED** (operator re-lock, 2026-07-13, superseding the earlier "TSA + Rekor tiles both ship v1" / "offline-verify v1" draft locks) → recorded as **ADR-0332** (extends ADR-0052/0056, supersedes nothing else). This amended spec is **plan-ready for v1** (TSA leg + durable outbox + chain-level `verifyExternal` + job ownership boundary). The **Rekor v1.1 leg is gated**: the protocol spike above must land as a document before any Rekor task reaches PLAN. Per the caisson cadence (research → spec → ADR lock → code), v1 graduates from the scratchpad into `specs/`/kickoff now; v1.1 graduates once the spike's findings exist.
