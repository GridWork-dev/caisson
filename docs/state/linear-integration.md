---
updated: 2026-07-11
status: live
---

# Linear integration — Caisson workflow

How Linear (Business tier) plugs into the Caisson build workflow. **Locked design (operator picker
2026-07-01);** provider add = PF-3 / ADR-0177. This is the operating manual — the agent instructions in
`CLAUDE.md` point here.

## The one boundary that matters

**Linear owns WORK. Git owns DECISIONS.**

| Lives in Linear (execution + inbound)                          | Stays git-native (decision SOT)                             |
| -------------------------------------------------------------- | ----------------------------------------------------------- |
| Issues, tasks, bugs, cycles, project/initiative roadmap status | ADRs (`knowledge/decisions/`) — append-only decision record |
| Inbound triage (support-bot escalations, requests)             | `docs/state/decisions-and-forks.md` — the live fork board   |
| Agent delegation + first-pass triage                           | `specs/`, `plan.md` — spec + build plan                     |
| PR/branch/deploy linkage (Code Intelligence)                   | Commits (conventional, atomic)                              |

Never move a decision INTO Linear. A Linear issue may _reference_ an ADR (`ADR-0177`) or a fork, but the
lock lives in the repo. This keeps the audit-trail in-repo (fits the data-custody brand) and avoids a
second source of truth.

## Workspace (live)

- **Team:** `Caisson` (key `CAISSON`) — one team, solo + agents. Agents are **not** billable seats.
- **Projects = area** (created 2026-07-01): **Platform & Infra** · **Site & Buyer Dashboard** ·
  **Editions & Registry** · **Support & Docs**. Add more as areas emerge.
- **Initiatives = waves** (operator creates in-UI; no MCP creator): e.g. `Launch` (go-live → first sale),
  `Post-launch harvest`. Group projects under the active wave.
- **Cycles** = weekly cadence (enable per team in Settings).
- **Users:** `admin@gridwork.dev` (owner) + the built-in **Linear Agent** app-user (delegation target).

## How Claude Code uses Linear (the 7-act binding)

Linear tracks execution alongside the git-native 7-act lifecycle — it does not replace it.

| Act              | Linear action (via MCP)                                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| SPEC / PLAN      | Optional: create/​update the tracking **issue(s)** for the work in the right project; set priority.                         |
| EXECUTE          | Use Linear's `gitBranchName` for the feature branch → auto-links the PR (Code Intelligence). Move issue to **In Progress**. |
| VERIFY / SHIP    | Attach the PR link; move to **In Review** → **Done** on merge. The ADR/decision still lands in git.                         |
| Inbound (triage) | Bugs/requests arrive in **Triage** (support-bot → CAISSON-3), auto-routed by triage rules.                                  |

**Operating rules for the agent** (also in `CLAUDE.md`):

1. Linear issues are for **execution tracking + inbound**, never for locking a decision — decisions are ADRs.
2. Create/update issues via the `linear` MCP (`save_issue`/`save_project`/`list_issues`). Reference the
   ADR or fork by id in the description; link the PR via `links`.
3. Don't mirror the whole ADR board into Linear — a fork board already exists in-repo. Only surface work
   items (tasks/bugs), not decisions.
4. **Delegation:** assign an issue to the **Linear Agent** for a first-pass (scope/plan/triage); the human
   stays the owner. Claude Code (main engine) still does the real build in-repo — Linear tracks it.
5. Keep issue titles action-shaped; put the runbook/context in the description; link `path:line` or the ADR.

## Business-tier automations — CONFIGURED (phase-2 pass, 2026-07-11)

All four legs are live (operator UI session 2026-07-11, verified same day via the `linear` MCP —
the static `lin_api_` key answers; team/board/issue calls all round-trip):

- [x] **Triage** — ON ("issues added by outside members go to the triage inbox first"); triage
      responsibility = "No action". Two routing rules: `Support` label → Support & Docs project;
      `Bug` label → Platform & Infra + delegate to Linear Agent + High priority. NOTE: Linear's
      rule engine can only route issues already IN Triage — there is no "move into Triage"
      action; the master toggle is what lands outside-member/integration issues there.
- [x] **Agent first-pass automation** — "Linear Agent first-pass triage scoping" fires on "Any
      issue enters triage": scope/summarize only (restate request, note area, flag
      duplicates/missing info); explicitly forbidden from changing status/project/priority/
      assignee or closing/merging/deleting. Human stays owner.
- [x] **Agent guidance (workspace)** — verbatim: "Repo: caisson-sh/caisson. Reference the issue
      ID in every branch, commit, and PR. Branches follow the issue's gitBranchName. Decisions
      are never made in Linear — ADRs in the git repo own decisions; link the ADR/PR instead.
      Do a first-pass scope/triage only; the human owner and Claude Code do the build." (Team-
      level guidance: none — no team-level agents installed.)
- [x] **GitHub Code Intelligence** — the `caisson-sh` org is now a connected organization
      (alongside `GridWork-dev`); Code Intelligence = Enabled, "All repositories". Team PR
      automations live: PR open → In Progress, PR review → In Review, PR merge → Done. Proven
      in anger 2026-07-11: PR #205's "Closes CAISSON-89/90/91" lines auto-moved all three to
      Done at merge, PR attached to the issue.
- [x] **Cycles** — 1-week, Monday start, no cooldown, auto-create 2 ahead; started + completed
      issues auto-added. (No separate carry-over toggle exists — incomplete issues rolling
      forward is inherent.)

Pre-existing housekeeping automations (untouched): auto-close stale issues after 6 months
(→ Canceled), auto-archive closed after 6 months, "place issues first" on status progress.
**Triage Intelligence** (AI duplicate/property inference) is OFF workspace-wide — deliberate;
the Agent automation above covers the first pass.

## Inbound wiring (CAISSON-3)

**BUILT (ADR-0206, edition-tails-ops session, 2026-07-02):** the Discord **support-bot**
(ADR-0105) posts escalations (`support_ticket.ai_brief`) as Linear issues in **Triage**, as a
third best-effort sink alongside the existing Discord-thread + Postgres sinks in
`Escalator.escalate()`. An `IssueTracker` Protocol + concrete `LinearIssueTracker` POST the
`issueCreate` GraphQL mutation to `api.linear.app`; the port owns its own failures (an escalation
must still succeed with Linear down). The Triage `stateId` is passed explicitly on create — no
dependency on Business-tier triage automations. **v1 is log-only**: the created issue URL is
logged, not persisted onto `support_ticket` (no ALTER TABLE migration path exists yet;
correlation is a nice-to-have, not v1 scope). The whole surface is **env-gated off** —
`LINEAR_API_KEY` / `LINEAR_TEAM_ID` / `LINEAR_TRIAGE_STATE_ID` unset ⇒ no Linear code path runs
— using the operator's existing `lin_api_` personal key (credential-reuse trade-off acknowledged
in the ADR; rotating to a dedicated bot actor later is a pure env-var swap).
The code shipped in `services/support-bot` (`linear_client.py` + the `IssueTracker` port in
`escalation.py`, wired all-or-nothing off the bot's pooled httpx client; both API gotchas — bare
`Authorization` header, HTTP-200-with-`errors` — pinned in tests). **The sink went env-live
2026-07-02** — all three vars set on the `caisson-support-bot` Railway service (team id
`82e9704b-8665-4418-a175-8b886a149d50`, Triage state id `2717723f-cdc2-4d75-b292-032caf937810`)
and the service redeployed. Linear Asks (email/web) remains the no-code alternative if wanted later.

## Setup checklist

**Done (2026-07-01, via MCP):** team `Caisson` · 4 area projects · seed issues CAISSON-1/2/3.
**Done (operator UI, phase-2 2026-07-11):** Business active · triage + agent automation · agent
guidance · GitHub Code Intelligence on `caisson-sh` · cycles — see the CONFIGURED section above.
**Code (DONE 2026-07-02, ADR-0206):** support-bot → Triage wiring (CAISSON-3) — merged in PR #46,
env vars set + service redeployed the same day (live).
**Remaining (operator, optional):** create the `Launch` initiative in-UI (no MCP creator);
consider Triage Intelligence if inbound volume ever outgrows the Agent first-pass.
