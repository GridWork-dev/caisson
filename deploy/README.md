# Cloud Run deployment pipeline

`services.json` is generated from the fleet manifest and must never be edited by
hand:

```bash
bun run /home/gw/lab/gridwork-infra/scripts/render-app-manifests.ts caisson --write .
```

The four workflows under `.github/workflows/` are byte-identical copies of the
reviewed T28 templates. `publish-image.yml` publishes immutable images on a push
to `main` or an explicit call. Staging, production, and rollback are manual or
reusable-workflow entrypoints; none deploy on merge.

The six TypeScript entrypoints validate manifest inputs, build deployment plans,
exercise public Cloudflare paths, enforce rollout observations, and validate
rollback targets. Run their tests with:

```bash
bun test deploy
```

The Wave-3 merge freeze remains binding: do not merge or run production deploys
until T34 fronts Railway and each gated Railway service has its matching origin
secret.
