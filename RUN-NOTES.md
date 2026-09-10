# S8 release train run notes — 2026-09-10

Authority: `/home/gw/lab/briefs/estate-2026-09/S8-caisson-release.md`.

## Entry evidence

- Worktree: `/home/gw/lab/worktrees/caisson/release-train-2026-09`.
- Branch: `chore/release-train-2026-09`; initially clean.
- HEAD and live `origin` main advertisement: `e2116849082f57c1d5fdaf6b309086813f48e4f4`.
- `S11-LANDINGS.md` records all eight estate PRs landed, including Caisson #475 at that SHA.
- `S11-R220-COMPLETION-READBACK.json` records exit 0, `T39_FLOOR=PASS`, `T39_COMPLETION=R220`, measured at `2026-09-10T17:55:58.990894+00:00`.
- The two named IP helpers still prefer `x-real-ip`. This is source evidence only; it does not establish live bucket collapse.
- Read the release-train workflow and security-scan workflow. No pipeline command was dispatched; downstream scripts and the complete gate enumeration remain unread/unresolved.

## Stop: unexpected discovery-command result

The following read-only lookup returned exit 2:

```sh
snip proxy bash -c 'rg -n "clientIp\(|x-real-ip|cf-connecting-ip|request.headers|rate.limit" services/license/src/server.ts services/docs/src/server.ts apps/site/app/api/health apps/site/app/healthz deploy --glob "*.ts" --glob "*.md"'
```

Observed diagnostic:

```text
rg: apps/site/app/api/health: No such file or directory (os error 2)
```

The directory was assumed, not established from the tree. The brief's standing instruction is: “Stop and report on the first floor denial, the first failed gate, or any result you did not predict.” Execution stopped on this unexpected result. This was a local discovery failure, not a failed production probe, GitHub denial, or release gate.

No retry, product edit, test, commit, PR, merge, tag, publication, deploy, or branch deletion followed. Only these hold notes and the audit receipt were written.

## Outstanding work

1. Resume task 1 by establishing actual source paths, then measure the live limiter key through the real edge. Neither collapse nor correct per-client isolation has been demonstrated.
2. Assess all three R212 folds before the release cut and record per-path fold/drop verdicts and evidence. No fold verdict was made and no branch was deleted. Resolve the brief's explicit per-item deletion instruction against its standing “no branch deletes” instruction before any deletion.
3. Complete the end-to-end pipeline reading, derive current gate and tarball counts, and record predictions before execution. The train includes Worker/Railway deploy dispatches, which the brief reserves to operator packets even after package-publication approval.
4. Prepare the required changes and green PR; obtain the brief's per-PR approval before merge, tag push, or package publish.
5. Execute the remaining ordered tasks only within that authority, including scheduled scanner work and final publication/consumer evidence.
