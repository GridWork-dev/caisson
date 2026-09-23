# R405 downstream sweep

The changed step runs after consume and design-manifest generation, before
lock refresh and tarball recording. Both template package.json paths already
match the workflow's package-manifest staging glob; the Next starter golden
now has an explicit staging path. The tracked-leftovers guard stays intact.

The helper and its tests belong to the registry's existing build/lint/test
surface. The strengthened golden test remains in the existing CLI suite.
An empty changeset records pipeline-only maintenance without a product bump.
No already-consumed version, release sidecar row, or package archive is edited.

Trust boundaries are unchanged: no new inputs, network calls, permissions,
credential reads, or event triggers. The new helper executes only in the
trusted main workflow_dispatch consume job. The pull_request_target refresh
job still treats candidate files as data and does not run this helper or BLESS.

Residuals: the next authorized real train must prove hosted execution and the
release bytes. This fix does not synchronize every possible future generated
file; its allowlist is the two shipped templates and the Next starter golden.
The source changeset wording issue from #487 remains a regeneration caveat in
the prior receipt; no historical changeset or changelog is rewritten here.

R405 holds this pipeline PR for a cockpit merge ruling regardless of tags.
The release itself remains held: no tag, GitHub Release or publish.
