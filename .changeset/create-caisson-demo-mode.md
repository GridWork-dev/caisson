---
"@caisson/cli": minor
---

`create-caisson --demo`: generate a runnable project against the FULL module catalog without a
license. Free (Apache-2.0) modules install for real from the Caisson registry (no license key
needed), exactly like a licensed build; every commercial module is replaced by a local,
clearly-watermarked stub under `src/demo-stubs/` so you can see the shape of the catalog and try
the scaffolding before buying. Every stub call throws a `CAISSON DEMO STUB` error naming the real
module and pointing at https://caisson.sh — it is never the licensed source and is never for
production. The generated repo also gets a `DEMO.md` listing the whole catalog (installed vs.
stubbed), a not-for-production banner on `README.md`/`AGENTS.md`, and a corrected module list so
neither file overstates what's actually installed. Reach it with `create-caisson --demo --name
<slug>`, or pick "the full catalog, commercial modules as stubs" from the interactive first-run
wizard.
