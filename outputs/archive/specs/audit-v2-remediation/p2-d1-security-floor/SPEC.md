---
id: p2-d1-security-floor
title: "P2 / D1 — security-floor gaps across buyer-runtime HTTP surfaces (Zod boundaries, HTML-escape, CORS allowlist, security headers, admin confirm gate)"
tags: [security, auth]
status: spec
source: audit-v2 (ADR-0233)
---

# SPEC — P2 / D1 security-floor gaps across buyer-runtime HTTP surfaces

**Status: spec (audit-v2 remediation wave P2).** Eight open findings from the
ADR-0233 audit ledger, all rooted in the global security floor
(`identity/security.md`): Zod `.strict()` at every API boundary, HTML-escape of
user input, explicit CORS allowlist (never `*`, never reflected), and the
security-header set (`X-Content-Type-Options`, `X-Frame-Options`,
`Strict-Transport-Security`) on every HTTP response. None of these are
novel — they are the floor re-asserted where the audit caught it slipping.

- **Source:** `outputs/audit/ledger.toml` (ADR-0233, dimension D1 unless noted).
- **Floor cite:** `identity/security.md` — Input validation / Network / Headers
  clauses (auto-loaded).
- **Related ADRs:** ADR-0005 (fail-closed RLS) · ADR-0007 (integer money) ·
  ADR-0015 (auth→RLS seam) · ADR-0212 (branded money at the boundary) ·
  ADR-0161 (Streamable-HTTP listener: stateless auth + binding network surface).
- **Tracking:** Linear owns the WORK items; this spec owns the disposition +
  fix shape + verify commands.

## Goal (WHAT + WHY)

Close every D1 security-floor gap the audit flagged on the buyer- and
operator-facing HTTP surfaces so that the four floor invariants hold
mechanically across `apps/base`, `packages/mcp-server`, `apps/admin`, and the
`apps/site` email templates: **(1)** every request body crossing a trust
boundary is parsed with a strict Zod schema, **(2)** no buyer-supplied string is
interpolated into raw HTML unescaped, **(3)** CORS allowlists never accept a
wildcard, **(4)** every HTTP response carries the security-header set, and
**(5)** the admin destructive-mutation gate does not honor a universal bypass.
WHY now: these are floor regressions on surfaces that ship at launch — the
admin panel gates real money/license mutations, the MCP listener is
network-reachable, and the email templates are the buyer's first message.

## Findings covered

| id                           | sev  | file                                                         | one-line                                                                 | disposition        |
| ---------------------------- | ---- | ------------------------------------------------------------ | ------------------------------------------------------------------------ | ------------------ |
| e629f41681647152             | warn | apps/site/emails/waitlist-welcome.ts:70                      | buyer email interpolated into raw HTML unescaped                         | fixed-by-this-spec |
| 6ca95b078e8b2c69             | warn | apps/site/emails/nurture-follow-up.ts:68,132                 | same unescaped-email-into-HTML pattern, sibling template                 | fixed-by-this-spec |
| 0c02cc991faa4094             | warn | apps/admin/src/app/business/mutations.tsx:227-232            | type-to-confirm accepts literal `CONFIRM` as a universal bypass          | fixed-by-this-spec |
| 473e43578bcaee72 (D2-tagged) | warn | apps/admin/src/app/business/mutations.tsx:193-207            | re-issued license token rendered raw as JSON in the DOM, no reveal/clear | fixed-by-this-spec |
| 01072a1258a5bc1a             | info | apps/admin/scripts/provision-admin-mutation-surface.ts:55-80 | GRANT statement built via template-string interpolation of a CLI arg     | fixed-by-this-spec |
| be4c8e39e5e20f46             | warn | apps/base/src/server.ts:44-49,60                             | /spend and /mcp parse body with bare `as` cast, not Zod `.strict()`      | fixed-by-this-spec |
| 84da56ad5f83faf8             | warn | packages/mcp-server/src/http.ts:190-200                      | CORS allowlist never rejects a literal `*` entry                         | fixed-by-this-spec |
| b272c2150353492e             | warn | packages/mcp-server/src/http.ts:190-224,277                  | Streamable-HTTP listener missing security-floor response headers         | fixed-by-this-spec |

**Note on 473e43578bcaee72:** the ledger tags this D2 (customer-facing-quality)
but it is grouped here because it shares the `apps/admin` mutation-panel
surface and the same React-render site as the D1 confirm-bypass finding
(`0c02cc991faa4094`). The fix is one cluster. No reclassification of the ledger
row is required — the dimension tracks the _quality lens_, the spec tracks the
_fix locus_, and they need not match.

**Reconcile-needed:** none. All eight findings are clear-cut floor violations;
no finding contradicts another, no ADR-bearing change is in flight on these
surfaces (the admin panel is ADR-0220/0225 locked; the listener is ADR-0161
locked; both are stable).

## Approach

Five atomic tasks. Each fixes the root cause (a missing floor invariant), not
the symptom. Per dispatch invariant: `model: sonnet` for all five (bounded
<~100 LOC each, clear spec); `run_in_background: true` if dispatched as
agents.

### Task 1 — `apps/site` email templates: HTML-escape buyer input (covers e629f41681647152, 6ca95b078e8b2c69)

**Files:** `apps/site/emails/waitlist-welcome.ts:70`, `apps/site/emails/nurture-follow-up.ts:68,132`.

**Root cause:** both templates interpolate `${email}` directly into the raw
HTML string. The sibling `serializeJsonLd` escape path (cited in the finding
title) is the precedent — these two sites were missed.

**Fix shape:** a one-line `escapeHtml(s: string): string` helper at the top of
each template file (or shared in `apps/site/emails/escape.ts` if a third
consumer appears — YAGNI until then), escaping `<`, `>`, `&`, `"`, `'`. Wrap
every `${email}` interpolation as `${escapeHtml(email)}`. The `edition` field
is operator-curated (a fixed enum) and does NOT need escaping — only the
buyer-supplied `email` does. `// ponytail: stdlib replace loop, no dep — email
clients + DOM both treat the escaped entity literally.`

**Why a helper over a dep:** the escape set is 5 characters; a dependency is
slop. Both templates are explicitly "template only, not wired to a sender" per
their headers — the live blast radius today is low, but the floor is
unconditional: HTML-escape user input at the interpolation site, not at "when
we wire the sender."

**Verify:**

- `grep -nE '\$\{email\}' apps/site/emails/*.ts` → every hit is wrapped in
  `escapeHtml(...)`.
- `bun test apps/site/emails` (new tiny test: feed `<script>` in `email`,
  assert the literal string `<script>` does NOT appear in the output, only
  `&lt;script&gt;`).

### Task 2 — `apps/admin` cluster: confirm gate + token render + provision SQL (covers 0c02cc991faa4094, 473e43578bcaee72, 01072a1258a5bc1a)

Three findings, one surface (the ADR-0220 operator mutation panel + its ADR-0225
deploy script). One task cluster, three sub-edits.

**2a — drop the universal `CONFIRM` bypass** (`mutations.tsx:227-232`).
The `MutationCard` `armed` check reads `confirm.trim() === targetAccountId.trim()
|| confirm.trim() === "CONFIRM"`. The second branch is a universal bypass: an
operator who types `CONFIRM` arms the mutation regardless of which account is
targeted, defeating the type-to-confirm gate's whole purpose (the gate exists
because the comment on line 7 says "the money/license blast radius is why the
confirm gate is mandatory, not cosmetic"). **Fix:** delete the
`|| confirm.trim() === "CONFIRM"` branch; require exact `targetAccountId`
match. `targetAccountId` is always known to the operator (the panel renders it
above the input), so removing the bypass breaks no legitimate path. Update the
line-227 comment to drop the "or the literal CONFIRM" clause.

**2b — mask + reveal the reissued license token** (`mutations.tsx:193-207`).
The `ResultLine` component renders `result.body` via
`JSON.stringify(result.body, null, 2)` in a `<pre>` for both the `warn` and
success branches. When the reissue mutation returns, `result.body` contains the
buyer's license token in plaintext — visible to anyone glancing at the screen,
with no reveal gate, no auto-clear, no copy-then-clear affordance. (React's
text-render already escapes — this is NOT an HTML-injection finding; it is a
"don't render the secret by default" finding.) **Fix shape:** detect a
token-bearing result (the reissue mutation's response shape is known: a
`{ token: string, ... }` body) and route it through a new
`<TokenReveal token={...} />` component that renders masked by default
(`••••••••`), reveals on an explicit "Show" button, and offers "Copy" +
"Clear" (clearing both the revealed state and `result`). The non-token
`result.body` paths keep the existing `<pre>` JSON dump. One runnable check
behind it: a React Testing Library test asserting the token does not appear in
the rendered DOM until "Show" is clicked. `// ponytail: a single new component,
not a generic secret-redaction framework — YAGNI until a second secret-bearing
result exists.`

**2c — validate the `grantee` CLI arg before SQL interpolation**
(`provision-admin-mutation-surface.ts:55-80`, info sev).
The deploy script builds `GRANT admin, admin_write, app TO ${grantee};` from
`process.argv[2]`. It is operator-run (not network-facing), hence info sev, but
the floor (`identity/security.md` Shell execution + the SQL-injection analogue)
is unconditional: never interpolate unsanitized input into a SQL identifier
slot. **Fix shape:** validate `grantee` against the Postgres unquoted-identifier
rule `/^[a-z_][a-z0-9_]*$/` (the only shape this script ever accepts —
`admin_app`, `CURRENT_USER` is the literal default branch and never reaches the
interpolation because it takes the `=== "CURRENT_USER"` early path on line 56);
reject anything else with a clear error before the `Pool` is even constructed.
The interpolated SQL stays a single template string (a parameterized identifier
is not a thing in Postgres — `TO $1` is a syntax error), so the regex gate IS
the parameterization. `// ponytail: identifier regex over a prepared-statement
chase — Postgres doesn't parameterize role names.`

**Verify (whole cluster):**

- `grep -n '"CONFIRM"' apps/admin/src/app/business/mutations.tsx` → empty.
- `bun test apps/admin/src/app/business` → the TokenReveal test passes (token
  absent from DOM until reveal).
- `bun run apps/admin/scripts/provision-admin-mutation-surface.ts
"'; DROP TABLE audit_log; --"` → exits non-zero with the identifier-validation
  error, before any `Pool` query.

### Task 3 — `apps/base/src/server.ts`: Zod `.strict()` for /spend and /mcp bodies (covers be4c8e39e5e20f46)

**File:** `apps/base/src/server.ts:44-49` (/spend) and `:60` (/mcp).

**Root cause:** both bodies are parsed with `(await req.json()) as { ... }` — a
bare type-cast that accepts any shape (including extra fields an attacker
stuffs in, or wrong types that blow up deeper). The same file's auth path uses
proper verification; the body-parse path slipped. The floor
(`identity/security.md` Input validation + `CLAUDE.md` "Zod `.strict()` at
every boundary") is explicit.

**Fix shape:**

- `/spend` → `const SpendBodySchema = z.object({ amount: z.number().int().positive(), idempotencyKey: z.string().trim().min(1).max(256) }).strict();`
  (`amount` is integer credit units per ADR-0007; `asCredits` in `app.ts:72`
  brands it post-parse, so the schema validates the _plain integer_, not the
  brand — matches the existing `SpendInput` type at `app.ts:33`). On
  `.parse` failure, throw `ValidationError` (already imported via the kernel's
  `toErrorResponse` path) so the existing catch on line 67 renders it as a 400.
- `/mcp` → `const McpBodySchema = z.object({ tool: z.string().trim().min(1).max(128), args: z.unknown().optional() }).strict();`
  (matches `mcpQuery(bearer, tool, args)` at `app.ts:47`; `args` stays
  `unknown` because each tool validates its own args inside `handleToolCall`).

**Verify:**

- `bun test apps/base/src` (new boundary test: a `/spend` POST with an extra
  `role` field returns 400, not 200; a `/mcp` POST with `tool: 42` returns
  400; a negative `amount` returns 400).
- `grep -nE 'await req\.json\(\) as ' apps/base/src/server.ts` → empty (no
  remaining bare-cast body parses).

### Task 4 — `packages/mcp-server`: reject wildcard CORS entries (covers 84da56ad5f83faf8)

**File:** `packages/mcp-server/src/http.ts:190-200` (`createHttpMcpHandler`).

**Root cause:** the constructor throws `ConfigError` on an empty
`allowedHosts`/`allowedOrigins` array (good — ADR-0161 decision 4), but never
inspects the _contents_. A caller passing `["*"]` (or a reflected-origin
pattern) sails through, contradicting the floor: "CORS uses an explicit origin
allowlist. Never `*` and never reflected origin."

**Fix shape:** in the constructor, after the two non-empty checks, add a
contents check that throws `ConfigError` if any entry equals `"*"` (literal
wildcard) OR any entry that looks like a reflected-origin pattern (the SDK's
own `allowedOrigins` is a literal-equality list, so any non-absolute-URL string
is suspect — but stay narrow: reject `"*"` and any entry containing a leading
`.`/`*` wildcard char). One guard, one error message citing the floor. `//
ponytail: a 3-line contents check; a full CORS parser is slop — the SDK does
literal equality, not pattern matching.`

**Verify:**

- `bun test packages/mcp-server/src` (new test: `createHttpMcpHandler({ ...,
allowedOrigins: ["*"] })` throws `ConfigError`; `["https://example.com"]`
  does not).
- `grep -n '"\*"' packages/mcp-server/src/http.ts` → no new wildcard accept
  sites.

### Task 5 — `packages/mcp-server`: security-floor headers on every response (covers b272c2150353492e)

**File:** `packages/mcp-server/src/http.ts:222` (error path),
`:253` (SDK `handleRequest` success path), `:277` (`runHttpServer` catch).

**Root cause:** every sibling HTTP surface in the repo (`apps/base/src/server.ts:18-25`)
sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and
`Strict-Transport-Security` on every response. The MCP listener writes its own
responses via raw `res.writeHead`/`res.end` and hands the success path to the
SDK transport, which writes its own headers — none of them carry the floor set.

**Fix shape:** a `SECURITY_HEADERS` constant (the same three lines as
`apps/base/src/server.ts`) plus a `applySecurityHeaders(res:
ServerResponse): void` helper that calls `res.setHeader` for each. Call it:

- Before `res.writeHead` on the error path (line 222) — `writeHead` merges with
  prior `setHeader` calls, so the headers land.
- Before `await transport.handleRequest(...)` on the success path (line 253) —
  the SDK's own `writeHead`/`setHeader` calls merge with, not overwrite, the
  pre-set ones (verify with the curl probe below).
- In the `runHttpServer` catch (line 277) before its `res.writeHead`.

`Strict-Transport-Security` on a plain `node:http` listener is correct: TLS
termination is upstream (the file header says so), and the header is what the
terminating proxy should forward. `// ponytail: setHeader-merge over wrapping
the transport — the SDK owns its own writeHead, a wrapper is slop.`

**Verify:**

- A curl probe against a locally-bound `runHttpServer`:
  `curl -sI -X POST -H "Authorization: Bearer <test-token>" http://<host>:<port>/ | grep -iE 'x-content-type-options|x-frame-options|strict-transport-security'`
  → all three present (the success-path SDK writeHead inherits the pre-set
  headers).
- Same probe against an unauthenticated request (the 401 error path) → all
  three present.
- `bun test packages/mcp-server/src` (extend the existing http test if one
  exists; otherwise add a header-presence assertion).

## Verify (goal-backward)

Re-ask the goal, not the task list: **do the four floor invariants now hold
mechanically across the four surfaces?**

- **Zod boundary:** `grep -nE 'await req\.json\(\) as ' apps/base/src/server.ts`
  → empty; the new boundary test rejects extra fields + wrong types on /spend
  and /mcp.
- **HTML-escape:** `grep -nE '\$\{email\}' apps/site/emails/*.ts` → every hit
  wrapped in `escapeHtml(...)`; the `<script>`-in-email test passes.
- **CORS allowlist:** `createHttpMcpHandler({ allowedOrigins: ["*"] })` throws
  `ConfigError` (test green).
- **Security headers:** the curl probe shows all three floor headers on both the
  success and error paths of the MCP listener.
- **Admin gate:** `grep -n '"CONFIRM"' apps/admin/src/app/business/mutations.tsx`
  → empty; the TokenReveal test shows the token absent until reveal; the
  provision script rejects the SQL-injection string at the identifier gate.
- Full per-package gates green: `bun test apps/base/src`,
  `bun test packages/mcp-server/src`, `bun test apps/admin/src/app/business`,
  `bun test apps/site/emails`.

## Tags fired at SHIP

This spec declares `security` + `auth`. At SHIP both fire:

- **security audit** — every task touches a floor invariant (boundaries, CORS,
  headers, HTML-escape).
- **auth audit** — the admin confirm-bypass (Task 2a) is a
  destructive-mutation authz gate; the mcp CORS allowlist (Task 4) gates
  cross-origin credentialed access. Both are auth-adjacent.

No `data-migration`, `external-system`, `billing`, `secrets`, or `ai` tags
apply — no schema change, no external API call, no money path touched, no
secrets handled, no model invoked.

## Non-goals

- **No ADR.** These are floor re-assertions, not decisions — the floor
  (`identity/security.md`, ADR-0015, ADR-0161) is already locked. An ADR would
  re-litigate settled doctrine.
- **No new shared helper package.** `escapeHtml` and `applySecurityHeaders`
  stay local to their first consumer; promote to `@caisson/kernel` or
  `@caisson/ui` only when a second caller appears (YAGNI).
- **No change to the SDK transport wiring** (ADR-0161 decision 1's "zero edits
  to stdio.ts" stays intact — Task 5 only adds `setHeader` calls around the
  SDK, never wraps or forks the transport).

## Out of scope (other homes)

- **The remaining D1 findings in the ledger** not in the eight above — they
  have their own disposition rows in `outputs/audit/ledger.toml` and ride
  their own waves (see `outputs/specs/audit-v2-remediation/TRIAGE.md`).
- **The buyer-dashboard token-in-DOM finding if one exists outside
  `apps/admin`** — only the admin reissue surface is covered here; a buyer-side
  equivalent would be a separate spec.
- **A generic input-validation middleware for `apps/base`** — the floor is
  enforced at each route handler, not via a shared middleware (YAGNI; two
  routes today).
- **Hardening the `coach` MCP tools' secrets-safe posture** — that is
  `SPEC-mcp-server.md` (harvest slice-2), already locked and shipped.
- **The `apps/site` marketing-site XSS surface at large** — only the two email
  templates are in scope; a sitewide reflected-XSS sweep is its own audit pass.
