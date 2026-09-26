# ADR-0428 — Open-source pivot: Apache-2.0 everywhere, sales stop, public repo on GridWork-dev

- Date: 2026-09-25
- Status: Accepted — operator picker, three rounds (2026-09-25)
- Tags: `external-system`, `security`, `secrets`, `infra`, `docs`, `ui`, `frontend`
- Spec: `outputs/specs/oss-pivot/SPEC.md` · Plan: `outputs/plans/oss-pivot/PLAN.md`
- Supersedes: ADR-0318 (mirror launch program); ADR-0094, ADR-0097, ADR-0136 (open-core split
  and license-keyed gating); ADR-0110 (license issuer); ADR-0223 (self-hosted registry
  delivery); the mirror half of ADR-0222 (the `@caisson-sh` npm scope stays); ADR-0114 and
  ADR-0115 (Railway hosting and platform DB); ADR-0082, ADR-0237, ADR-0303 and ADR-0107 (site
  go-live posture and commerce gates); ADR-0257, ADR-0258 and ADR-0403 (bundle catalog and
  prices); ADR-0326 and ADR-0365 (Blacksmith runners); ADR-0343's mirror-repo host (the shadcn
  source registry moves to the main repo)

## Context

Paddle never left sandbox and no buyer exists. The machinery to sell — the license issuer, the
entitlement-gated registry Worker, `services/license`, `apps/admin`, the Paddle cart and
dashboard, and a fleet of six hosted services — costs more to keep alive than the product
earns. The operator chose to open-source the whole repository with minimal ongoing
maintenance.

## Decisions

1. **L1 — model.** Every package ships Apache-2.0. Sales stop: no checkout, license tokens,
   entitlement gating, pricing, EULA or refund policy. The ten sale-only packages and the
   commerce services are deleted; the remaining 48 packages are relicensed.
2. **L2 — history.** The real history is rewritten with `git-filter-repo` and this same
   repository is flipped public. Accepted residual, stated to the operator before the lock:
   GitHub keeps every pull request's original commits under read-only `refs/pull/*` (490 today),
   so pre-rewrite diffs, PR bodies and review threads stay reachable. The rewrite buys a clean
   clone, file browser and blame; it hides nothing. Every credential that ever appeared in any
   commit is therefore revoked before the flip, and no secret's safety depends on the rewrite.
3. **L3 — hosting.** The only running surface is a static caisson.sh on Cloudflare Workers
   static assets. Railway, Cloud Run, the registry Worker, R2, Neon, AWS WORM/KMS, the Discord
   bot, docs-RAG, support-bot and intel all retire.
4. **L4 — launch.** Go public quietly for about a week, then one coordinated launch day
   (Show HN anchor plus X, staggered subreddits and newsletters).
5. **L5 — ownership.** `caisson-sh/caisson` transfers to the `GridWork-dev` user account
   (operator instruction). The empty `caisson-sh` org is kept so the redirect and the name hold.
6. **L6 — npm scope.** Packages rename in-repo from `@caisson/*` to `@caisson-sh/*`; the bare
   `caisson` npm org belongs to an unrelated party. The mirror exporter is deleted.
7. **L7 — docs.** The ADRs stay public, scrubbed of local paths, hostnames and personal data.
   Every other internal planning surface is stripped from the tree and all history: the fork
   board and `docs/state/`, `docs/{business,gtm,ops,archive,deploy}`, `docs/build-state.md`,
   `outputs/`, harness config, and the two committed production-signed license tokens.
8. **L8 — copyright.** Caisson Software LLC stays the named copyright holder in every LICENSE and
   the root NOTICE.
9. **L9 — community.** GitHub Discussions only; the Discord server closes.
10. **L10 — site direction (operator, same day).** Keep the current design. Remove Compare,
    Stack fit, Plans, Glossary, sign-in, the dashboard portal and the cart. Marketplace becomes a
    demonstration gallery: modules and demos, no prices and no buying. The Evidence pack stays
    under Resources. All copy is reframed for the open-source model.
11. **L11 — demos stay.** `apps/demos` powers the marketplace demonstrations and is converted to
    a static export served by the same Worker under `/demos`.
12. **L12 — teardown pre-approved.** Every W4 deletion and revocation batch is authorized up
    front. Cloudflare operations run through the CLI/API rather than the dashboard.
13. **L13 — private archive now.** A private `GridWork-dev/caisson-archive` receives every
    branch, tag and PR head before any deletion lands, and again at flip day.

## Consequences

- Execution follows the PLAN's wave order: de-commercialize → OSS baseline → site → teardown and
  revocation → archive, transfer, rewrite, flip, first publish → soak → launch day.
- The operator-private process (fork board, `bun run sot`, the "never auto-decide a fork" rule)
  leaves the public tree; new ADRs keep landing here, append-only, numbered from 0429.
- No forks remain open; L10 and L11 closed the site phase without design options.
