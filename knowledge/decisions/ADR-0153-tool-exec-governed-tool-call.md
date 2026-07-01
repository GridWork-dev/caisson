# ADR-0153 — `@caisson/tool-exec`: governed tool-call / sandboxed-exec primitive for Agentic-Dev

Status: accepted · 2026-07-01 (Stage-2 Stream B, operator fork-lock — B4) · new commercial
Agentic-Dev substrate under the ADR-0133 §1 harvest intent · builds under ADR-0150. Append-only;
supersede with a later ADR, never edit.

## Context

Stream B's B4 fork asked whether to build a net-new AI-edition primitive now or defer. The SPEC rec was
defer (under-specified, no locked ADR). The operator locked **build it now**. The capability — a
governed tool-call / sandboxed-shell-execution allowlist with argument provenance — has **no current
owner** in Caisson's package set and converges three harvest signals: the gridwork-core clean-lift
"audited exec endpoint" (a governed-tool-call primitive for `agent-kernel`), lift-sweep **rank #10**
(gridwork sandboxed-shell-execution allowlist with argument provenance), and **rank #4** (telesis
governed-agent-kernel's tool layer). Rebuild-clean: pattern only, no ported code (ADR-0133).

## Decision

New package `@caisson/tool-exec` — commercial Agentic-Dev substrate (`kind: "primitive"`, `editions:
["agent-dev"]`, `tier: "paid"`, `LicenseRef-Caisson-Commercial`, placeholder `priceCents` pending
ADR-0129 methodology). Surface:

1. **Allowlist-gated command registry** (data-only): each entry declares a command name + its permitted
   argument shape (a Zod-`.strict()` schema). A call names a registered command + args; anything
   unregistered is refused (`@caisson/kernel` typed error) — default-deny.
2. **`execFile` arg-arrays only** — the security floor is absolute: **never** `execSync`/a shell string;
   `node:child_process.execFile(cmd, argsArray)`. No user/agent value ever reaches a shell. Args are
   validated against the command's schema _before_ exec.
3. **Argument provenance** — every governed call returns a structured record: command, resolved args,
   exit code, captured stdout/stderr (bounded), and the caller/reason tag — the audit trail a governed
   agent run needs. Provenance is plain structured data (not WORM).
4. **Injected config** — the allowlist + any working-dir/timeout bounds are injected at the boundary,
   never module constants. A dormant/empty allowlist refuses everything (fail-closed).

## Why

- **No current owner** — `agent-kernel` is the agent-_run_ kernel; a sandboxed-exec allowlist with
  argument provenance is a distinct governed-tool-call primitive, not a feature of the run loop, so it
  earns its own package rather than hardening an existing tree (which would be Stream C).
- **Security floor is the whole point** — `execFile` arg-arrays + default-deny allowlist + schema-
  validated args is the exact pattern `identity/security.md` mandates; the primitive productizes it.
- **Three converging harvest signals** ranked it high across independent scouts.

## Rejected

- **Defer B4 (SPEC rec)** — the operator locked build-now.
- **Harden `agent-kernel` in place instead of a new package** — rejected; that is Stream C's tree and
  would conflate the run loop with the tool-call gate; the primitive is independently sellable.
- **`execSync`/shell string with escaping** — rejected absolutely; command injection surface. `execFile`
  arg-arrays only.

## Relations

New Agentic-Dev substrate under ADR-0133 §1 (harvest → sellable AI-edition packages). Composes ADR-0002
/`identity/security.md` (execFile arg-arrays, typed errors, Zod-`.strict()`). Adjacent to `agent-kernel`
(ADR-0065/0066) — a dependency-free sibling, not a fork. Builds under ADR-0150.

## Binding

`@caisson/tool-exec` ships a default-deny allowlist-gated governed tool-call primitive — `execFile`
arg-arrays only, schema-validated args, structured argument provenance, injected fail-closed config —
as commercial Agentic-Dev substrate. Relaxing the execFile-only rule or the default-deny posture
requires a superseding ADR.

Evidence: `docs/state/stage2-stream-b-spec.md` §B4 + Fork 4; `docs/state/harvest-program.md` Source-C
ranks #4/#10 + clean-lift exec-endpoint; `identity/security.md` shell-execution floor; the 2026-07-01
operator fork-lock.
