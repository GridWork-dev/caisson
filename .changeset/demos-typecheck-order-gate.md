---
---

Order the private demos app's typecheck after its build so Next build cleanup cannot
remove generated route types while typegen writes them. This CI task dependency and
its regression test require no package release; the empty changeset satisfies the
standards-gate changeset-presence rule.
