---
"@caisson/cli": minor
---

`create-caisson` now supports an interactive first run: run it in a terminal with no flags (or
only some of them) and it prompts for whatever is still missing — starting with a choice between
a licensed module/edition build and the free sample, then the project name, and finally which
modules to include. Any flag you already pass is never re-prompted, and piping input or running
in a non-interactive shell (CI, scripts) behaves exactly as before with no prompts at all.

Generated projects can now also request a starter deploy configuration for Railway, Fly.io, or
Vercel via `--deploy <target>` (or the matching step in interactive mode). Leaving it unset
generates the exact same files as before.
