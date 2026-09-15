# S8 R332 scheduled rescan plan

Authority: R332 and matching SPEC. Main-thread implementation and self-assessment; no delegated admission retry.

1. Census 6604844a3f17633e5221075af6d01966620eaaed: eight first-party Dockerfiles, fourteen FROM lines, eleven external references, two unique digest pins (ten Bun, one Python). Lane still carries earlier pins; dynamic extraction must follow each actual checkout. Do not modify Dockerfiles in this task.
2. Add dependency-free Python collector/scanner and focused unittest coverage. Hook these checks and base-image scanning into the existing credential-free deterministic job, reusing its pinned Trivy install. Add daily 06:37 UTC schedule, isolate scheduled concurrency from push runs, disable checkout credential persistence. Keep publishing workflow unchanged.
3. Before execution predict: unit tests pass; mutation removing cron or failure propagation is caught; eight files and two images at 6604844a, three images on the older lane; formatting, whitespace and relevant lint pass. Cron proof yields one tick daily including month/year/leap boundaries. Tests simulate scanner statuses and do not assert real CVE cleanliness.
4. CI prediction: six required checks pass; source scanner and real base scan complete without HIGH/CRITICAL findings. A contrary result, first floor denial or failed gate stops; no retries. The deliberate negative fixtures/mutations must fail exactly as predicted. SOT retains only already-dispositioned branch/freshness drift.
5. Commit implementation separately from lane receipts. If task 3 remains blocked, fresh branch off origin/main carries only rescan implementation/spec/plan/verification; open PR and wait for actual green. No lane history push, no merge or schedule dispatch. Record peer refusal and claims relying on own judgment (extraction completeness, anonymous boundary, platform/scope, cron semantics).

## R333 OS repair execution

1. Insert apt-get update, noninteractive apt-get upgrade -y and list cleanup in a single RUN after each external runtime FROM, plus admin migrate after its build alias. License runtime/migrate inherit the patched shared base. Preserve base digests, runtime USER/CMD/ENV and app source. Eight files, nine upgrade lines.
2. Predict offline stage/digest checks pass, and a mutation deleting one runtime upgrade is caught. First real patch scan must clear all three named CRITICAL perl-base findings plus other fixable OS rows; keep unfixed findings visible. Any contrary result stops.
3. Keep this proof separate from PR 483's disk repair, with per-PR actual scan evidence. Scheduled gate behavior awaits operator answer; no private published-image scan or credential scope expansion.

## R335/R336 execution and predictions (before new measurements)

1. Keep 8eebf039 on the existing PR 482 branch; amend policy here. Derive runtime matrix from the tracked Dockerfile census: final stage for every file and each named migrate stage, expected ten targets. Fresh per-target CI runner builds linux/amd64 with no cache reuse, so apt indexes/upgrade execute daily. No services start, migrations run or registry writes. Use the fixed SDK cleanup proven by PR 483 in this independent runtime workflow job so both PRs can turn green before either merges; publisher stays untouched.
2. Scan built images locally using pinned Trivy 0.72.0, all severities into JSON. Enforce HIGH/CRITICAL rows carrying FixedVersion; preserve unfixed rows and OS/application distinction in a summary. Both a fixable OS and a fixable application fixture must fail runtime policy; identical raw-base fixtures only report. Raw base scans continue across findings/errors, retain reports, and expose operational failures as warnings rather than failing the job. Runtime scanner errors and malformed reports fail closed.
3. Offline tests must pass; deliberate runtime-policy pass-through and raw-base enforcement mutations must each fail the policy contract, then restored tests pass. Matrix census must cover eight final images plus admin/license migrate targets. Formatting, shell/YAML validation and relevant lint pass.
4. CI prediction: builds finish, runtime OS patch clears the three named CRITICAL perl-base rows and other fixable OS rows. Runtime gate passes with unfixed rows visible; any remaining fixable application finding also fails (no OS-only scope loophole). Raw pinned bases retain their prior fixable findings but report without reddening the job. Required checks and all new runtime jobs must pass before ready. Stop at first failed gate, floor denial or unpredicted result; own-tool errors retry once only. Do not retry peer admission.
5. Download actual raw/built reports; record installed/fixed versions and remaining unfixed rows, runtime source/image IDs and check rosters in the PR body and receipts. Push authorized commits to PR 482; leave PR 483 head unchanged. Hold for joint cockpit merge wave; no lane merge or release.

## R344 policy amendment (supersedes R335 application enforcement)

1. Restrict built-image failure to fixable HIGH/CRITICAL os-pkgs rows. Keep all findings and add explicit application residuals and OS blockers in JSON. Write application rows with installed and fixed versions to the GitHub job summary. Raw bases remain informational; scanner and coverage errors remain enforcing for runtime images.
2. Predict before measurement: HIGH and CRITICAL OS fixtures fail; same-severity node-pkg, python-pkg and gobinary fixtures report without failure. Test summary output and mixed reports; old policy must fail the new application test, and a deliberate OS pass-through mutation must fail the OS test. Restore exact bytes and pass the full focused suite.
3. Re-evaluate saved run 34983075951 reports without another scan: all ten runtime reports should pass the narrowed policy, retaining the twelve unique fixable application rows and their fixed versions. This is policy evaluation of existing reports, not fresh vulnerability intelligence.
4. Commit and push only the policy, tests and associated phase documentation on PR 482. Predict CI builds/scans and all active checks pass, subject to new scanner intelligence. Read both PR heads and complete rosters; hold both under R336 for the joint cockpit wave. No merge, deployment or publication.
5. Record dependency follow-ups: remove TypeScript compiler binary from runtime images; repair msgpack/setuptools in support-bot. These repairs are not authorized here. Peer dispatches remain refused and never ran; classification, summary visibility and CI evidence interpretation retain one set of eyes.

## Historical lane R332 record (superseded by R333/R335/R344 above)

The following preserves the original lane narrative at 8754070c; it is historical evidence, not the operative scanner policy or current verification status.

# S8 R332 scheduled rescan plan

Authority: R332 and matching SPEC. Main-thread implementation and self-assessment; no delegated admission retry.

1. Census 6604844a3f17633e5221075af6d01966620eaaed: eight first-party Dockerfiles, fourteen FROM lines, eleven external references, two unique digest pins (ten Bun, one Python). Lane still carries earlier pins; dynamic extraction must follow each actual checkout. Do not modify Dockerfiles in this task.
2. Add dependency-free Python collector/scanner and focused unittest coverage. Hook these checks and base-image scanning into the existing credential-free deterministic job, reusing its pinned Trivy install. Add daily 06:37 UTC schedule, isolate scheduled concurrency from push runs, disable checkout credential persistence. Keep publishing workflow unchanged.
3. Before execution predict: unit tests pass; mutation removing cron or failure propagation is caught; eight files and two images at 6604844a, three images on the older lane; formatting, whitespace and relevant lint pass. Cron proof yields one tick daily including month/year/leap boundaries. Tests simulate scanner statuses and do not assert real CVE cleanliness.
4. CI prediction: six required checks pass; source scanner and real base scan complete without HIGH/CRITICAL findings. A contrary result, first floor denial or failed gate stops; no retries. The deliberate negative fixtures/mutations must fail exactly as predicted. SOT retains only already-dispositioned branch/freshness drift.
5. Commit implementation separately from lane receipts. If task 3 remains blocked, fresh branch off origin/main carries only rescan implementation/spec/plan/verification; open PR and wait for actual green. No lane history push, no merge or schedule dispatch. Record peer refusal and claims relying on own judgment (extraction completeness, anonymous boundary, platform/scope, cron semantics).
