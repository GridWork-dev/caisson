# ADR-0135 — New commercial Compliance modules: `@caisson/alerting` (SOC2 CC7.2) + `retention-runner` (CCPA/GDPR erasure)

Status: accepted · 2026-06-30 (harvest grill session, lift-sweep NEW-PKG locks) · **document-only —
no code lands under this ADR** · composes ADR-0003 (composable packages) and ADR-0057 (compliance
control model) · catalog/pricing deferred to build time under ADR-0129's methodology · sequenced
inside the post-go-live harvest initiative (ADR-0133). Append-only; supersede with a later ADR,
never edit.

## Context

`caisson-lift-sweep-REPORT.md` (a 6-repo scout — telesis, gridwork, gridworkdigital, throughframe,
glossread, tm-watch — with adversarial critic correction) ranked its top-15 highest-value lifts.
Ranks **#1** and **#3** are two capabilities the report confirms have **no current owner anywhere in
Caisson's package set**:

1. A multi-channel alerting pipeline satisfying SOC2 CC7.2's "anomaly detection and timely
   notification" control — today treated as, at best, a footnote of the `observability` `EventSink`
   port (ADR-0075), not a real primitive.
2. A CCPA/GDPR right-to-erasure runner — a recurring privacy requirement with **zero** current
   caisson owner.

Both source from `gridworkdigital`'s already-shipped, production-hardened implementations (12
production event types for alerting; a clean 4-step erasure shape for retention) — rebuilt clean
(pattern only, never ported code, per the ADR-0133 rebuild-clean discipline this ADR inherits).

## Decision

Two new commercial packages join the Compliance edition's module catalog, alongside the existing
`compliance` / `field-crypto` / `audit-worm` modules:

1. **`@caisson/alerting`** — a five-stage pipeline: **dedup** (on an already-open incident) → **rate-
   cap with digest fallback** (per recipient) → **IANA-timezone quiet-hours** (with a critical-
   severity override) → **multi-channel delivery** → **structured audit log**. Driven by a
   data-only, per-event-type registry (the gridworkdigital reference spans 12 production event
   types). This is the concrete SOC2 CC7.2 control implementation no current package owns.
2. **`retention-runner`** — pluggable multi-store erasure: **object-storage purge** → **cascade DB
   delete** → **orphan-record sweep** → **reason-tagged audit row** (`auto_90d` / `ccpa_request` /
   `operator_manual`), with per-target error isolation so one failing store doesn't abort the whole
   erasure run.

## Genericness — explicitly NOT a WORM/audit-chain upgrade

Both source implementations write to **plain Postgres audit-logging tables**, not hash-chained WORM
storage. The lift-sweep report is explicit that this class of candidate ("X-as-audit-evidence") was
a recurring source of confusion across the whole survey — good audit-_logging_ discipline
consistently mistaken for tamper-evidence. Per the report's own "where caisson is already ahead"
section, Caisson's `audit-chain.ts` (canonicalize + SHA-256 chain + `verifyChain` against a trusted
anchor) and `audit-worm` (ADR-0051/0052/0054) are **already structurally ahead** of every WORM-shaped
candidate surveyed. **Neither new module changes that.** Both are `needs-decoupling` genericness —
event-registry and object-store specifics get stripped in the rebuild — not `clean-lift`.

## Why

- **A real, confirmed gap, not a nice-to-have.** Unlike most of the lift-sweep's 37 candidates (9 of
  which were downgraded on critic review, several explicitly because Caisson's existing packages are
  already ahead), these two ranked #1 and #3 specifically _because_ no existing package covers them.
- **SOC2/CCPA are named controls, not generic features.** Both map to controls a real auditor asks
  for by name (CC7.2; CCPA/GDPR Art. 17) — selling them as their own modules mirrors how
  `audit-worm` already split out of `compliance` as a named, sellable control primitive.

## Pricing

**Not priced by this ADR.** ADR-0129's price sheet covers only modules that exist as code; these two
do not yet. When built (post-go-live, per ADR-0133's sequencing), price each against a researched
comparable using ADR-0129's value-based methodology — no number is invented here.

## Rejected

- **Fold alerting into the existing `observability` `EventSink` port (ADR-0075) as a feature, not a
  new package** — rejected; `observability` is a generic telemetry _sink_ (and ADR-0075 explicitly
  keeps the WORM audit-chain strictly separate from it) while alerting is a buyer-facing
  _notification product_ with its own dedup/quiet-hours/audit semantics worth selling standalone.
- **Fold retention into `compliance` as a feature rather than a standalone package** — rejected; it
  is a recurring, independently-triggered (cron-scheduled, reason-tagged) capability general enough
  to be its own sellable primitive — the same reasoning that already split `audit-worm` out of
  `compliance`.
- **Treat gridworkdigital's audit tables as a WORM lift** — rejected explicitly (see Genericness,
  above); would be a regression against Caisson's own already-ahead audit-chain/audit-worm design.

## Relations

Composes ADR-0057 (the own-authored SOC2/HIPAA control catalog — each module maps to a named
control) and ADR-0075 (observability `EventSink` — alerting is a downstream consumer/sibling of
telemetry, not a replacement for it). Cross-references ADR-0133 (the harvest wave this rides inside)
and ADR-0134 (the audit/validate _harness_ — internal engineering tooling, not to be confused with
these two buyer-facing _product_ modules).

## Downstream

`docs/state/harvest-program.md` tracks both modules as ranked items (lift-sweep top-15 ranks #1 and
#3) inside the post-go-live harvest wave.

## Binding

`@caisson/alerting` and `retention-runner` are locked as new commercial Compliance-edition modules,
document-only until their own SPECs land post-go-live; both are audit-_logging_ primitives, not WORM
upgrades, and must not be mistaken for one; pricing is deferred to build time under ADR-0129's
methodology. Changing the module boundary (e.g. folding either into an existing package) requires a
superseding ADR.

Evidence: `caisson-lift-sweep-REPORT.md` "NEW offerings / editions" table + "Top-15 highest-value
lifts" ranks #1/#3 + "Where caisson is already AHEAD" section; `knowledge/decisions/ADR-0057`,
`ADR-0075`, `ADR-0051`, `ADR-0052`, `ADR-0054`.
