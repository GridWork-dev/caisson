# SWEEP — Wave 1 · P2: Compliance edition (downstream impact)

Act 5. What else the P2 diff touches: new surfaces, unblocked work, stale docs, queued follow-ups.
(Authored as VERIFY-debt closure — P2 merged green via PR#11; this records the impact retroactively.)

## New surfaces (note for future audits)

- **`@caisson/audit-worm` is a new paid `primitive`** (WORM `ArtifactStore` + append-only audit-chain
  DB + locked-version DB) — `compliance` and any later edition needing tamper-evidence consume it
  down-only (`dependencies:["@caisson/kernel","@caisson/tenancy-rls"]`). Its `0001`/`0002` migrations
  ship ENABLE+FORCE RLS with a **withheld** UPDATE/DELETE grant (chain) + a REVOKE **and** belt trigger (versions).
- **`@caisson/compliance` is the first edition** (`kind:"edition"`, `editions:["compliance"]`) — proves
  the ADR-0003 composition direction in anger: `compliance → {audit-worm, field-crypto, tenancy-rls,
kernel}`, **no `@caisson/credits`** (evidence FREE in v1, ADR-0007 unit deferred to P6).
- **`field-crypto` grew P2 surface** — `store.pg.ts` (DB-backed key/DEK stores), `encrypt-field.ts`
  (row-bound 4-tuple AAD), `crypto-shred.ts`. It **stays kernel-only**: the RLS join lives in the
  edition's `withTenantCrypto`, never inside field-crypto (down-only invariant held).
- **`apps/compliance`** (Next.js App Router) — the `ui`-tagged exit artifact. A thin wiring shell
  (`/api/leg` runs the leg on a throwaway PGlite + temp WORM dir per request); no dashboard, no persistence.
- **External-egress seams declared but NOT live** — S3 Object-Lock, AWS KMS, RFC-3161 TSA, OSCAL
  transport. When any is wired (P7), it becomes a real egress sink and **must land a row in
  `identity/security-surfaces.md`** at that time (same discipline Wave-0 flagged for live KMS).

## Docs reconciled / to reconcile

- New ADRs `ADR-0051..0058` (WORM retention · chain persistence · version schema · ArtifactStore ·
  field-crypto P2 · pack signing · control model · pack format) — locked, on the board. ✅
- `docs/state/decisions-and-forks.md` carries the P2 ADR rows + the `@caisson/migrate` base-pkg
  deviation note (ADR-0070, commit `ebfe382`). ✅
- **Stale:** `SUMMARY.md` / `plan.md` were destaled to post-wave-1 reality (`44463dc`), but per the
  git-hygiene memo **only substrate + cli are truly built; editions are structure-plus-P2-hero** —
  confirm the build-state doc reflects that P2 is the one edition with a real end-to-end leg.

## Queued follow-ups (non-blocking, by design)

1. **Wire the live WORM transport** — supply a real `S3Client` to `S3ArtifactStore` behind config;
   exercise COMPLIANCE-mode against a real Object-Lock bucket in a deploy smoke (never CI). TM-A guard
   already refuses it outside `NODE_ENV=production`.
2. **Wire live KMS + RFC-3161** — `awsKmsClient` for crypto-shred key deletion; a real TSA POST over
   `fetchWithTimeout` for the timestamp countersign. Both are ports today (`LocalKmsClient` / `StubTimestampAuthority`).
3. **Wire the OSCAL export seam (T15)** — `toOscalBundle` is deterministic + seam-tested; add a live
   `OscalExportTransport` (validate each body against the official OSCAL JSON schema before send) and a call site. `// P7:`.
4. **Author EU-AI-Act controls** — replace the reserved `eu-ai-act.ts` slot with a `defineFramework`
   pack + catalog golden (Annex IV outline already scoped).
5. **Thin-test depth** — the leg pins ONE framework (SOC2-TSC, 3 controls) + ONE blocked path. Add a
   HIPAA-driven leg and a multi-flagged / mixed-readiness pack to widen golden coverage before GA.
6. **`priceCents` placeholders** — audit-worm `4900`, compliance `99900` are anchors pending the open
   Pricing lock (ADR-0012); finalize before checkout goes live (operator-owned).
7. **Buyer-facing dashboard** — P2 shipped only the wiring shell (P2-19a); a real buyer evidence UI is a fast-follow.

## No regressions

CI green on main (PR#11/#12) · down-only depcruise 0-violation · all P2 goldens matched BLESS unset ·
no service restarted (DEPLOY remains a separate operator-gated act). Known integration-only CI gotchas
(PGlite `beforeAll` timeout under turbo fan-out → `--concurrency=50%`; dist-glob `bun test`) are
mitigated upstream, not P2-specific.
