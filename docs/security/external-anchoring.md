# External anchoring — trust grades (buyer-facing source content)

What `@caisson/audit-worm`'s external anchoring feature actually proves, in plain language — the
internal source-of-truth this repo's contributors write from when a buyer's security review, trust
center, or sales copy needs to describe the feature (the actual buyer-facing surfaces are `apps/site`
and `services/docs`, per this directory's own routing convention above; this file is not itself
shipped to a buyer). Canonical decisions: SPEC `outputs/specs/external-anchoring/SPEC.md`,
`knowledge/decisions/ADR-0332-external-anchoring-locks.md` (forks A-F),
`knowledge/decisions/ADR-0346-external-anchoring-plan-locks.md` (PLAN-level locks P1-P4). This doc
restates neither — it is the synthesized summary; the ADRs win on any conflict.

**Status: v1 ships today** — the `trusted-timestamped` grade only, described below. The
`externally-transparent` grade (public transparency log) is **v1.1, not yet built** — it is gated on
a protocol spike and appears here only as the honest contrast case.

## Why this exists

`@caisson/audit-worm`'s per-tenant hash chain is tamper/truncation/rewrite-evident **to anyone who
trusts Caisson's own WORM store**. That's a real property, but it's self-attested: a privileged actor
who can rewrite both the chain table and the object-lock store leaves nothing for an outside party to
catch. External anchoring periodically commits the chain's checkpoint (`{length, tipHash,
genesisHash}` — hashes only, never payload or PII) to a target **outside** Caisson's own store, so a
later verification has something to check against besides Caisson's word.

## The two trust grades — do not conflate them

| Grade                                                      | Target                                                       | What egresses                                                    | What it actually proves                                                                                             | What it does NOT defeat                                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `trusted-timestamped` (v1, ships today, default-on)        | RFC-3161 TSA (buyer-configured, e.g. FreeTSA/DigiCert-class) | An imprint only — `sha256` of the anchor bytes, no chain content | The anchor existed at time T, attested by a third-party clock. The receipt is stored in the buyer's own WORM store. | A privileged insider who can rewrite the chain, the WORM store, **and** the receipt together. |
| `externally-transparent` (v1.1, **not yet built**, opt-in) | Public transparency log (Rekor v2 / OpenTimestamps)          | Anchor bytes committed into a public, append-only log            | The anchor state at T is provable to a party who holds **nothing** of the buyer's — the log itself is the escrow.   | Nothing within its threat model; residual is the log operator's own availability.             |

**Copy invariant (binding, ADR-0332):** `trusted-timestamped` is never described as "externally
verifiable" or "outside parties can detect rewrite." That sellable line — _"even a root-privileged
insider can't rewrite history without it being provable to a party who holds nothing of yours"_ —
attaches **only** to `externally-transparent`, and only once v1.1 ships. Any sales page, trust
center, or auditor-summary copy that blurs this line is a bug against ADR-0332, not a marketing
choice. The generated evidence-pack `auditor-summary.txt` renders the honest phrase per grade
(`packages/compliance-core/src/evidence/external-anchor.ts`) — quote that phrasing verbatim rather
than re-deriving it.

## Honest limit

A `trusted-timestamped` receipt sitting in the buyer's own trust domain only defeats a rewriter who
_can't also destroy the receipt alongside the chain_. Under WORM COMPLIANCE-mode retention that's a
meaningfully hard bar; under the GOVERNANCE default (deletable by a sufficiently privileged actor) it
is a weaker claim than "tamper-evident to anyone." Only a public-log target makes rewrite detectable
to a party holding nothing of the buyer's — that's `externally-transparent`, v1.1. Until v1.1 ships,
external anchoring upgrades the chain's tamper-evidence with a private, third-party clock — real
value, but not public transparency.

## Egress: the new TSA sink

External anchoring adds exactly one new egress path in v1: a periodic, buyer-configured POST of an
**anchor imprint** (a sha256 hash — never chain content, payload, or PII) to the buyer's chosen RFC-3161
TSA endpoint. Per-tenant, at most hourly (daily default; `ANCHOR_CHECKPOINT_SCHEDULE` enforces an
hourly floor, `services/license/src/anchoring-scheduler.ts`), over `fetchWithTimeout` with a 20s
timeout. The target URL and any TSA credentials are **buyer deployment config**, never a Caisson
default endpoint or a Caisson-operated relay — no buyer data reaches a Caisson-controlled service
through this path. A buyer who wants zero external egress runs with anchoring off entirely (env-gated,
inert-until-armed — unset `ANCHOR_CHECKPOINT_SCHEDULE` means no TSA connection is ever attempted).

v1.1's `externally-transparent` grade will add a second, larger egress class (public transparency-log
submission, permanently and irrevocably public existence/cadence metadata) — strictly opt-in, never
default, documented separately once that leg ships.

## Verification

`verifyExternal(accountId)` (`packages/audit-worm/src/verify-external.ts`) checks, fail-closed: the
newest receipt exists for the current anchor length, the receipt's anchor digest byte-matches the
live WORM anchor (constant-time compare), and the TSA timestamp token itself — full CMS
`TimeStampToken` parse plus TSA certificate-chain validation (ADR-0346 P2). It does not attempt an
inclusion-proof check — there is no public log to check one against in v1 — and it can never return
`grade: "externally-transparent"` (Fork E). A `trusted-timestamped` receipt that fails any of those
checks reports `verified: false`, never a silent pass.

## Cross-repo follow-up (operator-owed, not executed in this kickoff)

Caisson's own deployment (once anchoring is armed against caisson.sh's production TSA target) needs a
row in gridwork-core `identity/security-surfaces.md` for the TSA egress sink, per that repo's
"any new external sink lands a row in the same commit" invariant. That file lives outside this repo's
tree — this kickoff cannot and does not edit it. Flagging here so the operator (or the session that
arms the scheduler in production) adds the row when the sink goes live.
