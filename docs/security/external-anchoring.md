# External anchoring — trust grades

What `@caisson-sh/audit-worm`'s external anchoring feature actually proves, in plain
language — the internal source-of-truth this repo's contributors write from when
documentation, a security review, or trust-center copy for an app built on Caisson needs
to describe the feature. Canonical decisions: SPEC `outputs/specs/external-anchoring/SPEC.md`,
`knowledge/decisions/ADR-0332-external-anchoring-locks.md` (forks A-F),
`knowledge/decisions/ADR-0346-external-anchoring-plan-locks.md` (PLAN-level locks P1-P4). This doc
restates neither — it is the synthesized summary; the ADRs win on any conflict.

**Status: v1 + v1.1 ship** — the `trusted-timestamped` grade (default) AND the
`externally-transparent` grade (public transparency log, strictly opt-in) are both built. The
`externally-transparent` leg is Rekor v2 (`log2025-*.rekor.sigstore.dev`) with a minimal
OpenTimestamps drop-in behind the same port. See the egress + verification sections for what each adds.

## Why this exists

`@caisson-sh/audit-worm`'s per-tenant hash chain is tamper/truncation/rewrite-evident **to anyone who
trusts the deploying org's own WORM store**. That's a real property, but it's self-attested: a privileged
actor who can rewrite both the chain table and the object-lock store leaves nothing for an outside party to
catch. External anchoring periodically commits the chain's checkpoint (`{length, tipHash,
genesisHash}` — hashes only, never payload or PII) to a target **outside** that store, so a
later verification has something to check against besides the deploying org's own word.

## The two trust grades — do not conflate them

| Grade                                                   | Target                                                          | What egresses                                                    | What it actually proves                                                                                                     | What it does NOT defeat                                                                       |
| ------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `trusted-timestamped` (v1, ships, default-on)           | RFC-3161 TSA (operator-configured, e.g. FreeTSA/DigiCert-class) | An imprint only — `sha256` of the anchor bytes, no chain content | The anchor existed at time T, attested by a third-party clock. The receipt is stored in the deploying org's own WORM store. | A privileged insider who can rewrite the chain, the WORM store, **and** the receipt together. |
| `externally-transparent` (v1.1, ships, **opt-in only**) | Public transparency log (Rekor v2 / OpenTimestamps)             | Anchor bytes committed into a public, append-only log            | The anchor state at T is provable to a party who holds **nothing** of the deploying org's — the log itself is the escrow.   | Nothing within its threat model; residual is the log operator's own availability.             |

**Copy invariant (binding, ADR-0332):** `trusted-timestamped` is never described as "externally
verifiable" or "outside parties can detect rewrite." That claim — _"even a root-privileged
insider can't rewrite history without it being provable to a party who holds nothing of yours"_ —
attaches **only** to `externally-transparent`. Any trust-center or
auditor-summary copy that blurs this line is a bug against ADR-0332, not a wording choice. The
generated evidence-pack `auditor-summary.txt` renders the honest phrase per grade
(`packages/compliance-core/src/evidence/external-anchor.ts`) — quote that phrasing verbatim rather
than re-deriving it.

## Honest limit

A `trusted-timestamped` receipt sitting in the deploying org's own trust domain only defeats a
rewriter who _can't also destroy the receipt alongside the chain_. Under WORM COMPLIANCE-mode
retention that's a meaningfully hard bar; under the GOVERNANCE default (deletable by a
sufficiently privileged actor) it is a weaker claim than "tamper-evident to anyone." Only a
public-log target makes rewrite detectable to a party holding nothing of the deploying org's —
that's `externally-transparent`. A deployment that stays on the TSA default is
`trusted-timestamped` only: a private, third-party clock — real value, but not public
transparency, and it should never be described as such.

## Egress: the TSA sink

External anchoring adds exactly one new egress path in v1: a periodic POST of an
**anchor imprint** (a sha256 hash — never chain content, payload, or PII) to an
operator-configured RFC-3161 TSA endpoint, over `fetchWithTimeout` with a 20s timeout. The
periodic trigger is deployment concern, not something this repo ships a service for — the
checkpoint-minting primitives live in `packages/audit-worm/src/anchor-checkpoint.ts`, and a
deploying app schedules its own call into them (an hourly floor is enforced inside the
primitive itself, whatever the caller's cadence). The target URL and any TSA credentials are
**deployment config**, never a default endpoint or an operated relay — no data from the
deploying org's chain reaches any third-party-controlled service through this path beyond the
imprint itself. An operator who wants zero external egress runs with anchoring off entirely
(env-gated, inert-until-armed — leaving the schedule unset means no TSA connection is ever
attempted).

## Egress: the public-log sink (`externally-transparent`, opt-in)

The v1.1 `externally-transparent` grade adds a **second, larger egress class**: a submission of the
anchor bytes (still hashes only — `{length, tipHash, genesisHash}`, no payload/PII) into a **public,
permanently and irrevocably visible** append-only log. Like the TSA leg above, the path is
env-gated and inert until armed — concretely: `CAISSON_ANCHOR_TARGET` selects the leg (`tsa` is
the default and the only value the reference wiring enables without an explicit arming act;
`rekor`/`ots` are refused until then), and the Rekor leg additionally requires
`CAISSON_REKOR_ANCHORING_KEY` (a deployment-level ed25519ph seed) plus the
`IrreversiblePublicityOptIn` at the call site. Two targets, both behind the same port:

- **Rekor v2** (`sigstore.dev`) — POST of a `hashedrekord/0.0.2` entry (an ed25519ph signature over a
  deployment-level anchoring key + the anchor digest) to a shard read from a **deployment-supplied
  SigningConfig** (the shard URL rotates ~6-monthly and is never hardcoded), over `fetchWithTimeout`
  with a ≥20s timeout. External sink: **`*.rekor.sigstore.dev`** + the TUF mirror
  **`tuf-repo-cdn.sigstore.dev`** (fixture-pinned; see refresh cadence).
- **OpenTimestamps** — POST of a bare `sha256` digest to Bitcoin calendar servers
  (**`*.pool.opentimestamps.org`** and configured calendars). No key material.

**Irreversible, and gated accordingly.** Every public-log entry is permanent — its existence, timing,
and rough volume are disclosed forever and cannot be deleted. Submission therefore requires a **typed
irreversible-publicity opt-in** (the exact acknowledgement string minted into a branded value; mirrors
the S3 COMPLIANCE opt-in, ADR-0051). Without it, a public-log target cannot be constructed — TSA stays
the default and no public egress is ever attempted by default. Deployment wiring stays
**inert-until-armed**: the Rekor/OTS target path is env-gated and unset means byte-identical TSA-only
behavior.

## Private Rekor per deployment (Fork C — docs-only deployment guide)

An operator who wants public-log transparency **without** egressing to the sigstore.dev public good — for
isolation, higher volume, or data-residency reasons — runs their **own private Rekor v2 (rekor-tiles)
instance** and points the deployment SigningConfig + TrustedRoot at it. Nothing in the code changes:
`RekorAnchorLog` reads the write URL from the deployment's SigningConfig and snapshots that log's own
key into each receipt, so offline verify works against the private log's key exactly as it does
against the public one. This package does **not** operate a relay or take on any egress/custody surface
for this (Fork C: an operated anchoring relay was never built). Running the log
is the deploying org's operational responsibility; the package supplies the client + the pinned-fixture pattern.

## Verification

`verifyExternal(accountId)` (`packages/audit-worm/src/verify-external.ts`) checks fail-closed and
**dispatches on the target grade**:

- **`trusted-timestamped` (TSA):** newest receipt exists for the current anchor length, the receipt's
  anchor digest byte-matches the live WORM anchor (constant-time), and the TSA `TimeStampToken` itself
  — full CMS parse + TSA certificate-chain validation (ADR-0346 P2).
- **`externally-transparent` (Rekor):** the same existence + byte-match, then a **fully offline**
  public-log check with **zero live TUF/Rekor fetch** — the C2SP signed-note **checkpoint** verified
  against the **receipt-embedded** log key (no TUF freshness enforced, so a receipt still verifies
  years later after its shard retires), the **RFC-6962 inclusion proof** reconstructing the checkpoint
  root, and the leaf digest equal to `SHA-512(anchorBytes)`. Only if all pass does it report
  `grade: "externally-transparent", verified: true` with the public `logIndex`.
- **OpenTimestamps:** fails closed honestly — full offline verification requires upgrading the `.ots`
  proof and confirming the Bitcoin commitment via block headers, a documented seam v1.1 does not take
  on. The submit leg ships; OTS verify does not claim a grade it cannot prove.

The receipt is **self-contained**: it carries the checkpoint, the inclusion proof, the log's
checkpoint-signing key, and the origin, so verification depends on nothing this package (or Sigstore)
still hosts. Any receipt that fails any step reports `verified: false`, never a silent pass, and the two
grades never conflate.

## Fixture refresh cadence (hermetic CI)

The offline Rekor verify path is proven in CI against committed fixtures under
`packages/audit-worm/src/__fixtures__/rekor-v2/` (a golden `TransparencyLogEntry`, the pinned
`trusted_root.json` carrying all shard keys, and a caisson SigningConfig) — **no test makes a live TUF
or Rekor call**. Because stored-receipt verify is freshness-independent by design (it uses the
receipt-embedded key and does not enforce TUF timestamp freshness), a **stale pinned root does not
break stored-receipt verify** — it only matters when capturing a _new_ golden entry (a new shard's key
must be present). Refresh the fixture set on the **pinned-registry sweep cadence**, not on a clock. The
fixture directory's own `README.md` restates this.
