# S8 image scan disk diagnosis

Baseline main: 6604844a3f17633e5221075af6d01966620eaaed, run 34888116937 (completed failure 2026-09-14T20:00:32Z). Select and every gates step succeeded. Site/admin/demos completed publication; license/docs/migrate failed at vulnerability scan, collect skipped. Existing gates fix is now proven on main.

## Same failure confirmed independently

Full cached GitHub log ZIP was read, not the exec endpoint's truncated stdout. License job 104123945353 failed at 19:56:18Z, docs 104123945423 at 19:55:08Z, migrate 104123945539 at 20:00:03Z. Every failure is Trivy FATAL: unable to export the image, Docker daemon write under /var/lib/docker/tmp/docker-export-_/blobs/sha256/_, no space left on device. License/migrate warnings reported 0 MB free, docs 2 MB. Scanner exit-code policy was 0, severity CRITICAL,HIGH, ignore-unfixed false: this is not a CVE gate verdict. PR 482's 3 CRITICAL/52 HIGH base result remains a separate finding.

All six jobs used ubicloud-standard-2, Ubuntu 24.04.4 image 20260901.1.0, premium family, x64. [Ubicloud's runner table](https://www.ubicloud.com/docs/github-actions-integration/runner-types) lists 2 vCPU, 8 GB RAM and 75 GB disk for this label. Disk size is a documented configuration until branch df captures the actual filesystem. Old logs do not expose a reliable total image byte count. Build-record artifacts were offered in a non-ZIP format that gh run download could not extract; artifact/SBOM byte sizes are not image sizes. Branch image inspect will measure the comparison directly.

Mechanism: full-workspace images retain the large dependency tree, unlike the three Next standalone runtimes. BuildKit content, the image Docker/Syft reads and Trivy's additional Docker export compete on the same disposable VM disk. Confirmed evidence is daemon-export ENOSPC; exact byte allocation by each consumer was not sampled in that old run.

## Fix and proof boundary

Keep shared publish-image.yml byte-identical (ADR-0419). Its existing prepare-build.sh call now removes only Android, GHC, Swift and .NET SDK directories in GitHub Linux CI, before the Docker build, retaining Node/Bun/Python/JDK and Docker storage. It writes TRIVY_IMAGE_SRC=remote through GITHUB_ENV, causing the publisher to scan its resolved registry digest without another Docker export. [Trivy image-source documentation](https://trivy.dev/docs/v0.53/guide/target/container_image/) defines remote versus Docker source selection. No exit-code/severity policy change.

Local evidence: eight tests / twelve assertions pass; changed-file lint and shell syntax pass. A deliberate remote-to-docker mutation failed the source-selection assertion, then restored tests passed. Cleanup is stubbed in tests; no workstation SDK was removed. CI environment flags are an execution guard, not OS isolation against someone intentionally fabricating them.

The branch proof derives all six services from deploy/services.json and uses the same runner/version pins, full gates, preparation and Dockerfiles. It builds local images without credentials or publication, measures image Size and disk bytes, then uses the publisher's pinned Trivy action. It deliberately selects Docker to retain the disk-demanding export that failed before; this proves headroom under that stronger disk arm, while production selects remote. It does not test private-registry authentication, signing or publication. The six real scan results remain outstanding until CI executes; main must still pass all six scan steps before task 3 resumes.

Peer code/security dispatches were refused admission and never ran; no retry, no independent review pass. Claims relying on own judgment: safe fixed cleanup targets, sufficiency of freed disk, remote-source propagation through the shared action, and how far the local Docker proof supports the production remote path. No Dockerfile OS patch or CVE policy relaxation is included here; R333 remains separately scoped.
