# Caisson — internal docs

These are contributor-facing design and architecture notes for the Caisson monorepo, not
product documentation — the user-facing docs live at https://caisson.sh/docs. Each file
below is a synthesized map over the canonical specs and ADRs; on any conflict the ADR or
spec wins, and this file should be corrected to match.

## For X -> see Y

| For...                                                                   | See                                     |
| ------------------------------------------------------------------------ | --------------------------------------- |
| System architecture: packages, apps, provider ports, gate stack          | `docs/architecture.md`                  |
| What each package is and its dependency direction                        | `docs/packages.md`                      |
| Coding invariants, the standards gate, CI, testing, commit conventions   | `docs/engineering.md`                   |
| The security model: RLS, field-crypto, WORM audit chain, the error model | `docs/security-model.md`                |
| External anchoring (audit-worm) trust grades and verification            | `docs/security/external-anchoring.md`   |
| The visual/brand design system                                           | `docs/design.md`                        |
| Product design intent, users, brand personality, accessibility floor     | `docs/product.md`                       |
| Quality bar for comments/READMEs/errors in shipped source (SS-1..SS-14)  | `docs/shipped-source-quality-rubric.md` |
| Caisson vocabulary (one definition per term)                             | `docs/glossary.md`                      |
| Historical per-release checklists                                        | `docs/releases/`                        |
| Every locked architectural decision (ADRs, append-only)                  | `knowledge/decisions/`                  |

Canonical sources outside `docs/`: `specs/` (the locked concept specs — WHAT + WHY) and
`knowledge/decisions/` (the ADRs themselves). `docs/` synthesizes and indexes them; it
never supersedes them.
