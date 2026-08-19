# Archived: the `design-critic` findings ledger

`design-critic-findings-2026-08-18.toml` is the complete, byte-verbatim ledger of
`tooling/design-critic` as it stood when the package was retired (ADR-0411). SHA-256
`89e1b8582d0ea47d4d5359c0ed449d24f68dd13682ce1669173506a6e7ce5777`, 5,835 lines, 729 findings.

**Every one of those 729 findings is `status = "fixed"`.** Nothing open, nothing accepted. The
ADR-0375 visual-remediation closeout and the 2026-07-22 live re-audit resolved the last of them, so
this archive is history, not a work queue — that is what made retiring the tool safe.

## Why the IDs cannot be recomputed

The ledger's stable IDs come from a three-field hash:

```
id = sha256(workflow ∷ surface ∷ normalized-title)[:16]
```

`@caisson/audit-harness`, which now owns visual findings under the `D8` dimension, hashes four
fields instead:

```
id = sha256(domain ∷ dimension ∷ subject ∷ normalized-title)[:16]
```

Same algorithm, same separator, same title normalizer — but a different arity. There is no
assignment of `domain`/`dimension`/`subject` that reproduces a three-field digest, so **no ID in
this file can be re-derived inside audit-harness's ID space.** That is why the fold ADR-0407
imagined was not taken: re-keying would have silently rewritten the identity of 729 resolved
findings. They stay here, under their original IDs, with the formula that produced them.

## Where visual findings go now

Future visual/Nielsen findings are recorded by `@caisson/audit-harness` under dimension **D8**,
against the `apps/*` domains — `apps/site`, `apps/admin`, and `apps/demos`. Of this ledger's 126
distinct `surface` roots, the route-backed ones (marketplace, glossary, dashboard, legal, docs,
compare, and the eighteen `admin__*` roots) all live under `apps/site` or `apps/admin`; the rest are
audit pseudo-surfaces that were never routes at all (`cross-surface`, the `motion__*`,
`interaction__*`, and `popout__*` families, `preview__emails`) or roots whose route has since been
renamed (`changelog` is now `/updates`). D8 is keyed on the domain rather than on the surface class
precisely so `apps/admin`, which audit-harness classifies `internal-only`, still gets the lens. The
screen name this ledger stored in `surface` becomes audit-harness's `subject`.

Read this file directly for historical context; nothing in the live tree parses it.
