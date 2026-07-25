# Release audit — v2026.07.20.3 (consume 2 of the two-consume SKU arming)

- **Scope:** the human-authored source of this cut — PR #316 (`1c5c137c`: the three
  compliance-gap SKUs flip sellable at $199/$279/$149, join the Compliance and
  Everything bundle member maps at pin 0.2.0, Compliance bundle reprices
  104900 → 144900 cents, PRICE_AUTHORITY + fixtures + five changesets) plus the
  signing-primitive repack changeset (`3b9237bb`). The consume machine output
  (PR #317 → main `8b728f95`) is verified by the version gate, the local publish-mode
  byte-gate proof (exit 0), and index spot-checks; both auditors additionally
  live-traced it for entitlement semantics.
- **Tree:** main `8b728f95` (PR #317 squash). Main CI 19/19 green including the five
  required checks.

## Security audit (entitlement/licensing/money seam) — fable lane

Verdict as returned: **FAIL-OPEN** — the entitlement code itself is clean; the
failures are completeness against the ADR-0373 "PR B" declaration (see disposition).

Confirmed clean, live-traced against the committed index and worker at `8b728f95`:

- **Over-grant: none for non-purchasers.** Exactly two bundles gained the three SKUs
  (compliance@0.6.0 members=13, everything@0.3.0 members=34; jq over all 53 entries).
  The Apache free floor excludes them (license-keyed predicate; all three are
  LicenseRef-Caisson-Commercial with empty editions at both versions). Worker
  `resolveGate` fail-safe, indistinguishable 404s, and the shared npm-surface gate
  all unchanged — `git diff 5b37fb0e..8b728f95 -- registry/worker/
packages/registry-schema/src/` contains zero source change.
- **Under-grant: none.** Both bundles' expansions are strict supersets of the prior
  leaf sets (verified by direct execution against the committed index); all prior
  members retained.
- **Price integrity:** integer cents everywhere; manifests = PRICE_AUTHORITY = index
  (19900/27900/14900; compliance 144900); no float math introduced.
- **Fail-closed intact:** unknown slug throws; RESERVED set empty with the fail-soft
  branch unchanged; no secret-comparison surface touched.
- **Member pins published:** 0.2.0 rows for all three (and signing-primitive 0.3.7)
  present in tarballs.json + ledger + index versions; 0.2.0 bytes R2-verified by the
  post-.2 parity probe.
- **Completeness guard:** RIDER3_UNPUBLISHED stayed two-sided; the three graduating
  names auto-expired when the index granted membership; agent-usage + artifact-render
  remain correctly excepted. Worker suite 142/142 at this tree.

## Code review — opus lane

Verdict as returned: **FAIL** — same root cause as the security audit's completeness
findings: the commerce half of the reprice is not in this cut. Everything sanity-listed
in the briefing (manifests, PRICE_AUTHORITY, fixtures, member pins, consume output,
repack changeset, ~70% price-band math, ADR-cite pins) verified internally consistent;
no stale 4900/sellable:false in the three manifests.

## Findings and disposition

The release proceeds with the findings below **disclosed and dispositioned**, not
dismissed. The disposition rests on two facts: (1) registry-schema packs its `src/`
tree (no `files` allowlist) and 0.5.7 is already published, and the three SKUs' 0.3.0
rows are already recorded — so ANY of these source fixes changes packed bytes at a
recorded version and is therefore _forbidden before the tag_ by the append-only
byte-gate; (2) the catalog-debut PR that follows this tag in the same sitting is the
designed carrier for every one of them (the operator-locked B1/C split).

- **F1 / P1 — stale bundle leaf-set test pins (the one genuinely new finding).**
  `packages/registry-schema/src/entitlement-expansion.test.ts` pins the
  compliance/everything post-delist leaf sets; consume 2 grew both bundles, so a
  fresh `bun test packages/registry-schema/` fails 1/81 at main HEAD while CI shows
  green — turbo replays the cached pass because `registry/index.json` lives outside
  the package's cache inputs. Independently reproduced by the orchestrator before
  disposition. NOT a behavioral regression (live expansion is the intended strict
  superset). Heals in the catalog-debut PR via the pin re-capture + a registry-schema
  patch changeset (0.5.8). The cache-blindness class (a package test reading
  repo-root state outside its turbo inputs) is queued as a follow-up gate item.
- **F2–F5 / P1 — commerce surfaces stale (the planned PR-C half):** pricebook
  `BUNDLE_RETAIL.compliance` still 1049 and site display still $1,049 (upgrade quotes
  to Compliance under-charge $400); `SKU_RETAIL` + purchase-book rows absent for the
  three (zero upgrade credit / no à-la-carte mint path); `COMPLIANCE_GAP` membership-
  timeline join instants absent (snapshot-at-sale fail-soft keeps the three for
  pre-join bundle buyers). All of this is the banked catalog-debut patch set, held
  behind the tag by the same byte-gate/gate-parity ordering that held PR #316 behind
  the .2 tag. Window risk is nil in practice: pre-launch, Paddle SANDBOX, zero real
  buyers, heal lands the same sitting.
- **P2 — stale access-review README posture line** ("reserved, sold-unpublished…"):
  README is inside the packed tree at the recorded 0.3.0 row — fix rides the
  catalog-debut PR with access-review's own patch changeset.
- **INFO — structural gap:** no gate bridges manifest `priceCents` ↔ pricebook
  `BUNDLE_RETAIL`/`SKU_RETAIL` ↔ site display; the two stale surfaces agreed with
  each other so CI stayed green. A manifest↔pricebook parity check is queued with
  the catalog-debut PR.

## Verdict

**PROCEED with disclosed residuals.** No blocker against tagging `v2026.07.20.3` at
the attestation commit on `8b728f95`: the buyer install path (registry, worker,
tarball bytes, entitlement gates) is verified clean and fail-closed; every finding is
either the designed-and-banked catalog-debut half (F2–F5, P2) or a test-pin staleness
with no behavioral effect (F1), and all of them are physically unfixable before the
tag under the append-only byte-gate. The catalog-debut PR is the required next act of
this sitting and carries: leaf-set pin re-capture + registry-schema 0.5.8 changeset,
pricebook SKU_RETAIL/BUNDLE_RETAIL/COMPLIANCE_GAP rows, site prices + catalog rows,
Paddle sandbox wiring, the README posture fix, the RIDER3_UNPUBLISHED prune, the
deploy.sh build-surface fix, and a manifest↔pricebook parity gate.
