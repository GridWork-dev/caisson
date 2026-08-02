---
"@caisson/ai-evals": minor
"@caisson/site": patch
---

The eval package gains a browser-safe `./browser` entry point: the regression gate's rules with no
file access at all — the baseline boundary schema, `compareToBaseline`, the pre-bless eligibility
check, the new `mergeIntoBaseline`, and `wilsonLowerBound` — can now be imported inside a client
bundle to show or check a comparison. `gateAgainstBaseline` and `loadBaseline` stay on the main
entry, because they read and write the committed baseline file. The main entry is unchanged and
keeps the full surface; every browser-entry export is also available there. Internally the rules
moved into their own module and the file transport now delegates to them, so the bless merge has
exactly one implementation instead of two. The site's eval interactive demo now runs that real
code end to end instead of a hand-maintained copy.
