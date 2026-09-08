# ADR-0421 — Internal GridWork use of any `@caisson/*` package is granted; distribution is not

- **Date:** 2026-09-05
- **Status:** Accepted (operator ruling in the gridwork-core estate governance round, **Round 2 #13** — label verbatim below)
- **Scope:** every `@caisson/*` workspace package, Apache-2.0 and commercial alike, consumed **inside GridWork** (`gridwork-core` first, any GridWork repo after). The five packages the audit lane actually named are listed by name below.
- **Evidence:** `docs/state/package-catalog.md` (all coordinates re-derived 2026-09-05 against `69b3ba35`) · `tooling/standards-gate/src/publish-config.test.ts` + `.github/workflows/{publish,release-train}.yml` (the distribution split, measured 2026-09-05) · gridwork-core `outputs/specs/house-standards/SPEC.md` §D3 and `outputs/specs/house-standards/MATRIX.md` finding 10
- **Tracks:** CORE-155 (gridwork-core) — the audit lane's operator question, now answered rather than open

## Context

A gridwork-core audit lane asked whether GridWork may use caisson's own packages internally, and
carried the answer as an **open operator question**. It is not open — the operator answered it. This
ADR is the write-down, filed in caisson because caisson owns the packages.

The question as asked bundled two things that have different answers, and the lane never separated
them:

1. **Licence** — may GridWork use a package it sells? Ruling 13 settles this.
2. **Distribution** — by what mechanism does the code reach a consuming repo? Ruling 13 says nothing
   about it, and the honest answer today is "no mechanism has delivered one yet" — which is not the
   same sentence for every package, as the split below shows.

Read the two halves separately or this ADR reads as authorizing an import it does not authorize.

## Decision

### Ruling — Round 2 #13, verbatim

> "Caisson packages: ANY caisson package (commercial included) may be used internally in core or any
> repo if it is good; record the internal-use grant in a caisson ADR."

1. Internal GridWork use of any `@caisson/*` package is **granted**, commercial packages included.
   "If it is good" is an engineering judgement left to the consuming repo, not a second approval
   gate.
2. Internal use **does not pass through the Paddle catalog**. No licence key, no entitlement check,
   no ledger row, no price. A commercial package used internally is not a sale and must never be
   recorded as one.
3. The grant is **internal-only**. It does not extend to anything shipped to a third party — a
   client deliverable, the OSS mirror, a published `@gridwork/*` package, or any artifact that
   leaves GridWork. Anything crossing that line is a distribution decision under the commercial
   terms and is out of scope here.
4. Nothing about any package's `license` field, catalog membership, or sale posture changes.
   `tooling/standards-gate` still enforces the 16-package Apache set and still blocks
   open→commercial (`docs/state/package-catalog.md:135`).

### The subjects, by name

The grant is estate-wide, but the audit lane named five packages, and a later reader will grep for a
**package name**, not for "the internal-use grant". So they are named here:

| Package         | Catalog coordinate                 | Licence                         | Sale posture                             |
| --------------- | ---------------------------------- | ------------------------------- | ---------------------------------------- |
| `ai-evals`      | `docs/state/package-catalog.md:81` | `LicenseRef-Caisson-Commercial` | $199 à-la-carte, AI-Production           |
| `alerting`      | `docs/state/package-catalog.md:83` | `LicenseRef-Caisson-Commercial` | $149 à-la-carte, Compliance              |
| `audit-worm`    | `docs/state/package-catalog.md:84` | `LicenseRef-Caisson-Commercial` | $149 à-la-carte, Compliance + Provenance |
| `observability` | `docs/state/package-catalog.md:51` | `Apache-2.0`                    | Open Base, not sold                      |
| `rate-limit`    | `docs/state/package-catalog.md:52` | `Apache-2.0`                    | Open Base, not sold                      |

All five coordinates and all five `license` fields were re-derived from disk on 2026-09-05; the
catalog rows and the package manifests agree.

### Distribution is BLOCKED, and this is the written answer

Ruling 13 does **not** answer how a `@caisson/*` package reaches gridwork-core. Recorded here so the
next reader does not have to re-derive it:

- gridwork-core `MATRIX.md` finding 10 rules **GitHub Packages out estate-wide** — the npm scope
  must equal the repository owner, `bun install` against `npm.pkg.github.com` is broken upstream
  (oven-sh/bun #26039, #31347, #20219, #30190), and GPR accepts classic PATs only. caisson compounds
  it: this repo lives under the `caisson-sh` owner, gridwork-core under `GridWork-dev`, so
  cross-account consumption needs that broad classic PAT in Actions secrets.
- **The manifests do not all point there, and the split is why the five subjects are blocked for two
  different reasons.** Measured across all 58 `packages/*/package.json` on 2026-09-05: **38**
  commercial ones point `publishConfig.registry` at `https://npm.pkg.github.com`
  (`access: restricted`); **16** — exactly the Apache-2.0 set, `observability` and `rate-limit`
  among them — point at `https://registry.npmjs.org/` (`access: public`); **4** (`brand`,
  `license-issue`, `platform-migrations`, `verify-pack`) carry no `publishConfig` at all. The split
  is deliberate, driven off each package's `manifest.ts` `tier` field and pinned by
  `tooling/standards-gate/src/publish-config.test.ts:15-16` (ADR-0111).
- **Neither half delivers to gridwork-core today, but not for the same reason.** For the commercial
  38 the GPR value is not even the live buyer route any more — delivery moved to the self-hosted
  `registry.caisson.sh` over R2 (ADR-0223, `.github/workflows/publish.yml` header), which serves
  buyers and not gridwork-core. For the Apache 16 the channel is real and permissive, but nothing
  has reached it: the public npm publish is release-train **leg 3** → `caisson-sh/caisson-oss`
  (`npm publish --access public --provenance`), gated
  `if: vars.RELEASE_NPM_MIRROR_ARMED == 'true'` (`.github/workflows/release-train.yml:134`) on a
  variable that is absent from all 14 of the repo's Actions variables (read 2026-09-05), so every
  train ride so far has skipped it. Those two packages are publishable, not published.
- gridwork-core `SPEC.md` §D3 makes the interim route **vendor-by-copy**: the file is copied
  verbatim with a header naming its canonical path, and a CI drift test holds the copy equal.
- **That route is proven only on single-file configs**, and it does not stretch to a package.
  `@caisson/audit-worm` is **66 tracked files** — 18 non-test modules in `src/`, plus `src/ui/`,
  `src/migrations/`, fixtures and golden files — with three workspace-internal runtime dependencies
  (`@caisson/jobs`, `@caisson/kernel`, `@caisson/tenancy-rls`) and five external ones
  (`@aws-sdk/client-s3`, `@azure/storage-blob`, `asn1js`, `pkijs`, `zod`). Copying it means copying its
  dependency closure, and D3's one-file-one-header-one-drift-test shape has no multi-file form.

**Verdict: blocked — the three commercial subjects pending a multi-file D3 route, the two
Apache-2.0 ones pending an operator act.** Not "D3 copy covers it" in either case. The licence half
is settled for all five packages; the distribution half splits:

- `ai-evals`, `alerting`, `audit-worm` — **blocked on engineering.** No channel reaches
  gridwork-core at all, and D3's one-file-one-header-one-drift-test shape has no package-granular
  form. Whoever builds that route unblocks them; nothing else does.
- `observability`, `rate-limit` — **blocked on an operator flip, not on a missing mechanism.** The
  channel exists and is permissive. Arming `RELEASE_NPM_MIRROR_ARMED` and riding a release train
  puts them on npmjs.org, after which gridwork-core installs them like any other public dependency
  and no copy route is needed.

Recording the two separately is the point of this paragraph: a reader who takes "blocked" as one
fact will go and build the multi-file D3 route to unblock `observability`, which does not need it.

### The gridwork-core dogfood is scoped here, NOT authorized

The audit found that gridwork-core writes security-critical authority decisions to flat, append-only
JSONL with no tamper-evidence. The surviving writers, re-derived 2026-09-05 against gridwork-core
`estate/s1-governance` at `bfedb985`:

- `claude/hooks/hooks.py` — `_policy_receipt` (`:2616`) appends to
  `~/.gridwork/state/authority-receipts.jsonl` (`:2636`).
- `tools/ci/ship-receipt.ts` — appends to `~/.gridwork/state/ship-receipts.jsonl` (`:122`, write at
  `:217`).
- `tools/lib/dispatch-admission.ts` — appends to `~/.gridwork/state/dispatch-admission-receipts.jsonl`
  (`:71`, write at `:405`). **The audit's census did not carry this one**; it is the same shape and
  the same exposure.

Two corrections to that census, both measured rather than reasoned:

- `apps/coordinator/lib/authority.ts` no longer exists — deleted by the estate coordinator purge
  (`50686036`). A finding written against it is un-actionable, not outstanding.
- `tools/lib/authority-policy.ts` is **not** a writer. It is the typed loader/renderer for
  `identity/authority-policy.toml` (`loadAuthorityPolicy` / `renderPolicyFloor` /
  `canonicalizeFloor`); it holds no `appendFileSync` and names no `.jsonl` sink. Listing it as a
  ledger writer overstates the surface by one file.

`packages/audit-worm/src/` holds `anchor-signer.ts`, `anchor-rekor.ts`, `anchor-ots.ts`,
`anchor-checkpoint.ts`, `anchor-transparency.ts` and `chain-store.ts` — structurally what an
authority-decision ledger wants: a SHA-256 append-only chain with a trusted WORM anchor.

**This ADR does not authorize that integration; it scopes it.** No `@caisson/*` import lands in
gridwork-core until the distribution question above is answered. The grant removes the licensing
objection and nothing else.

## Consequences

- The audit lane's operator question is **closed**. A future reader who finds it listed as open is
  reading a stale artifact; this ADR is the answer.
- The five named packages are greppable from this file, which is the point of naming them — the
  grant is discoverable by its subjects, not only by its concept.
- The gridwork-core ledger hardening stays blocked on distribution, not on permission. Whoever
  builds the multi-file D3 route unblocks it; nothing else does.
- Nothing here changes caisson's own build, licence gates, registry index, or catalog. It is a
  written grant plus a written blocker.
