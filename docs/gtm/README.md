# docs/gtm — the business-side source of truth

**Status:** charter seeded 2026-07-05; FULL distillation lands with the SOT-expansion build
(`outputs/specs/sot-expansion/SPEC.md` §3 — one file per area, built as parallel workflows).

This area owns the distilled BUSINESS truth for caisson: positioning, pricing/packaging rationale,
market/competitor intel, channels + launch sequencing, tools + COGS (the real monthly stack bill),
legal/MoR posture, and the ranked gap ledger. Every claim cites its ADR or research file.
`outputs/research/` stays the raw layer (scrapes, transcripts, one-off memos); this directory is
the curated layer an agent or the operator reads first.

Planned files (SPEC §3): `positioning.md` · `pricing-packaging.md` · `market-intel.md` ·
`channels-launch.md` · `tools-cogs.md` · `legal-entity.md` · `gaps-and-plays.md`.

Decision boundary: nothing here locks anything — pricing/packaging locks stay ADRs
(`knowledge/decisions/`), forks stay on `docs/state/decisions-and-forks.md`.
