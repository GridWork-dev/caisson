---
"@caisson/tenancy-rls": minor
"@caisson/kernel": minor
"@caisson/admin": patch
"@caisson/site": patch
"@caisson/billing-orchestration": patch
"@caisson/cli": patch
"@caisson/compliance": patch
"@caisson/jobs": patch
"@caisson/registry-schema": patch
"@caisson/trust-page": patch
"@caisson/service-betterstack-adapter": patch
"@caisson/service-intel": patch
"@caisson/service-license": patch
"@caisson/eslint-config": patch
"@caisson/standards-gate": patch
"@caisson/testing": patch
---

Consolidation wave one: the eighteen refutation-verified cuts from the August consolidation audit.

New public API: `@caisson/kernel` gains the narrow `./crypto` subpath (node:crypto-only graph,
so a Cloudflare Worker can import the timing-safe compare without the wide `./node` barrel's
`node:dns` reach), and `@caisson/tenancy-rls` exports `createPgTransactor(pool)` — the canonical
node-postgres BEGIN/COMMIT/best-effort-ROLLBACK/release adapter previously copy-pasted across the
site, admin, the license deploy entry, the CLI, and the generated Next starter (which also gains
the best-effort rollback it lacked). Everything else is deletion or internal consolidation with
behavior pinned by tests: dead marketplace/build residue and dead nav derivation out of the site,
the unused account-entitlement resolver and 111 unreachable barrel exports out of the license
service, the orphan EU AI Act manifest out of compliance (it was being packed while unreachable),
an unused trust-page devDependency, shared task-registry lookup across the five jobs drivers,
shared exact byte-identical parser readers in billing-orchestration, the kernel browser-graph
walker folded onto the shared testing module-graph, the intel OpenRouter transport shared between
enrichment and its eval judge, license scheduler test fixtures consolidated, the dependency graph
guard moved into standards-gate ownership (its test now runs in the package suite), the Better
Stack adapter's unauthenticated dev bypass deleted and its secret compare folded onto the kernel
primitive, and one boundary-policy data source feeding ESLint, dependency-cruiser, and the
standards gate — closing a drifted cruiser hand-copy that had silently stopped guarding the five
current bundle roots.
