// Audit surface manifest (ADR-0134 §1). A data-only declared inventory of every auditable domain
// in this monorepo — each domain names the checker(s) that own it. Declaration only: no execution,
// no IO. `checkScope` (./scope-guard.ts) reads `globs` at call time; nothing here runs a checker.

export interface AuditDomain {
  id: string;
  description: string;
  globs: string[];
  checkers: string[];
}

export const AUDIT_DOMAINS: readonly AuditDomain[] = [
  {
    id: "security",
    description:
      "The security floor (secrets, shell exec, auth, headers, timing-safe compares) across every package.",
    globs: ["packages/**/src/**", "services/**/src/**", "apps/**/src/**"],
    checkers: ["gw-security-auditor"],
  },
  {
    id: "rls-tenancy",
    description:
      "Row-level-security + tenant isolation boundary (ADR-0005): the withTenant AsyncLocalStorage seam and every RLS policy.",
    globs: ["packages/tenancy-rls/**", "packages/**/src/**/*rls*"],
    checkers: ["gw-security-auditor"],
  },
  {
    id: "licensing-spdx",
    description:
      "The open↔commercial license boundary (ADR-0094/0097/0111/0136): SPDX headers, LICENSE files, no-depend-up.",
    globs: [
      "packages/*/LICENSE",
      "packages/*/package.json",
      "packages/*/manifest.ts",
    ],
    checkers: ["standards-gate"],
  },
  {
    id: "design-ui",
    description:
      "Design-system + marketing/UI surfaces (ADR-0101): tokens, components, the six deterministic gates.",
    globs: ["packages/ui/**", "apps/site/**", "apps/admin/src/app/design/**"],
    checkers: ["tooling/design-critic"],
  },
  {
    id: "standards-gate",
    description:
      "The one standards gate itself (tsconfig/eslint/test/golden-file/manifest wiring) — the gate that gates every other domain.",
    globs: [
      "tooling/standards-gate/**",
      "tooling/eslint-config/**",
      "tooling/tsconfig/**",
    ],
    checkers: ["standards-gate"],
  },
  {
    id: "evidence-compliance",
    description:
      "Evidence-pack + WORM audit-chain controls (ADR-0057) backing the Compliance edition.",
    globs: [
      "packages/compliance/**",
      "packages/audit-worm/**",
      "packages/field-crypto/**",
    ],
    checkers: ["gw-security-auditor", "standards-gate"],
  },
  // ── Round-2 domains (ADR-0134 §1 extension): the surfaces the first six globs never reached
  // (Python, IaC/CI, telemetry egress, money, the registry edge). Added after the 2026-07-01
  // whole-repo audit's completeness critic flagged the four 0-finding domains as under-scanned. ──
  {
    id: "python-services",
    description:
      "The Python surface (services/support-bot): RAG indirect prompt-injection (untrusted retrieved docs → LLM prompt), Discord authorization on privileged/role-grant commands (ADR-0109 self-assign escalation), secret/token handling, and the timing-safe + authz floor translated to the Python idiom.",
    globs: ["services/support-bot/src/**/*.py"],
    checkers: ["gw-python-pro"],
  },
  {
    id: "iac-authz",
    description:
      "Infra-as-code authorization + container hardening: infra/terraform (the Cloudflare Access allowlist gating admin/license/docs — a live authz control), Dockerfiles (base-image pinning, non-root USER, no build-arg/ENV secret leak), and docker-compose.",
    globs: [
      "infra/terraform/*.tf",
      "infra/**/docker-compose*.yaml",
      "infra/**/docker-compose*.yml",
      "apps/*/Dockerfile",
      "services/*/Dockerfile",
    ],
    checkers: ["gw-security-auditor"],
  },
  {
    id: "ci-supply-chain",
    description:
      "GitHub Actions supply-chain: least-privilege `permissions:` per workflow, self-hosted-runner exposure to untrusted/fork PRs, deploy-railway + publish token handling, and github.event.* interpolation reaching a `run:` shell (script injection).",
    globs: [".github/workflows/*.yml", ".github/workflows/*.yaml"],
    checkers: ["gw-security-auditor"],
  },
  {
    id: "telemetry-egress",
    description:
      "Observability egress boundary (ADR-0117/0185): request-span span-name / http.route path scrubbing, scrub.ts deny-list vs the emitted attribute set, and no license-key / email / token leaking to the external OTLP sink (Grafana).",
    globs: ["packages/observability/src/**"],
    checkers: ["gw-security-auditor"],
  },
  {
    id: "financial-integrity",
    description:
      "Money/credits correctness (ADR-0007): integer-only units (never float), rounding, Stripe→credit-grant idempotency/replay, and the BYOK keySource='tenant' 0-credit metering-bypass path (ADR-0182).",
    globs: [
      "packages/pricebook/src/**",
      "packages/billing/src/**",
      "packages/credits/src/**",
    ],
    checkers: ["gw-security-auditor", "standards-gate"],
  },
  {
    id: "registry-edge",
    description:
      "Registry Worker edge (ADR-0047): offline Ed25519 license verification, entitlement filtering (base ∪ entitled, non-entitled=404, fail-safe-to-base), cache-header safety (private/no-store + Vary), and the deploy-entry composition seam that silently un-filters if the resolver option is dropped.",
    globs: ["registry/worker/**"],
    checkers: ["gw-security-auditor"],
  },
  // ── Round-3 domains: the surfaces the round-2 completeness critic named as still-uncovered —
  // the generator's EMITTED output, authn, email egress, the eval judge, MCP transport,
  // agent governance, and guardrails/prompt rendering. Added 2026-07-01. ──
  {
    id: "generator-templates",
    description:
      "create-caisson EMITTED buyer output: template substitution ({{projectName}} et al.) reaching shell/CI/config contexts un-escaped, emitted CI workflows' token scope, and emitted code inheriting the security floor (no secrets baked, no injection sinks in generated files).",
    globs: ["packages/cli/templates/**", "packages/cli/src/**"],
    checkers: ["gw-security-auditor"],
  },
  {
    id: "auth-boundary",
    description:
      "Authn/authz seam (better-auth): session resolution, JWT verification, WorkOS SSO wiring, org membership resolution (ADR-0176 account_member fail-safe-to-personal), cookie flags, and timing-safe token compares.",
    globs: ["packages/auth/src/**"],
    checkers: ["gw-security-auditor"],
  },
  {
    id: "email-egress",
    description:
      "Email drivers (SMTP/SES/Postmark): header injection via user-controlled to/subject/from, SSRF via configurable endpoints, credential handling, and fetchWithTimeout on outbound calls.",
    globs: ["packages/email/src/**"],
    checkers: ["gw-security-auditor"],
  },
  {
    id: "ai-evals-integrity",
    description:
      "Eval judge integrity: prompt-injection from evaluated content into the judge, score parsing/clamping, fail-open eval gates, and judge-output trust boundaries.",
    globs: ["packages/ai-evals/src/**"],
    checkers: ["gw-security-auditor"],
  },
  {
    id: "mcp-transport",
    description:
      "MCP server transport: per-request auth (Bearer/license), the ADR-0112 rate-limit counter (int8-overflow fail-open class), tool-dispatch entitlement checks, and error responses not leaking internals.",
    globs: ["packages/mcp-server/src/**"],
    checkers: ["gw-security-auditor"],
  },
  {
    id: "agent-governance",
    description:
      "Agentic execution governance: tool-exec sandbox/allowlist enforcement, agent-kernel loop budget/termination, agent-dev side-effect gating — no un-gated shell/network/file capability reachable from model output.",
    globs: [
      "packages/tool-exec/src/**",
      "packages/agent-kernel/src/**",
      "packages/agent-dev/src/**",
    ],
    checkers: ["gw-security-auditor"],
  },
  {
    id: "guardrails-prompts",
    description:
      "Guardrails + prompt registry: PII redaction completeness (deny-list vs allow-list), template render injection (user values into prompt templates), and guard bypass via encoding/casing.",
    globs: ["packages/guardrails/src/**", "packages/prompt-registry/src/**"],
    checkers: ["gw-security-auditor"],
  },
  {
    id: "admin-plane",
    description:
      "apps/admin operator control-plane (live at admin.caisson.sh) + platform-reads: Cloudflare-Access-sole-gate posture (ADR-0107/0140), the RLS-exempt admin DB role (code is the only tenant boundary), Grafana Cloud credential handling (GRAFANA_TOKEN, ADR-0207), mutating command endpoints.",
    globs: [
      "apps/admin/src/**",
      "apps/admin/app/**",
      "apps/admin/lib/**",
      "packages/platform-reads/src/**",
    ],
    checkers: ["gw-security-auditor"],
  },
  {
    id: "metering-byok",
    description:
      "The metering pipeline that feeds billing: ai-meter integer-only units (ADR-0007) + rounding + breaker fail-open/closed, ai-config apiKey material, and the ai-kit BYOK provider path (ADR-0182 $0-credits + ADR-0198 allowlist + baseUrl SSRF guard).",
    globs: [
      "packages/ai-meter/src/**",
      "packages/ai-kit/src/**",
      "packages/ai-config/src/**",
    ],
    checkers: ["gw-security-auditor"],
  },
  {
    id: "destructive-jobs",
    description:
      "Greenfield Stream-B side-effect surface: retention-runner scheduled destructive tenant-data deletes (withTenant scoping = cross-tenant data-loss guard), the jobs side-effect driver, and alerting user-configurable outbound webhooks (SSRF/egress + fetchWithTimeout).",
    globs: [
      "packages/retention-runner/src/**",
      "packages/jobs/src/**",
      "packages/alerting/src/**",
    ],
    checkers: ["gw-security-auditor"],
  },
  {
    id: "composition-roots",
    description:
      "The served-app edition composition roots: the dropped-security-option seam trap (an optional entitlement resolver / rate-limit hook / webhook binding silently disabled when omitted) across every edition's composed app.",
    globs: [
      "apps/base/src/**",
      "apps/agent-dev/src/**",
      "apps/compliance/app/**",
      "apps/compliance/lib/**",
      "apps/ai-kit/app/**",
      "apps/ai-kit/lib/**",
      "apps/local-ai/app/**",
      "apps/local-ai/lib/**",
    ],
    checkers: ["gw-security-auditor"],
  },
  {
    id: "worm-integrity",
    description:
      "packages/audit-worm — the Compliance edition's tamper-evidence core: hash-chain append/verify (silent tamper acceptance = falsely court-admissible evidence), the {account_id}/audit-chain WORM key layout + withTenant tenancy, the retention floor, and S3 creds/egress.",
    globs: ["packages/audit-worm/src/**"],
    checkers: ["gw-security-auditor"],
  },
];
