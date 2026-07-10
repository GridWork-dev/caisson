---
updated: 2026-07-09
status: live
grounds:
  - docs/deploy/STATE.md
  - docs/ops/incident-response.md
---

# Database restore procedure (CAISSON-52, doc half)

Written against **Railway native Postgres PITR** (point-in-time recovery), confirmed against
Railway's own docs (`docs.railway.com/volumes/point-in-time-recovery`, fetched 2026-07-09 — do
not trust this doc's mechanics section from memory on a future read; re-verify if Railway's
product has changed). This is a RUNBOOK — operator-executed, DEPLOY-class per
`identity/doctrine.md`'s Autonomy line, not part of the autonomous phase loop.

## Topology: ONE Postgres service, TWO databases

Confirmed (`docs/deploy/STATE.md`'s "Admin OAuth flip" entry, 2026-07-07-ish): `admin_auth` is a
**database** created with `CREATE DATABASE admin_auth` **on the Railway Postgres** — i.e. the
SAME Postgres service the commerce/platform data lives on, not a second Railway Postgres service.
Two logical databases, one physical server:

- the platform/commerce database (the service's default database, `DATABASE_URL`) — buyer
  accounts, entitlements, credits, billing.
- `admin_auth` (`ADMIN_AUTH_DATABASE_URL`) — better-auth's own tables for `apps/admin`'s GitHub
  OAuth sign-in, deliberately isolated from commerce (the config forbids reusing the site auth DB
  to avoid an `account` table collision — same STATE.md entry).

**This matters for PITR:** Railway's PITR archives WAL at the **Postgres service/cluster level**,
not per-database — pgBackRest ships the whole instance's WAL stream to the archive bucket. So
**enabling PITR ONCE on this one Postgres service covers both databases' write history**; there is
no separate "enable PITR on `admin_auth`" step.

**Before executing anything below, confirm this topology is still current** — infra can drift
independent of this doc:

```bash
railway status
```

If `railway status` shows the databases split across two separate Postgres services (topology has
changed since this doc was written), the procedure below still applies — just run it independently
against EACH service, since PITR/restore is scoped per-service either way.

## Pre-req checklist (before you need a restore)

- [ ] **A paid Railway plan** (PITR provisions a Railway Bucket for the WAL archive, which needs
      billing enabled on the account — confirm current plan-gating in the Backups tab at
      enable-time; not exhaustively confirmed against Railway's pricing page as of this writing).
- [ ] **The Postgres image is pinned to a MAJOR version tag, not `:latest` or a minor pin** — e.g.
      `postgres-ssl:16`, never `postgres-ssl:16.10`. Railway's own docs are explicit: "Minor
      version pinning is not supported with PITR... the Backups tab shows a warning if a minor pin
      is detected." Check the image tag on the Postgres service's Settings tab before enabling.
- [ ] **PITR is actually enabled** (Backups tab → "Point-in-time recovery is off" banner should be
      gone). The restore window starts from the **first post-enable base backup, not
      retroactively** — enabling PITR today does not let you restore to yesterday. This is the
      CAISSON-52 operator checkpoint: enable PITR on the Postgres service, in the dashboard,
      before an incident, not during one.
- [ ] **A test restore has been run at least once** (procedure below) — the first time anyone
      exercises this flow should not be during a real incident.

## How PITR restore works (mechanics, for context)

1. When PITR is enabled, the Postgres image archives every WAL segment to a Railway storage
   bucket via pgBackRest, plus a full base backup weekly and an incremental daily. **The last 4
   full backups are retained — roughly a 4-week restore window.**
2. To restore, pick a target timestamp on the Backups tab's datetime picker. Railway:
   - Creates a **brand-new** Postgres service (named `<source>-restored-YYYYMMDD-HHMM`, or a name
     you choose), with its own empty volume.
   - Wires it with the source's image + env vars (minus archive credentials) plus
     `WAL_RECOVER_FROM_*` pointing read-only at the source's bucket and
     `POSTGRES_RECOVERY_TARGET_TIME` set to your target.
   - On first boot, `pgbackrest restore --type=time --target=<target>` pulls the base backup
     at-or-before the target, replays archived WAL forward to the target, then promotes.
3. **The source service is NEVER touched and keeps serving traffic the entire time.** After the
   restore finishes you have two services side by side — cut over by swapping connection strings,
   or copy out just the rows you need and leave the source running.
4. The restored fork runs as plain non-archiving Postgres — if you want continued PITR coverage on
   IT, enable PITR on the new service separately (it gets its own bucket).

## Restore procedure (a real incident)

1. **Identify the target timestamp** — the last known-good moment, from the incident timeline
   (`docs/ops/incident-response.md`) or from when the bad write/migration landed. Err slightly
   earlier rather than later; you can always re-apply known-good writes made after the restore
   point, but you cannot un-restore past them.
2. **Do not touch the source service.** It keeps serving traffic during the whole restore — there
   is no reason to take it down first.
3. Railway dashboard → the affected Postgres service → **Backups** tab → pick the target timestamp
   → **Restore to this moment**. (No CLI equivalent exists for this step as of this writing —
   dashboard-only.)
4. Wait for the new `-restored-*` service to finish booting and promote (watch its deploy logs;
   `railway logs` scoped to the new service's ID once it exists).
5. **Verify the restored data** against the incident's known-good state before cutting over —
   query the specific rows/tables the incident affected.
6. **Cut over**, deliberately: this is a manual step Railway does not automate. Either:
   - swap the affected service(s)' `DATABASE_URL`/`ADMIN_AUTH_DATABASE_URL` env var to point at
     the restored service and redeploy, or
   - copy out only the affected rows/tables into the still-live source (safer when the incident was
     narrowly scoped — a handful of bad rows, not a systemic corruption).
7. Once cutover is confirmed good, decommission the OTHER side (either the old source, if you fully
   cut over, or the restored fork, if you only cherry-picked rows) — don't leave two live
   Postgres services silently diverging.
8. **Enable PITR on whichever service is now the live one**, if it isn't already archiving (a
   freshly-restored fork starts as plain non-archiving Postgres — see mechanics step 4 above).

## Test-restore procedure (run this BEFORE you need it — the CAISSON-52 pre-req)

1. Confirm PITR is enabled and has at least one base backup (Backups tab shows a restorable
   range, not just the "off" banner).
2. Pick a recent, arbitrary timestamp (a few minutes ago is fine for a test) and run the restore
   flow above through step 4 (the new `-restored-*` service boots and promotes).
3. Verify: connect to the restored service, spot-check a handful of known rows/tables against the
   source at the same logical point.
4. **Do NOT cut over** — this is a drill. Remove the `-restored-*` test service once verified (it's
   a normal Railway service; delete it like any other) so it doesn't linger as a second billed
   Postgres instance.
5. Record the drill date + result somewhere durable (this doc's `updated` frontmatter, or a
   dedicated Linear ticket) so "when did we last prove this works" has an answer.

## Related

- **Code-level rollback** (a bad deploy, not a bad write) — `docs/ops/incident-response.md`
  §"Generic Railway rollback". A restore undoes DATA; a rollback undoes CODE — an incident may need
  either or both.
- **Read-only containment** — `packages/kernel/src/read-only.ts`'s `assertNotReadOnly` gate (not
  yet wired to a live mode source as of this writing) can freeze writes while a restore target is
  being decided, once W3 lands a source.
