# ADR-0048 — Generator engine: in-repo template copy + typed transform

Status: accepted · 2026-06-27 (Wave-0 shared-substrate session, Fork 5. How `create-caisson`
materializes a repo, under ADR-0004/0021.)

`create-caisson` composes a buyer's selection (edition + module ids + versions) into a repo. The
engine choice trades determinism, dependency weight, and the golden-fixture story.

## Decision

A **deterministic in-repo template copy + a typed token/JSON-merge transform** (degit-pattern, no
network), behind a **generator seam**.

- Composition = "select packages → assemble a workspace that installs them from the registry + write
  config/wiring" = **file assembly + dependency-list construction**, not deep TS refactoring.
- **Deterministic → golden-fixture-able:** the generated file _set_ for a fixed selection is the
  fixture (ADR-0021 §golden). No heavy compiler dependency.
- The template is **in-repo**, so a plain recursive copy + a typed mustache-style token replace +
  a JSON deep-merge (package.json deps, tsconfig) beats even degit's fetch.
- **Allowlist-first:** every caller-supplied id+version is validated against the registry
  (`assertKnownModule`/`assertKnownVersion`) and the slug regex re-asserted **before any path
  construction or subprocess** (ADR-0021 traversal gate).

## Rejected

- **ts-morph AST codemod as the engine** — ts-morph shines at _rewriting existing_ TS (imports,
  call graphs); generation here mostly writes whole files + merges JSON. Kept as an optional later
  wiring pass **behind the same generator seam**.
- **A templating language (EJS/Handlebars/Plop)** — adds a templating runtime + its own injection
  surface; a curated in-repo template + a tiny token replace covers v1.

## Binding

The generator is a deterministic in-repo copy + typed token/JSON-merge transform behind a generator
seam; no network during generation; the generated file set is golden-fixtured; every id+version is
allowlist-validated and the slug re-asserted before any path/subprocess. ts-morph may later slot in
behind the same seam for a wiring pass. (Wave 0 ships the seam + the gate + the debit; the full P5
generation drive is out of scope.) Evidence: degit (Rich-Harris/degit, MIT); ts-morph docs
("transforms… not a typical scenario"); mastra `clone-template`.
