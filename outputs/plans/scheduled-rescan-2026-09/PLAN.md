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
