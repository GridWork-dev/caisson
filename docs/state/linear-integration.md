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

## Business-tier automations (operator UI setup — not MCP-scriptable)

These need the **Business plan active** and are configured in the Linear UI:

- [ ] **Triage rules** (Settings → Team → Triage) — route inbound by label/team; optionally delegate to the
      Linear Agent on entry. Chosen automation depth: _triage rules + Agent first-pass_.
- [ ] **Agent guidance** (Settings → Agents) — standing instructions agents receive: reference issues in
      commits/PRs, which repo (`GridWork-dev/caisson`), the review process. Workspace + per-team.
- [ ] **Code Intelligence** (Business) — connect the GitHub integration so branch/PR/deploy status syncs to
      issues. Linear already emits `gitBranchName` per issue (e.g. `admin/caisson-1-…`).
- [ ] **Cycles** — enable weekly cycles on the Caisson team.

## Inbound wiring (fast-follow — CAISSON-3)

The chosen inbound path: the Discord **support-bot** (ADR-0105) posts escalations
(`support_ticket.ai_brief`) as Linear issues in **Triage** via the API on escalation. Needs a small spec +
the API call in the bot. Tracked as **CAISSON-3**. Until then, issues are created by Claude Code (MCP) or
manually; Linear Asks (email/web) is the no-code alternative if wanted later.

## Setup checklist

**Done (this session, via MCP):** team `Caisson` · 4 area projects · seed issues CAISSON-1/2/3.
**Operator (UI / billing):** activate **Business** ($16/mo) · triage rules · agent guidance · GitHub Code
Intelligence · enable cycles · create the `Launch` initiative.
**Code (fast-follow):** support-bot → Triage wiring (CAISSON-3).
