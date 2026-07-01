# Linear Business setup — operator runbook

Step-by-step for the parts of the Linear integration that **cannot** be driven by the API key. The
`linear` MCP created the team + projects + seed issues; everything below is UI/OAuth-only. Design +
boundary: [`linear-integration.md`](linear-integration.md). ~10 min total.

> **API-drivable vs not.** Done via MCP already: team `Caisson`, 4 projects, issues CAISSON-1/2/3.
> **Not API-drivable (this runbook):** triage rules, agent guidance, Code Intelligence (GitHub OAuth),
> cycles, initiatives. These are Business-tier UI features with no PAT/MCP surface.

## 0. Confirm Business is active

`Settings → Plans & billing` → plan reads **Business** ($16/user·mo). Agents are **not** billable seats,
so this is 1 seat. (You said it's activated — this just confirms the features below are unlocked.)

## 1. Enable cycles (weekly cadence)

`Settings → Team (Caisson) → Cycles` → **Enable cycles** → set duration **1 week**, cooldown 0, upcoming 2. Linear auto-creates cycles; issues you start land in the active cycle.

## 2. Triage + triage rules (inbound routing)

The chosen automation depth is **triage rules + Agent first-pass**.

1. `Settings → Team (Caisson) → Triage` → **Enable Triage**. New/inbound issues land in Triage instead of
   Backlog.
2. **Add triage rules** (same page → Rules): route by label/content to a project + set priority. Suggested:
   - label `bug` → project **Platform & Infra** or the area it names, priority High.
   - label `support` (from the support-bot, CAISSON-3) → project **Support & Docs**.
3. **Delegate on triage** (in a rule): add the action **Delegate to `Linear` agent** so the Linear Agent
   does an automated first-pass (scope/plan) as issues enter Triage. You stay the owner.

## 3. Agent guidance (standing instructions for agents)

`Settings → Agents` (or `Settings → Team → Agents`). Add **workspace guidance** — agents receive this
automatically when they work an issue:

```
Repo: GridWork-dev/caisson (Bun monorepo). Reference the issue id in the branch name (use the issue's
gitBranchName) and PR title. Never lock a decision in Linear — decisions are ADRs in knowledge/decisions/
and docs/state/decisions-and-forks.md. Follow CLAUDE.md + the gridwork-core security floor. Open a PR;
never push to main; the Greptile check is required. Give a short plan before large changes.
```

Team-specific guidance overrides workspace guidance where both apply.

## 4. Code Intelligence (issue ↔ PR/branch/deploy)

`Settings → Integrations → GitHub` → **Connect** (OAuth) → authorize the `GridWork-dev` org → select the
`caisson` repo. Then `Settings → Team → Code Intelligence` → enable. After this, an issue's
`gitBranchName` (e.g. `admin/caisson-1-…`) auto-links its PR and syncs branch/PR/deploy status onto the
issue. Business feature.

## 5. Initiatives (waves) + assign projects

Initiatives have no MCP creator — make them in the UI:

1. `Initiatives → New initiative` → **Launch** (target: go-live → first sale). Add the 4 projects.
2. Optionally **Post-launch harvest** for the AI/agent-infra work (ADR-0133).

## 6. (Optional) Linear Asks — no-code inbound

If you want email/web-form intake in addition to the support-bot wiring (CAISSON-3):
`Settings → Asks` → enable email intake or create a web form → route to Triage. Skip if the support-bot
path covers inbound.

## Done-check

- [ ] Business confirmed · [ ] cycles on · [ ] Triage + rules + Agent-delegate · [ ] agent guidance set ·
      [ ] GitHub connected + Code Intelligence on · [ ] Launch initiative with the 4 projects.

Once GitHub Code Intelligence is connected, Claude Code drives the rest via the MCP per
[`linear-integration.md`](linear-integration.md) — issues, status moves, PR links across EXECUTE→SHIP.
