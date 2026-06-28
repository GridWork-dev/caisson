# ADR-0068 — Generator engine: templates tree, FileSetWriter, token+JSON-merge transform

Status: accepted · 2026-06-27 (Wave-1 editions session, fork lock. Builds out the generation drive
on the Wave-0 generator seam — ADR-0048/0049.)

ADR-0048 fixed the engine _shape_ (in-repo copy + typed transform, no network) and ADR-0049 fixed
the _debit_ (debit-before-spend at the generation entry); both shipped as seams, the full P5
generation drive deferred. This ADR locks how that drive materializes a repo on disk — a real
`templates/` tree, the path-safe atomic writer, and the transform mechanics — without re-opening
either prior decision.

## Decision

**A real `templates/` tree, driven by the shipped in-repo copy + typed token/JSON-merge transform,
written through the `FileSetWriter` seam — extends ADR-0048 + ADR-0049, re-asserts the shipped
FileSetWriter.**

- **`templates/` tree:** the source is an in-repo template tree (degit-pattern, **no network** —
  ADR-0048 ethos); a fixed selection produces a deterministic, golden-fixturable file set.
- **`FileSetWriter` re-asserts path safety:** every output path rejects `..`, null bytes, and
  absolute paths from untrusted input; `path.resolve()` + an allowed-root assertion (`startsWith`
  root + `path.sep`) per the security floor, layered on ADR-0048's pre-construction slug/registry
  gate. Defense-in-depth, not a replacement.
- **Non-empty-target-dir policy:** generation into a non-empty target is **refused by default**
  (no silent overwrite); proceeding requires an explicit caller opt-in (force/merge flag). Data
  loss is never the default.
- **Atomic write:** the file set is staged and committed atomically — a partial/failed write leaves
  no half-materialized tree.
- **Transform = explicit token-replace + JSON deep-merge:** a typed mustache-style token replace
  (explicit token syntax, no templating runtime) plus JSON deep-merge mechanics for `package.json`
  deps / `tsconfig` / config wiring. ts-morph may later slot a wiring pass behind the same seam.
- **Write inside the debit boundary (ADR-0049):** the disk write happens **inside** the
  `withTenant` debit transaction — `credits.debit("codegen_debit", idempotencyKey)` fires before
  any byte is written; a short balance returns **402** (`InsufficientCreditsError`) and the
  transaction rolls back with **nothing written**; a same-key retry debits once.
- **Post-generation side-effects are explicit + opt-in:** dependency install, `git init`, and the
  next-steps print are individually opt-in flags — never implicit, never run inside the debit
  transaction.

## Rejected

- **Network-fetching templates** (degit-from-remote / npm pull at generate time) — against the
  no-network ADR-0048 ethos; non-deterministic, un-golden-fixturable, an egress + supply-chain
  surface. The template tree is in-repo.
- **Writing files before the debit clears** — violates ADR-0049 debit-before-spend; a
  failed/looping generation that already wrote files never gets billed. The write stays inside the
  transaction, after the debit.
- **Silent overwrite of a non-empty target dir** — data-loss risk; refused by default, opt-in only.

## Binding

The generation drive writes a deterministic file set from the in-repo `templates/` tree through a
`FileSetWriter` that rejects traversal/null-byte/absolute paths (`path.resolve` + allowed-root
assertion), refuses a non-empty target by default, and writes atomically; the transform is explicit
token-replace + JSON deep-merge with no network; the disk write lives **inside** the `withTenant`
debit transaction so a 402 aborts with nothing written and a same-key retry debits once; install /
git-init / next-steps are explicit opt-in side-effects outside that transaction. Generated modules
ship under the commercial EULA (ADR-0023; the former local-ai AGPL flank is now commercial per
ADR-0050). TypeScript-strict, Bun, Zod-`.strict()` at the CLI/MCP boundary. Evidence: ADR-0048
(generator engine seam) · ADR-0049 (codegen debit point, `meterGeneration`) · ADR-0021 (registry
traversal gate) · the security floor (path-safety rules) · `outputs/research/wave1-forks.md`.
