# ADR-0241 — Changeset internal-prose SOURCE GATE (no silent formatter)

**Status:** accepted · 2026-07-03 (deploy-closeout session, operator picker). Resolves the
changeset-formatter fork parked in the audit-v2 P2 prose-tooling spec: internal-prose leakage into
buyer-facing CHANGELOGs is prevented **at the source** — a standards-gate check fails any PR whose
`.changeset/*.md` body carries internal artifacts — not by a consume-time formatter that silently
rewrites text. Extends the ADR-0233 advisory-audit posture (the gate is a hard PR check, the audit
stays advisory). Append-only; supersede with a later ADR, never edit. **Tags:** none.

## Decision

1. **Source gate** (built in the wave-6b set, `tooling/standards-gate`): every `.changeset/*.md`
   body (frontmatter exempt; empty changesets pass) is scanned for internal-prose classes — ADR
   citations (`ADR-\d{4}`), wave/row jargon, internal doc paths (`docs/state/`, `outputs/`,
   `knowledge/`), and session/agent slugs. A hit fails the gate with file+line; the author fixes
   the prose in the PR. No text is ever rewritten silently.
2. **The formatter option was rejected:** a consume-time rewriter ships unreviewed prose — a
   mangled sentence lands in a buyer CHANGELOG with nobody having read it. The "both" option was
   rejected as double machinery for one failure mode.
3. **The 22 changesets pending at lock time were hand-swept** (2026-07-03, PR #104) before the
   first live consume, so the gate starts from a clean corpus.

## Consequences

- Changeset text is written buyer-facing from the start; CHANGELOG quality is a PR-review concern,
  not a pipeline transform.
- The P2 prose-tooling spec's "changeset-formatter choice" fork is closed; its execution drops the
  formatter task and keeps (or extends) this gate.
