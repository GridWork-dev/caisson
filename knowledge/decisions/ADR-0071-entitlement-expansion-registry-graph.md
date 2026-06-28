# ADR-0071 — Entitlement expansion: registry-derived edition/bundle → member-module graph

Status: accepted · 2026-06-27 (Wave-1 editions session, fork lock. Joins commerce ADR-0012 to the
ADR-0008 allowlist gate — fixes the membership DATA MODEL, not the enforcement timing.)

Commerce sells the library three ways at once (ADR-0012): whole **editions**, one **bundle**, and
**per-module à-la-carte**. But the buyer-facing MCP/CLI gate (ADR-0008) checks a flat `string[]` of
bare module slugs (`mcp-server/src/server.ts` `registryAllowlist`) — it has no notion of an edition
or a bundle. An edition or bundle purchase must therefore be _expanded_ into its member-module slug
set before the gate can answer, and the question is where that membership truth lives.

## Decision

- A **resolver** reads the **registry index** — each manifest already declares its `editions[]`
  membership (`module-manifest.ts`) — and expands a purchased edition (or the bundle) into the set
  of member-module slugs the entitlement covers, which is what the flat allowlist gate consumes.
- **The registry index is the single source of truth for membership.** An edition's members = every
  manifest whose `editions[]` contains that edition; the bundle's members = the union over all
  editions plus the base (ADR-0012's "base + all editions"). Membership is _derived_ from the index,
  never hand-listed and never stored in commerce.
- The entitlement token (ADR-0010) carries **what was bought** (edition / bundle / module ids), not
  the expanded leaf set; the resolver turns purchased ids into module slugs at gate time against the
  current index, so adding a module to an edition reaches existing entitled buyers with no re-issue.
- This **joins** the ADR-0012 commerce axis to the ADR-0008 allowlist gate; it does not supersede
  either. The gate still validates against the registry-derived allowlist (ADR-0021/0047) — this ADR
  only defines how an edition/bundle entitlement _becomes_ a slug set the gate can check.
- **Scope:** this fixes the expansion **data model** only. _When_ to enforce — entitlement check vs
  allowlist check, and the timing between them — is the separate P5 question, out of scope here.
- Membership is now a pure **commerce/packaging** axis, decoupled from license: licensing went
  uniform-commercial across every package and edition (ADR-0023 + ADR-0050), so the resolver never
  reasons about license tier when expanding an edition.

## Rejected

- **License issuer bakes the full member-slug list into the entitlement token at purchase.** Moves
  the expansion authority into commerce: the token snapshots membership at sale time, so any later
  manifest change (a module added to an edition) silently drifts the token from the registry, and two
  systems now own the same truth. Membership must derive from the index, not from a frozen token.
- **Resolve membership from manifests live on every gate call.** Correct source, wrong granularity —
  it re-reads/parses manifest shape on each authorization, paying a per-call cost and coupling the
  hot gate path to the manifest schema. The resolver reads the built **index** (the already-derived
  allowlist projection), not raw manifests, on each call.

## Binding

Edition and bundle membership is **derived from the registry index** and nowhere else: a resolver
expands a purchased edition/bundle id into its member-module slug set by reading `editions[]`
membership from the index, and the ADR-0008/0021 allowlist gate checks that derived set. No
entitlement token, license issuer, commerce record, or hand-maintained list may carry an
expanded member-slug set as an independent source of truth — a future module added to an edition
must reach entitled buyers through the index alone, with no token re-issue. This ADR governs the
expansion data model; entitlement-vs-allowlist enforcement timing is deferred to P5. Evidence:
ADR-0012 (editions + bundle + à-la-carte commerce), ADR-0008 (entitlement-gated buyer MCP, flat
slug allowlist), ADR-0010 (entitlement + Ed25519 offline license), ADR-0021/0047 (the index _is_
the allowlist), ADR-0023 + ADR-0050 (uniform fully-commercial licensing — membership decoupled from
license); seams `registry/schema/module-manifest.ts` (`editions[]`),
`registry/schema/registry-index.ts` (`moduleAllowlist`), `packages/mcp-server/src/server.ts`
(`registryAllowlist: string[]`); research artifact `outputs/research/wave1-forks.md`.
