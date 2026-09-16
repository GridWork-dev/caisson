# Cloud Run deployment pipeline

`services.json` is generated from the fleet manifest and must never be edited by
hand:

```bash
bun run /home/gw/lab/gridwork-infra/scripts/render-app-manifests.ts caisson --write .
```

The four workflows under `.github/workflows/` and `verify-receipt.ts` are
byte-identical copies of the reviewed T28 templates as corrected at
gridwork-infra commit `0d22c39`. Their registry, project/region,
Access-service-token, Bun-version-file, receipt, and gate-script wiring stays
upstream-owned so cross-repository drift remains a hash comparison.

`publish-image.yml` publishes immutable images on a push to `main` or an
explicit call. Staging, production, and rollback are manual or reusable-workflow
entrypoints; none deploy on merge.

The seven TypeScript entrypoints validate manifest inputs, build deployment plans,
exercise gcloud-resolved zero-traffic tag URLs with per-service origin headers,
exercise public Cloudflare paths after promotion, enforce rollout observations,
and validate rollback targets. `gates.sh` runs this repository's lint, typecheck,
and test commands in fail-fast order before an image can publish.
`prepare-build.sh` is the required explicit host-preparation hook; Caisson's
current implementation is an audited no-op because every build input already
lives in the Docker context. Run the
deployment tests with:

```bash
bun test deploy
```

The generated manifest currently publishes runtime service images only. The
plan therefore leaves `migration_job` empty rather than point `caisson-migrate`
at a web-service CMD. A reviewed, published migration image must land before
that output can be armed.

Production pre/post-migration smoke requires the `ORIGIN_SECRETS` GitHub
environment secret: a JSON object keyed by the four gated Caisson service keys.
It is not seeded by this change; creation and rotation ride T34a with the runtime
and Worker copies. Never put its values in repository variables or logs.

Production dispatch also requires the `PROD_DEPLOY_RECEIPT` GitHub environment
secret and a matching receipt input. The operator-side source is the same-named
entry in `~/.gridwork/env`; never print or commit it. This change does not seed
or inspect that value, and production remains fail-closed until the environment
secret exists.

The Wave-3 merge freeze remains binding: do not merge or run production deploys
until T34 fronts Railway and each gated Railway service has its matching origin
secret.

## Staging denial checks (R359 CR-04)

The staging workflow resolves the complete raw service URL map using
`deploy/staging-origins.ts`: the shared tool-exec allowlist validates the `gcloud run
services describe` argv, project, region and service keys. The returned metadata must
name the requested service. `STAGING_ORIGIN_URLS` accepts only unique canonical HTTPS
Cloud Run host URLs, without credentials, ports, paths, tags, query strings or fragments.
Both URL shapes documented by Google are accepted; opaque service identifiers are not
parsed or synthesized. See https://docs.cloud.google.com/run/docs/triggering/https-request.

For every staging service, smoke requires authenticated public health success, public
health denial without Access credentials (a Cloudflare Access login redirect or a
Cloudflare-marked 403), and raw service health denial without any credential (401/403).
Demos' raw denial is IAM protection, not an origin-secret assertion. Negative legs use
fresh headers and manual redirects, so Access/origin/IAM credentials never reach them.
The raw denial proves refusal at the raw surface, not which middleware produced it;
a Cloudflare-marked 403 likewise establishes edge denial, not policy-rule attribution.

These legs execute only in the authorized staging deploy workflow. Unit tests use fake
transports and fake argv execution; local verification does not probe the live fleet.
