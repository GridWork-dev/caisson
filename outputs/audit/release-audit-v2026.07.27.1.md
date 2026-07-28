# Release audit — v2026.07.27.1 (the OSCAL carve, the KMS key-lifecycle wave, and the re-cut tag)

- **Scope:** the cumulative diff since the last **shipped** release tag, `v2026.07.20.3..HEAD` —
  995 files, ~87k insertions. `v2026.07.27` is deliberately not the base: it was tagged, its train
  failed at readiness R3, and it published no bytes, so nothing in it has ever been audited or
  shipped. This cut carries the `@caisson/oscal-spine` carve and $249 SKU debut, the Compliance
  ($1,649) and Everything ($2,259) reprice, the T8/T8b field-crypto key-lifecycle wave, the Inngest
  v4 / Azure Key Vault / Azure Blob adapters, the `/writing` surface, and the version PR (#359)
  that bumped every package.
- **Tree:** `main` at `87a6cb69`. The two audit lanes ran against `254fd2f5`; the three commits
  since are the pre-tag remediation this audit produced (see §4).
- **Lanes:** security audit on the money/licensing/entitlement/crypto/auth seams (fable), code
  review on correctness and release integrity across the rest (opus), each grounded in files at
  HEAD with `snip proxy git` for every diff read. Both were told the append-only byte gate forbids
  pre-tag source changes inside version-recorded packages, and to classify every finding
  block-vs-disclose rather than propose patches.

## 1. Verdicts as returned

| Lane               | Verdict                   | Substance                                                                                                             |
| ------------------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Security (fable)   | **PASS-WITH-DISCLOSURES** | No live exploit, over-grant, or money defect. Five findings, all latent or ordering-class, all fail-safe in direction |
| Code review (opus) | **FAIL — block the tag**  | Five blockers, every one of them **outside** every packed tree, so all five were fixable before the tag               |

The two verdicts are not in tension. The security lane audited the packed packages, where the byte
gate makes pre-tag fixes impossible and disclosure is the only available disposition. The code-review
lane found its blockers in `apps/site` (`private: true`), `docs/**`, `tooling/scripts/`, and
`.github/` — none of which appear in a single row of `registry/tarballs.json`. Confirmed before
touching anything: `grep -c` over the sidecar for `apps/site`, `docs/`, and `tooling/scripts` returns
0, and `apps/site/package.json` carries `"private": true`.

## 2. Code review — opus lane (five blockers, all CONFIRMED, all FIXED pre-tag)

Each was independently reproduced before being acted on; none was taken on report alone.

**B1 / P0 — `bun run sot` red, and it is a blocking readiness check.** `scripts/release-readiness.ts:241-254`
runs it as check 4 and records a failure on throw; `release-train.yml` makes `propagate` depend on
the readiness job. Reproduced: eight docs drifted on `frontmatter-freshness` because a parent bump to
`docs/deploy/STATE.md` did not carry its dependents. This is the same class that failed the
`v2026.07.27` train — a tag whose readiness fails publishes nothing while the release reads
"published" and buyers 404. **Fixed** in `87a6cb69` (ten docs bumped across two cascade levels; the
tracker's stale content trued rather than merely date-stamped, since bumping `updated:` asserts a doc
is current with its grounds).

**B2 / P0 — the binding refund terms stated the opposite of the code.** `app/legal/terms/page.tsx:251`
said an approved refund "returns any unused credits it granted". `packages/credits/src/credits.ts:30-33`
writes a `refund_clawback` compensating debit that **removes** them, and the sibling
`/legal/refunds` page said "removes" — the canonical page was the one disagreeing with both. Fourteen
lines below "returned to your original payment method", it reads as _you keep them_. **Fixed** in
`65745ccc`, in the terms page and in `content/docs/refunds.mdx`, which names terms as canonical.

**B3 / P0 — the Developer plan advertised a monthly credit allotment beside an annual price.**
`plans/page.tsx:98` and `:60` and `lib/module-pages.ts:1471` said "monthly". The live Paddle row
(`packages/pricebook/src/plans.ts:114-120`) is `cadence: "year"` at `creditsPerCycle: 1000`; the only
`cadence: "month"` row is a placeholder `resolvePlan` never sees. A buyer beside the $499/yr button
read 12,000 credits a year and would receive 1,000 — a 12× overstatement on a checkout surface.
**Fixed** in `65745ccc` at all three sites.

**B4 / P0 — the ADR-0022 dependency-graph gate had been silently disarmed.** `ci.yml:86` moved the
cruise into `tooling/scripts/dependency-graph-guard.ts`, which passes `--output-type json`.
Verified in `node_modules`: `dependency-cruiser/src/report/json.mjs:11` hardcodes `exitCode: 0`,
while the default `error.mjs:200` returns `summary.error`. The guard's 177 lines contained no
reference to `summary`, `violations`, or `error` — confirmed by grep returning nothing. So a
violation of the base↔edition direction, the open↔commercial boundary, or a cycle would print in
JSON, exit 0, and go green. **Fixed** in `ab8a98e1`: enforce `summary.error` from the payload already
parsed (no second cruise), failing **closed** when `summary` is missing or malformed, because
unmeasured must never read as zero — that is exactly how the gate went quiet. Three new tests cover
violation, clean, and unmeasured. **The tagged tree is clean**: a live run reports 2,389 modules and
**0 error-severity violations**, so nothing slipped through while the gate was off. Shipping this
cut with the boundary gate disarmed would have been the wrong moment regardless, since this is the
cut that adds `@caisson/frameworks-pack → @caisson/oscal-spine`.

**B5 / P1 — a $149 commercial SKU documented as part of the free base.**
`content/docs/cli/create-caisson.mdx:19-20` listed `credits` as always wired in. It is absent from
`lib/base-substrate.ts`, whose own header calls naming it free-Apache "a real misrepresentation".
The same sentence claimed a first prompt picks an edition from four retired labels; the wizard's
first question is what to generate, and a bundle comes from the flag-only `--edition`. **Fixed** in
`65745ccc` with the true substrate list and the real prompt order.

## 3. Security audit — fable lane (disclosed, carried to the post-tag PR)

All five sit inside version-recorded packages. The byte gate forbids changing packed source before
this tag, so each is disclosed here and carried — not dismissed.

**F1 / P2 — a closure target that is neither indexed nor reserved throws away the buyer's entire
entitlement set.** `packages/registry-schema/src/entitlements.ts:230`. Independently reproduced: the
throw is real, and `RESERVED_MODULE_ENTITLEMENT_IDS` is now empty (`:102-108`), so the fallback its
own doc comment promises at `:147-150` — "the parent continues resolving to itself" — no longer
exists. Direction is fail-**safe**: the Worker degrades to the Apache base floor, an under-grant
outage for paying buyers, never a leak. Inert at this tree because the committed index carries
`oscal-spine@0.1.0`. Post-tag: make the unknown-target edge fail soft per-edge, or assert index↔edge
parity at deploy time. The stale doc comment should move in the same change.

**F2 / P2 — `charged_amount` is never adjusted after a partial refund.** Independently reproduced:
the column is written once at grant time (`services/license/src/entitlement-store.ts:264`, stamped
under the one-SKU attribution triple at `apply-billing-event.ts:395-398`) and no refund or adjustment
path updates it. `resolveUpgradeCredit` then floors an upgrade credit at the original charge. Needs
three stacked events plus a later price cut to bite, and over-credits only the refunded slice. Zero
exposure today: Paddle SANDBOX, pre-launch, no price cuts recorded.

**F3 / P2 — the internal proof bearer is a static, non-expiring per-account credential.**
`apps/admin/src/lib/internal-proof-auth.ts:60-75` — `HMAC-SHA256(secret, accountId)`, no
timestamp or nonce, valid until the secret rotates. Compare is `timingSafeEqual` with a length
pre-check, the host is pinned to `.railway.internal`, and the route re-authenticates independently of
the proxy, so exploitation needs a leaked token **and** private-network reach. Consider an
HMAC-with-timestamp window when the seam is next touched.

**F4 / INFO — non-USD upgrade credit degrades to retail** rather than inventing an FX rate
(`packages/pricebook/src/upgrades.ts`). Self-disclosed in-code; never credits above retail. No action
before an FX policy ADR.

**F5 / INFO — the internal-proof rate limiter consumes the account token even when the global bucket
denies.** Fairness cosmetic, no security effect.

### What the security lane actively verified clean

The T8/T8b surface was the headline risk and it holds. Every one of the five defect classes the four
prior review rounds introduced-and-caught was verified fixed at HEAD: the contradictory WORM receipt
state is now structurally unconstructible (`kms-port.ts:14-47`, `?: never`); the abort listener
subscribes **before** the operation is invoked, so a synchronous in-argument abort cannot win the
race with live key material; the post-abort path returns `await race`, which both reports the
cancellation rather than the provider throw and subscribes to the rejection that was process-fatal on
the GCP driver; the RLS preflight runs `NULLIF(current_setting(...), '')` on both tables with
transaction-local `set_config`; and a late-resolving provider value is wiped by `wipeLateResult`
across all three driver shapes. `withKey()` lends a per-operation copy wiped in `finally`, refuses
async callbacks at compile time with a runtime backstop, refuses results computed across disposal,
fails closed on an all-zero key, and reaches in-flight lends on `dispose()`. 7/7 and 29/29 on the
respective suites.

Entitlements were proven in **both** directions by direct execution against the committed index:
over-grant none (free floor exactly 17 Apache modules, no commercial leak), under-grant none
(Compliance expands to 15 including the spine; a pre-carve buyer correctly snapshot-filters to 12,
dropping the 2026-07-20 trio while **keeping** `oscal-spine` through the ADR-0384 compat edge — the
ADR's guarantee, not a bug). The Worker's own source is unchanged since the last tag apart from
`deploy.sh` and two fixtures, and `deploy.sh` now builds `license-verify` + `pricebook` from source
before bundling, closing the stale-dist hazard.

Money integrity is consistent across all five layers — `PRICE_AUTHORITY`, manifests, pricebook,
index, site — with zero mismatches in either direction, integer cents throughout, and the one
division rounding **up** toward the buyer. audit-worm writes create-only on all three clouds, reads
version-pinned with post-read identity assertion, and the new `worm_artifact_version` ledger is
append-only under FORCE RLS; anchor signatures are account-bound v2, closing cross-tenant
substitution; the per-event export allowlist fails closed to `{}` on unknown discriminators.

### What the code-review lane verified clean

The version-PR ripple in `52376dee` is internally consistent, verified by execution rather than
inspection: all seven generator template pins exist in the index and equal both `latest` and the
workspace version; across all 64 `packages/*` every workspace version equals its index `latest`; the
reservation graduation is complete with `checkReservedIdsStaleness` promoted `warn`→`error`. Suite
results at HEAD: registry-schema 88/88, registry worker + scripts 290/290, cli + kernel + ds-manifest

- jobs 341/341, site lib 528/528, standards-gate 81 packages / 0 errors / 0 warnings, and the
  `@caisson/ui` manifest regen a byte-identical rebuild. Across 183 changed non-test source files:
  zero `console.log`, zero `any`, zero `@ts-ignore`. The EU AI Act Article 50 dates are internally
  consistent across all 26 assertions, each matching its cited source locator verbatim.

## 4. Disposition

**Fixed before the tag (all outside packed bytes, byte gate untouched):** B1 in `87a6cb69`, B2/B3/B5
in `65745ccc`, B4 in `ab8a98e1`. The site suite is 528/528 after the copy fixes and the repaired
dependency gate passes 7/7 plus a clean live cruise.

**Carried to the post-tag PR:** security F1-F5, plus the code-review lane's disclosed set — the
`/legal/license` overclaim on two Apache-2.0 packages (`analytics`, `ds-manifest`), bundle docs that
omit granted modules ($925 of catalog missing from the Everything page and 7-of-14 on Compliance),
"the two Agentic-Dev SKUs sold standalone" where five are, the `regulatory-claim-watch` degenerate
`watch.texts` false-green and its wrapper's success-path artifact overwrite, `checkCatalogParity`
having swapped the published index for workspace manifests as its parity source, the one-directional
`checkPricebookPriceAgreement`, the `inngest: "^4"` floor against siblings that pin minors, the
NaN-fail-open shape in `ds-manifest/src/contrast.ts:139,154`, the unpinned-migration gap in
`compliance/src/migrate/assemble.ts`, and the retired-edition vocabulary still in `lib/glossary.ts`.

**Routed, not copy-edited:** `content/docs/compliance/index.mdx:58-77` ships explicit future framing
("has not been published to a package registry yet") on a live page, which ADR-0237 rider 2 forbids,
while ADR-0385 requires the docs not imply `verify-pack` is installable. That is an ADR conflict, not
a wording problem — it goes to `gw-architect`.

**One correction to the changelog entry this session added:** the v0.5 body says "Background jobs move
to Inngest v4". `packages/jobs` still ships the Trigger.dev, pg-boss, BullMQ, and in-memory drivers
alongside the new Inngest one. A Trigger.dev buyer would read a removal. Carried to the post-tag PR
with the rest of the copy set.

## 5. Proceed decision

**PROCEED to tag** `v2026.07.27.1` as an attestation-only successor. The buyer install path is
verified clean in both grant directions, the money surface agrees across all five layers, the key
lifecycle holds under adversarial reading, every blocker is fixed, and every remaining finding is
latent, fail-safe in direction, and carried with a named home.
