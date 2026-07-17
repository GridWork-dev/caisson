---
"@caisson/agent-kernel": minor
"@caisson/agent-dev": minor
---

Skills can now ship bundled files. A skill artifact gains three optional maps — `references` and `assets` for supporting docs and static files, and `scripts` for executable helpers — each a relative path plus its content. The multi-harness emitter writes them into every SKILL.md directory it produces.

Executable content is trust-tiered. The curated default skill set always emits its scripts; scripts on a skill set you supply yourself are held back unless you pass `allowScripts`, and any withheld scripts are reported rather than dropped silently. References and assets always emit. All three fields are optional, so skills authored before this release are unaffected.
