---
branch: admin/caisson-106-ai-sdk-major-migration-ai-v5v7-ai-sdk-provider-majors
base: origin/main
reviewed: 2026-07-13
depth: deep
files_reviewed: 19
status: pass_with_dispatch_degradation
findings:
  fixed: 1
  blocking: 0
  advisory: 0
---

# CAISSON-106 planning and dependency-debt review

## Verdict

PASS. The branch contains the draft CAISSON-106 SPEC and PLAN, the ESLint 10 debt cleanup, and the Node 26 compatibility bump. It contains no AI SDK migration dependency or product-code change. One blocking planning error was found and fixed before this report; no blocking finding remains.

The governed `gw-code-reviewer` and `gw-security-auditor` routes both resolved to their required `gpt-5.6-sol` deep, shared-read bindings. Their Codex child adapter could not complete repository reads because the `repo-read` PreToolUse hook blocks shell commands, including read-only `git`, `rg`, and skill reads. The active orchestrator therefore applied both canonical agent checklists inline against the complete diff, and PAL supplied the required independent cross-vendor review. This is a dispatch-adapter degradation, not a clean child-agent verdict, and is recorded verbatim below.

## Scope

All 19 paths in `git diff --name-only origin/main...HEAD` were reviewed. Planning documents and lockfile changes were included for scope and contract validation; every changed source file was reviewed in context.

## Fixed finding

### FIX-01: stale AI SDK v7 provider-major matrix

**Severity:** High, fixed

**Files:** `outputs/specs/ai-sdk-v7-migration/SPEC.md`, `outputs/plans/ai-sdk-v7-migration/PLAN.md`

The first draft carried v6-compatible provider majors into the v7 final column. That would have made the later execution plan invalid. The matrix was checked against the npm registry dist-tags on 2026-07-13 and corrected to Bedrock `^5`, Anthropic `^4`, Azure `^4`, Google `^4`, OpenAI `^4`, OpenAI-compatible `^3`, and provider `^4`. The plan also now includes the Google `createGoogleGenerativeAI` to `createGoogle` rename.

## Code-review lane

**Inline canonical-checklist result:** PASS, no Critical or Warning findings.

- The 13 ESLint 10 edits eliminate only redundant initial assignments or preserve caught errors as causes. All branches still definitely assign before use, and the removed gateway catch only rethrew the same error after a redundant assignment.
- The Node 26 cast is limited to the Bun `node:http` callback declaration mismatch. It does not weaken the exported handler type or change runtime request handling.
- Naming changesets cover every changed publishable package. Build-state counts match disk.
- No CLI template, webhook schema, Zod version, AI SDK dependency, or AI migration product code changed.

**Governed child receipt, verbatim:**

> `BLOCKED: repo-read delegated Codex children cannot execute shell commands. Command: wc -l /home/gw/.agents/skills/gw-review/SKILL.md /home/gw/.agents/skills/graphify/SKILL.md && cat /home/gw/.agents/skills/gw-review/SKILL.md && cat /home/gw/.agents/skills/graphify/SKILL.md`

The child then attempted the allowed graph surface, but Caisson has no graph available and returned no review verdict.

## Security-audit lane

**Inline security-floor result:** SECURED for this branch, with no open or unregistered threat.

- No auth boundary, secret comparison, shell execution, untrusted path, outbound network call, cookie, CORS policy, or production response-header behavior changed.
- Error wrappers retain original causes; no secrets or sensitive payloads were added to messages.
- The mcp-server callback retains the existing security-header and error-response path.
- The CAISSON-106 documents explicitly preserve `fetchWithTimeout`, provider confinement, integer estimate-reserve-reconcile accounting, exactly-once settlement, golden usage coverage, and the non-blessing eval gate. Migration implementation remains locked and absent.

**Governed child receipt, verbatim:**

> `BLOCKED: repo-read delegated Codex children cannot execute shell commands. Command: pwd && rg --files .agents/skills .claude/skills 2>/dev/null | rg '(^|/)SKILL\.md$' | sort && git diff --name-only origin/main...HEAD && rg --files | rg '(^|/)(PLAN|SUMMARY|SECURITY)\.md$|graphify-out' | head -200`

The child correctly refused to widen permissions and returned no security verdict.

## Independent PAL review

PAL `codereview` used `google/gemini-2.5-pro` through OpenRouter with continuation `819acb17-6b10-4a3a-a167-9d2cf16e48f5`.

- Confirmed the provider-major correction, two-hop checkpoint plan, metering safeguards, Node declaration bridge, and behavior-preserving ESLint cleanup.
- Reported FIX-01 as the sole tracked branch finding; it is closed.
- Four additional suggestions were rejected after source verification: the site API cast, license error cause, and registry semver implementation predate this diff, while the registry catch assertion was not introduced by this task and does not defeat the newly preserved cause. None is a regression or a violated branch requirement.

## Verification evidence

- `bun run check`: PASS, 197 of 197 tasks; standards gate checked 67 packages and skipped 5 scaffold-only packages.
- `bun run sot`: PASS; ADR ceiling parity at 0329, changeset preflight green, package counts match, and no source-of-truth drift exists.
- `bun run --filter @caisson/mcp-server build`: PASS.
- `bun run --filter @caisson/mcp-server test`: PASS, 67 tests and 0 failures.
- `bunx eslint .`: PASS with `no-useless-assignment` and `preserve-caught-error` re-enabled.
- `git diff --check`: PASS.

## Merge gate

No Required, HIGH, or CRITICAL finding remains. The branch is eligible for a draft PR and must stop there for the operator to lock or revise the draft CAISSON-106 SPEC and PLAN.
