# Shipped-source quality rubric

**Parent:** ADR-0080 (precise-scope copy laws — "claim nothing we do not ship"). ADR-0080 governs
_marketing copy_; this rubric extends the same honesty-and-professionalism bar to **shipped source
code** — the comments, READMEs, `package.json` metadata, and error strings a **buyer reads** when
they open a Caisson package. Standalone by operator override (ADR-0233 Fork E): ADR-0080 stays
prose-only; this file is the source-code companion. If the two ever disagree, ADR-0080 wins on
marketing copy and this file wins on in-source text — keep them reconciled.

**Scope — where these rules apply.** Any domain whose surface class is `oss-source`, `sold-source`,
or `buyer-runtime` (per `tooling/audit-harness/src/domains.ts`). Internal-only surfaces (`tooling/`,
`infra/`, `apps/admin`, the registry service, `audit-harness` itself, `docs/`, `.github/`) are
**exempt** — gridwork-isms, ADR shorthand, and operator names are fine there.

**How it is used.** The audit-harness v2 D3 (customer-facing quality) and D4 (internal-vs-sold leak)
finders cite these rule ids. A finding reads e.g. `SS-3: session/ADR shorthand a buyer cannot
resolve — "per ADR-0182" in packages/ai-kit/src/gateway.ts:44`. Advisory (ADR-0134): a hit is a
triage item, never a merge gate.

---

## Rules (citable ids)

### Comments — no internal shorthand a buyer cannot resolve

- **SS-1 — no gridwork-isms.** No `gridwork`, `gw-*`, `~/.gridwork`, `GridWork Digital`, operator
  names, box/host names (`gw-ms-a2`), or references to sibling private repos (`media-pipeline`,
  `Wardfile`, `tessera`, `prospector`). A buyer has none of that context.
- **SS-2 — no session / kickoff / wave shorthand.** No "this session", "the wave-6 build", "the
  2026-07-02 deploy", "the picker round", "the operator locked". Describe what the code does, not the
  internal process that produced it.
- **SS-3 — no bare ADR / spec / fork references as the _only_ explanation.** A buyer cannot open
  `knowledge/decisions/`. "per ADR-0182" alone is a leak (also SS-8). If a decision must be cited,
  state the rule in plain terms first, then the id may follow in parentheses as provenance: "BYOK
  inference is billed at zero credits (ADR-0182)" is acceptable; "see ADR-0182" alone is not.
- **SS-4 — no internal issue-tracker refs.** No `CAISSON-17`, Linear ids, or PR numbers (`PR #45`)
  in shipped source.
- **SS-5 — why, not what, and professional.** A comment explains _why_ (the non-obvious constraint,
  the edge case, the ordering dependency), not a restatement of the line below it. No jokes,
  no `// HACK`, no `// obviously`, no blame ("whoever wrote this"), no first-person session voice
  ("I'm not sure why this works").

### Residue — nothing half-finished ships

- **SS-6 — no TODO / FIXME / XXX / HACK markers** in `oss-source` or `sold-source` files. An unfinished
  marker in code a buyer paid for reads as unfinished product. Track the work in Linear, not the
  shipped file. (`buyer-runtime` app code is held to the same bar for anything a buyer can view-source.)
- **SS-7 — no commented-out code blocks** left in shipped source. Delete it; git remembers.
- **SS-8 — no internal paths or infra endpoints in comments or strings.** No `apps/admin`,
  `tooling/`, `infra/`, Railway grey-origin URLs, `signoz`, internal Grafana/Tempo endpoints, or
  `registry.caisson.sh` internal ports in a sold or oss package. (This overlaps D4/D2 — cite the
  most specific.)

### README — the buyer's first read

- **SS-9 — the README describes the package as shipped, not as planned.** No "on the roadmap",
  "coming soon", or "the token contract only" for a capability that already ships (the v1
  `@caisson-sh/ui` docs lie). Truthful-to-built, per ADR-0080 and D6.
- **SS-10 — the README has a one-line purpose, an install/usage snippet, and no internal-process
  narrative.** No "rebuilt clean from GridWork repos", no "harvest program", no ADR chain as the
  opening. A buyer wants what it does and how to use it.
- **SS-11 — no dead or internal links** (links into `knowledge/`, `outputs/`, `docs/state/`, or a
  private repo) in a shipped README.

### package.json metadata — quality the registry surfaces

- **SS-12 — `description` is buyer-readable**: a plain one-line capability statement, no ADR ids, no
  "internal", no session shorthand. It is shown in the registry and on npm.
- **SS-13 — declared metadata is complete + honest**: `license` matches the tier
  (`Apache-2.0` for oss, `LicenseRef-Caisson-Commercial` for sold), and `private`/`publishConfig`
  match the distribution reality (`docs/state/public-surface.md`). (Overlaps D5 — cite D5 for the
  license-tier mechanics, SS-13 for a misleading description/metadata pairing.)

### Error messages — buyer-facing UX

- **SS-14 — error strings a buyer can hit are UX, not debug dumps.** No internal path, ADR id,
  operator name, or stack-trace-only message in an error a buyer's app throws or logs. State what
  went wrong and what to do, in plain terms.

---

## Finder guidance (D3 / D4)

- Cite the **narrowest** rule id and quote the offending text + `path:line`.
- A single line can trip several rules; report the most specific (SS-3 over SS-2 over SS-1).
- False positives are expected on judgement calls ("is this jargon?"); prefer flagging with a short
  rationale over silence — the operator triages `open → accepted`.
- Exempt surfaces (internal-only class) are out of scope — do not flag them.
