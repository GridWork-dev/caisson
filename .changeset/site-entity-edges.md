---
"@caisson/site": patch
---

The root Organization now carries two entity-association edges to the GridWork Digital hub: a
shared `founder` Person and `subjectOf` pointing at the hub's Caisson case study, each by `@id`
only. No subsidiary predicate is published in either direction — the two companies are separate
LLCs with common ownership at the individual level — and a test over the serialized graph keeps
`parentOrganization` / `subOrganization` from ever appearing. Both target IRIs are pinned verbatim.
