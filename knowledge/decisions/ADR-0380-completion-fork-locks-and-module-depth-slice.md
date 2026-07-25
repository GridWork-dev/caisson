# ADR-0380 — Completion-program fork locks and the module-depth design slice

- **Status:** LOCKED (operator, 2026-07-25)
- **Extends:** ADR-0379 (amends lock 10), ADR-0237, ADR-0290, ADR-0308, ADR-0328, ADR-0344,
  ADR-0373, ADR-0378
- **SPEC:** `outputs/specs/full-state-completion/SPEC.md` ·
  `outputs/specs/module-depth-pages/SPEC.md`
- **PLAN:** `outputs/plans/full-state-completion/LANE-A-PLAN.md` ·
  `outputs/plans/module-depth-pages/PLAN.md`

## Context

ADR-0379 locked the full-state completion program and executed its unblocked half (T0–T3, T5D)
locally. It deliberately left six fork-board rows open, and four product slices plus two provider
adapters stopped at those rows. The operator resolved all six at the 2026-07-25 picker (two
rounds), then a third design-grill round settled the module-depth slice.

Investigation that grounds these locks:

- `EvidencePack` already is a logical file map (`files[] {name, contents}` + `sha256` over the
  name-sorted concatenation) — `packages/kernel/src/evidence/pack.ts`.
- `apps/site` is one Next app carrying marketing, docs, and the buyer dashboard; it holds `pg` but
  no WORM object-store credential.
- `KmsClient.scheduleKeyDeletion` returns `Promise<void>` on every adapter, yet AWS
  `ScheduleKeyDeletion` is cancellable for 7–30 days and Azure soft-delete is recoverable for
  7–90 — the port already reported destruction it could not prove.
- `S3ArtifactStore.put` uses `IfNoneMatch: "*"` and never reads a `VersionId`; `ArtifactMeta` is
  key-only.
- All 23 existing depth-page records carry a bespoke glyph; the three 2026-07-20 catalog debuts
  fall back to the generic `boxes` mark. Their pokes, schematics, and media-manifest entries
  already ship; the packages are headless.

## Locks

1. **Admin proof export (T5B).** Export the shipped `EvidencePack` verbatim as a logical file map
   with its content digest — no archive transport. The redaction affordance counts **distinct
   redacted key paths**, not masked occurrences. Row statuses are computed server-side for the
   rendered window; each row's proof is fetched lazily on expand through the existing
   `GET /api/admin/audit/proof` seam.
2. **Tenant proof topology (T5C).** The site route derives `accountId` from the session and calls
   an **authenticated internal proof proxy** that owns the WORM credential and reuses the proven
   admin proof-assembly code. No object-store credential enters the internet-facing app, and the
   proxy never trusts a client-supplied account id.
3. **Buyer crosswalk source (T5E).** Read the **persisted latest evidence-pack pointer** over the
   same internal path chosen in lock 2. `maps-to` and `implements` remain separately labeled edge
   kinds and are never summed into a single coverage figure.
4. **KMS deletion receipt (T6B).** **Widen the port.** `scheduleKeyDeletion` returns a receipt
   carrying the destruction state rather than `void`, so a pending-but-cancellable deletion can
   never be reported as irreversible. This applies to every adapter — it closes the existing AWS
   and GCP overclaim in the same change — and the `erasure.crypto-shred` audit payload records the
   proven state. Satisfies ADR-0379 lock 8 by construction.
5. **WORM version identity (T6C).** **Persist version identity.** `ArtifactMeta` gains an optional
   version identifier that backends supporting versioned immutability populate, and reads plus
   retention extensions target the recorded version. Create-only upload remains the write-once
   primitive; the version id is what makes "this exact immutable object" provable afterwards.
6. **Module-depth design slice (T5A / CAISSON-134).** The three compliance-gap SKUs —
   `access-review` ($199), `risk-register` ($279), `trust-page` ($149) — get full depth pages:
   three **new bespoke glyphs** in the brand icon registry, **live component slides** built on each
   package's existing poke, and records authored by `gw-frontend-designer` with a
   `gw-persona-walkthrough` critique before ship. Depth-record parity becomes 26/26.
7. **ADR-0379 lock 10 is amended.** The buyer-facing copy freeze is narrowed to **existing** copy.
   New copy for the three new depth pages is authorized. Displayed prices, the Cloudflare gating
   posture, cart/checkout behavior, and every other clause of lock 10 stand unchanged.
8. **Execution shape.** Two isolated worktrees run in parallel — lane A (code residuals plus the
   adapter wave) and lane B (the design slice) — each in a visible herdr pane on codex
   `gpt-5.6-sol` at `ultra` reasoning with two parallel sub-lanes. One PR per worktree, push not
   merge, per ADR-0328. T4 fleet reconciliation and migration 0030 stay held behind their operator
   gates; `substrate.field-crypto-policy` stays open and unimplemented per ADR-0379.

## Consequences

- The KMS port change is a breaking contract widening across four adapters, `crypto-shred`, and the
  erasure audit payload; it is a correctness fix, not an Azure accommodation, and needs a golden
  re-bless plus a changeset for every affected package.
- `ArtifactMeta` widening touches all five artifact-store backends and the row==object invariant
  callers; backends without versioning leave the field absent rather than fabricating one.
- The internal proof proxy is a new authenticated service seam that both the tenant proof route and
  the buyer crosswalk depend on — lane A builds it once and both slices consume it.
- Three new brand glyphs trip the generated design-manifest drift guard from `b037b878`; lane B
  regenerates the manifest in the same PR.
- Two concurrent branches trigger the ADR-0328 reconcile requirement before either merges.

## Alternatives rejected

- **Archive transport for the proof export** — would move the content digest to the archive layer
  for no auditor gain.
- **Read-only WORM credentials in the site app** — puts audit-store credentials in the
  internet-facing process for one hop's convenience.
- **Purge-required Azure vault with the port unchanged** — would have satisfied ADR-0379 lock 8 for
  Azure alone while leaving the AWS and GCP overclaim in place.
- **Create-only exclusive-writer invariant alone** — matches shipped S3 behavior but leaves the
  port unable to prove which version it later read or extended.
- **Deriving depth-page copy from locked artifacts, or sequencing the slice after this program** —
  both were rejected in favor of a real design slice running now.
