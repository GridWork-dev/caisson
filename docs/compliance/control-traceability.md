# Control-to-code traceability (idiom)

A SOC 2 / HIPAA auditor asks for **traceability**: policy control → the code that implements it →
evidence that the implementation is the one the policy was written against. Caisson answers this
with a two-rule **convention**, not a framework — no registry, no build step, no runtime surface.
(ADR-0229 row 9; policy model ADR-0057.)

## Rule 1 — control-bearing code cites its ADR

Every function, module, or exported definition that **implements or encodes a compliance control**
carries one line in its docstring:

```
Control: ADR-NNNN — <policy name>
```

- `ADR-NNNN` is the append-only decision that locked the control/policy (the git-native SOT — see
  `knowledge/decisions/`).
- `<policy name>` is the human control/pack name.
- One line. It makes `grep -rn "Control: ADR-" packages/*/src` the auditor's control → code index —
  no separate spreadsheet to drift.

**Exemplar:** the `soc2Tsc` pack export in
`packages/frameworks-pack/src/frameworks/soc2-tsc.ts` carries `Control: ADR-0057 — SOC 2 Trust Services
Criteria coverage pack` (moved from `packages/compliance/` by the W1 carve extraction, `ADR-0257` §1).

## Rule 2 — control-logic goldens pin their policy revision

Golden fixtures that capture **control logic output** carry a `policyVersion` field naming the ADR /
policy revision the golden was captured under. A drifted golden then shows not just _that_ output
changed but _which policy revision_ the last-blessed evidence belongs to — the code → evidence leg.

- `policyVersion` is the `ADR-NNNN` (or catalog version) the fixture was blessed against.
- It lives on the fixture, never inside a `.strict()`-parsed control/framework object (those reject
  unknown keys by design) — the traceability record is a sibling of the control data, produced by
  the golden test.

**Exemplar:** `packages/frameworks-pack/src/__golden__/control-traceability.json` (moved from
`packages/compliance/` by the W1 carve extraction, `ADR-0257` §1) pins the SOC 2 catalog to
`ADR-0057` / catalog `2024.1`; it is (re)generated with `BLESS=1 bun test` like every other golden.

## Why this and not a framework

The auditor wants a durable, greppable trail, not another system to certify. Two conventions over
the code that already exists cost one docstring line and one fixture field, cannot rot into a stale
side-table, and ride the golden-regression gate that already guards compliance logic.
