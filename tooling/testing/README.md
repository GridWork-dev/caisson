# @caisson-sh/testing

Shared test harness + the golden-file regression harness (runs before any compliance logic).

## Two-track ownership

- **Foundations (ADR-0013)** owns the **runner** (Bun's built-in test vs Vitest), the golden
  **bless** procedure, and the unit↔integration boundary. _Not redefined here._
- **D9 (this track)** owns the **module golden-fixture contract** — `golden-module.ts`: what a
  _module's_ golden fixture is (`defineModuleGolden`), so the publish gate (ADR-0021/0022) has a
  typed thing to run.

## A module's golden fixture

The serialized, **deterministic** output a module produces for a fixed input (a generated file
set, an evidence-pack manifest, a composed config). Committed under the module's `golden` dir
(the manifest's `golden` field). The harness runs each case + diffs against the committed
golden; `bun run gate` blocks publish on a diff until re-blessed. Determinism (no clocks /
randomness / env) is the author's contract.
