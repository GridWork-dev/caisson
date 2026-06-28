# ADR-0051 — WORM Object-Lock retention mode: GOVERNANCE default + buyer-opt-in per-class COMPLIANCE

Status: accepted · 2026-06-27 (Wave-1 editions session, fork lock. Locks the Object-Lock retention
MODE of the `audit-worm` S3 store — the single most load-bearing compliance config.)

S3 Object-Lock offers two retention modes that trade recoverability against court-admissibility:
COMPLIANCE is root-proof and irreversible until retain-until (the SEC 17a-4 grade regulated buyers
pay for), but one bad `retainUntilDate` bricks a bucket for years; GOVERNANCE is bypassable and safe
for dev. This ADR sets the default and the escalation path. Implements the WORM retention half of
ADR-0006 (the Compliance edition data layer).

## Decision

**GOVERNANCE is the default everywhere; COMPLIANCE is a buyer-configurable per-evidence-class
escalation the buyer explicitly opts into.** Safe-by-default, not footgun-by-default.

- **GOVERNANCE default on every S3-backed evidence class.** Recoverable: delete/overwrite is blocked
  unless the caller holds `s3:BypassGovernanceRetention` **and** sends the bypass header
  (`x-amz-bypass-governance-retention: true`). A misconfigured prod bucket stays technically
  bypassable rather than permanently bricked.
- **COMPLIANCE is per-evidence-class, opt-in only.** The 17a-4 grade — root-proof, irreversible until
  retain-until expires. A buyer escalates a class (e.g. SSN/PHI → COMPLIANCE, routine logs →
  GOVERNANCE) through the configurable mode surface, which is **itself a Wave-1 deliverable**, not an
  internal constant.
- **The escalation is guarded by an explicit irreversible-opt-in.** Setting a class to COMPLIANCE
  requires the buyer to acknowledge a typed guard ("this locks data for N years, unrecoverable —
  even AWS root cannot delete it") before the store will write a COMPLIANCE object. No code path
  silently selects COMPLIANCE.
- **NEVER COMPLIANCE in local/test.** `LocalArtifactStore` ignores retention entirely; the
  `S3ArtifactStore` refuses COMPLIANCE outside a real deployment, so a dev bucket can never be
  irreversibly locked by accident.
- **DB `retain_until` stays provably equal to the S3 `RetainUntilDate`** for both modes (per the
  calendar-correct `retainUntilFrom` helper, ADR-0006's retention-on-row-AND-object invariant).

## Rejected

- **COMPLIANCE always (strictest)** — truly immutable everywhere and the cleanest compliance story,
  but a single bad `retainUntilDate` bricks the bucket for the full retention term, unrecoverable
  even by the account root. Catastrophic as a default for dev/test/misconfigured prod. Rejected.
- **Pure GOVERNANCE with no COMPLIANCE path** — safe everywhere, but a bypassable store fails the
  SEC 17a-4 / Cohasset bar that regulated buyers are buying the Compliance edition _for_; it would
  ship a WORM store that is not actually write-once against a privileged insider. Rejected.

## Binding

Future code and agents MUST treat GOVERNANCE as the default Object-Lock mode for every evidence
class; COMPLIANCE is reachable only through the buyer-facing per-class configuration surface, behind
the irreversible-opt-in guard, and is never selected by a default, a test, or the `LocalArtifactStore`
(which ignores retention). Both modes keep DB `retain_until` byte-equal to the object
`RetainUntilDate`. Wardfile's proven GOVERNANCE-now / COMPLIANCE-at-escalation pattern informs the
seam; the commercial-licensing floor (ADR-0023, with ADR-0050 making the local-ai edition commercial
too) governs the surrounding modules. Evidence: ADR-0006:10-13 (S3 Object-Lock, retention on row AND
object, byte-stable checksums; SOC2-tier escalation language); `outputs/research/wave1-forks.md` P2-5
(GOVERNANCE-vs-COMPLIANCE fork, operator-gated, Wardfile escalation precedent) + P2-4 (the
`ArtifactStore` port / `retainUntilFrom` helper / seam-tested `S3ArtifactStore`); SDK brief §1
(COMPLIANCE = the regulated path, GOVERNANCE bypassable via `s3:BypassGovernanceRetention`; Cohasset
2025); Wardfile `core/artifact/store.s3.ts`.
