# ADR-0088 — Resolve the 0045–0048 ADR-number collision: renumber the GTM set → 0084–0087

**Status:** accepted · 2026-06-28 (git-hygiene + doc-sweep session — operator picked "renumber the
GTM set" from a 4-option fork). **Relates:** ADR-0006 (append-only/immutable artifacts — the rule
this decision knowingly exempts), ADR-0084–0087 (the renumbered GTM ADRs). Evidence: the duplicate
filenames physically present in `knowledge/decisions/` after the Wave-0 and GTM tracks merged to
`main` (PR #11), each independently allocating 0045–0048.

## Context

Two parallel build tracks each allocated ADR numbers **0045–0048** against the same `main`,
producing **eight** files sharing four numbers:

| Number | Wave-0 substrate (KEEPS the number) | GTM site (RENUMBERED)                |
| ------ | ----------------------------------- | ------------------------------------ |
| 0045   | `field-crypto-aead-cipher`          | `gtm-site-stack` → **0084**          |
| 0046   | `ciphertext-envelope-format`        | `waitlist-capture-seam` → **0085**   |
| 0047   | `registry-readpath-worker-seam`     | `web-analytics-plausible` → **0086** |
| 0048   | `generator-engine`                  | `hero-sku-surface` → **0087**        |

The Wave-0 set is referenced heavily across the locked board and downstream compliance/ai-kit ADRs
("Wave-0 Fork 1–5", the `AeadCipher`/`kms.ts`/generator seams), so it keeps 0045–0048. The GTM set
moves to the next free block **0084–0087** (0078–0083 were the design/go-live block; Wave-1 reserved
through 0077).

## Decision

1. `git mv` the four GTM ADRs to `ADR-0084..0087-<slug>.md`; titles updated; a **provenance note**
   added to each renamed file pointing back to its original number and forward to this ADR.
2. **No redirect stub** at the old filename — a stub named `ADR-0045-gtm-site-stack.md` would
   reintroduce the `0045` filename collision this ADR exists to clear. Traceability is preserved by
   the per-file provenance notes, this ADR's mapping table, and `docs/adr-index.md`.
3. All **live** inbound references updated to the new numbers (the renamed files' cross-refs;
   ADR-0079/0080/0081/0082; `specs/03`, `specs/04`; `CLAUDE.md`; `infra/terraform/README.md`; the
   GTM-session kickoff's file-path pointers). Disambiguation was by **meaning**, not number — e.g.
   a bare "ADR-0048" meaning the generator engine stayed 0048, while "ADR-0048" meaning the hero-SKU
   surface became 0087.
4. **Frozen research artifacts** under `outputs/research/design-session/` (and other pre-2026-06-28
   session notes) are **left unedited** — they record what was true at authoring time per the
   read-only-history doctrine. Numeric "ADR-0045/0046/0048" references in those notes resolve through
   the mapping table above. Only dead **file-path** links (renamed slugs) are repaired anywhere.

## Why this over the alternatives

- **Leave + disambiguating index only** — non-destructive, but the duplicate filenames persist; any
  `ls`/glob/tooling that keys on the number stays broken. The operator chose a real fix.
- **Reconciliation ADR with no renumber** — same residual collision.
- **Renumber the Wave-0 set instead** — far more inbound references (compliance/ai-kit lineage), a
  larger and riskier edit surface. Renumbering the GTM set is the smaller blast radius.

ADR-0006's append-only/immutable rule is **knowingly exempted here, once, by operator decision**, for
the narrow purpose of clearing an objectively-broken number collision (two ADRs cannot share one
number). This ADR is the append-only record of that exemption.

## Binding

The GTM ADRs are 0084–0087; the Wave-0 substrate ADRs keep 0045–0048; `docs/adr-index.md` carries the
canonical old→new mapping. Future ADR numbers continue from **0089**. Any further renumber requires a
superseding decision.
