// Realistic ops/compliance sample data for the /ui component gallery — audit events, usage metrics,
// entitlements, control coverage. Plain data (type-only ui-pro imports, erased at build) so it is
// safe to import from either a server shell or a client island. Deliberately NOT lorem ipsum: the
// gallery sells data-ops components, so the demos show the shapes a buyer actually renders.
import type { BoardCard, TreeNode } from "@caisson/ui-pro/components";

export interface AuditEventRow {
  id: string;
  ts: string;
  actor: string;
  action: string;
  resource: string;
  result: "allow" | "deny";
  latencyMs: number;
}

export const AUDIT_EVENTS: AuditEventRow[] = [
  {
    id: "e1",
    ts: "2026-07-07 09:14:02",
    actor: "admin@acme.io",
    action: "entitlement.grant",
    resource: "org/acme",
    result: "allow",
    latencyMs: 42,
  },
  {
    id: "e2",
    ts: "2026-07-07 09:15:33",
    actor: "svc-worker",
    action: "license.verify",
    resource: "token/9f2a",
    result: "allow",
    latencyMs: 8,
  },
  {
    id: "e3",
    ts: "2026-07-07 09:18:10",
    actor: "u-2291",
    action: "byok.rotate",
    resource: "provider/openai",
    result: "allow",
    latencyMs: 61,
  },
  {
    id: "e4",
    ts: "2026-07-07 09:21:47",
    actor: "u-8830",
    action: "export.audit",
    resource: "org/acme",
    result: "deny",
    latencyMs: 12,
  },
  {
    id: "e5",
    ts: "2026-07-07 09:24:05",
    actor: "admin@acme.io",
    action: "entitlement.revoke",
    resource: "org/beta",
    result: "allow",
    latencyMs: 39,
  },
  {
    id: "e6",
    ts: "2026-07-07 09:29:51",
    actor: "svc-worker",
    action: "webhook.fulfill",
    resource: "paddle/txn_31",
    result: "allow",
    latencyMs: 74,
  },
  {
    id: "e7",
    ts: "2026-07-07 09:33:12",
    actor: "u-2291",
    action: "attestation.sign",
    resource: "worm/anchor-12",
    result: "allow",
    latencyMs: 55,
  },
  {
    id: "e8",
    ts: "2026-07-07 09:37:40",
    actor: "u-4410",
    action: "credit.debit",
    resource: "org/acme",
    result: "deny",
    latencyMs: 5,
  },
  {
    id: "e9",
    ts: "2026-07-07 09:41:19",
    actor: "admin@beta.io",
    action: "member.invite",
    resource: "org/beta",
    result: "allow",
    latencyMs: 48,
  },
  {
    id: "e10",
    ts: "2026-07-07 09:45:02",
    actor: "svc-worker",
    action: "license.verify",
    resource: "token/1c8d",
    result: "allow",
    latencyMs: 9,
  },
  {
    id: "e11",
    ts: "2026-07-07 09:48:26",
    actor: "u-8830",
    action: "policy.update",
    resource: "rls/tenant",
    result: "allow",
    latencyMs: 67,
  },
  {
    id: "e12",
    ts: "2026-07-07 09:52:58",
    actor: "u-4410",
    action: "credit.debit",
    resource: "org/acme",
    result: "allow",
    latencyMs: 6,
  },
];

/** A verified hash chain (genesis + linked entries) for AuditTimeline. */
export const CHAIN_ENTRIES = [
  {
    id: "c1",
    timestamp: "09:14:02",
    action: "Org provisioned",
    actor: "system",
    hash: "a1b2c3d4e5f6a7b8",
  },
  {
    id: "c2",
    timestamp: "09:15:33",
    action: "License issued",
    actor: "svc-worker",
    hash: "b2c3d4e5f6a7b8c9",
    prevHash: "a1b2c3d4e5f6a7b8",
  },
  {
    id: "c3",
    timestamp: "09:24:05",
    action: "Entitlement revoked",
    actor: "admin@acme.io",
    hash: "c3d4e5f6a7b8c9d0",
    prevHash: "b2c3d4e5f6a7b8c9",
    detail: "org/beta — compliance bundle",
  },
  {
    id: "c4",
    timestamp: "09:33:12",
    action: "WORM anchor written",
    actor: "u-2291",
    hash: "d4e5f6a7b8c9d0e1",
    prevHash: "c3d4e5f6a7b8c9d0",
  },
] as const;

/** Weekly platform token usage (millions) — LineChart / AreaChart. */
export const USAGE_WEEKS = [3.1, 4.2, 3.8, 5.6, 6.1, 7.4, 6.9, 8.2];
export const USAGE_WEEK_LABELS = [
  "W1",
  "W2",
  "W3",
  "W4",
  "W5",
  "W6",
  "W7",
  "W8",
];

/** Spend by provider ($ thousands) — BarChart. */
export const SPEND_BY_PROVIDER = [42, 28, 19, 11, 6];
export const PROVIDER_LABELS = [
  "OpenAI",
  "Anthropic",
  "Bedrock",
  "Azure",
  "Ollama",
];

/** p95 gateway latency (ms) over the last 20 minutes — Sparkline. */
export const LATENCY_TREND = [
  61, 58, 64, 72, 69, 63, 60, 66, 74, 71, 65, 62, 59, 63, 68, 70, 64, 61, 58,
  60,
];

/** An OSCAL-style control tree for TreePro. */
export const CONTROL_TREE: TreeNode<{
  label: string;
  status: "met" | "partial" | "gap";
}>[] = [
  {
    id: "ac",
    data: { label: "AC — Access Control", status: "partial" },
    children: [
      { id: "ac-2", data: { label: "AC-2 Account Management", status: "met" } },
      {
        id: "ac-3",
        data: { label: "AC-3 Access Enforcement (RLS)", status: "met" },
      },
      {
        id: "ac-6",
        data: { label: "AC-6 Least Privilege", status: "partial" },
      },
    ],
  },
  {
    id: "au",
    data: { label: "AU — Audit & Accountability", status: "met" },
    children: [
      {
        id: "au-3",
        data: { label: "AU-3 Content of Audit Records", status: "met" },
      },
      { id: "au-9", data: { label: "AU-9 Protection (WORM)", status: "met" } },
    ],
  },
  {
    id: "sc",
    data: { label: "SC — System & Comms Protection", status: "gap" },
    children: [
      {
        id: "sc-12",
        data: { label: "SC-12 Key Management (BYOK)", status: "partial" },
      },
      {
        id: "sc-13",
        data: { label: "SC-13 Cryptographic Protection", status: "gap" },
      },
    ],
  },
];

/** Framework coverage matrix for OpsMatrix. */
export const COVERAGE_COLUMNS = ["SOC 2", "HIPAA", "ISO 27001", "GDPR"];
export const COVERAGE_ROWS = [
  {
    key: "rls",
    label: "Tenant isolation (RLS)",
    cells: ["yes", "yes", "yes", "yes"],
  },
  {
    key: "worm",
    label: "Immutable audit (WORM)",
    cells: ["yes", "yes", "yes", "partial"],
  },
  {
    key: "crypto",
    label: "Field encryption",
    cells: ["yes", "yes", "partial", "yes"],
  },
  {
    key: "retention",
    label: "Retention runner",
    cells: ["partial", "yes", "partial", "yes"],
  },
  {
    key: "dsr",
    label: "Data-subject requests",
    cells: ["no", "partial", "no", "yes"],
  },
] as const;

/** A webhook payload with secret-bearing keys for PayloadViewer. */
export const WEBHOOK_PAYLOAD = {
  event: "purchase.completed",
  occurredAt: "2026-07-07T09:29:51Z",
  data: {
    transactionId: "txn_01kwwqa3dfp8k0v5",
    customer: { id: "cus_8830", email: "buyer@acme.io" },
    items: [
      {
        priceId: "pri_01kwwqa2c799",
        entitlement: "module:ui-pro",
        amount: 12900,
      },
    ],
    signature: "whsec_3f9a2c1b7e",
    // Fixture only — a test-shaped placeholder, never sk_live_* (secret scanners trip on the shape).
    apiKey: "sk_test_REDACTED_SAMPLE",
  },
};

/** Entitlement record before/after a plan upgrade — JSON DiffViewer (secret key masks in both panes). */
export const ENTITLEMENT_BEFORE = {
  plan: "developer",
  seats: 5,
  modules: ["kernel", "auth", "ui"],
  updatesWindowEndsAt: "2027-01-01",
  secret: "lic_old_9f2a",
};
export const ENTITLEMENT_AFTER = {
  plan: "team",
  seats: 10,
  modules: ["kernel", "auth", "ui", "ui-pro"],
  updatesWindowEndsAt: "2027-07-01",
  secret: "lic_new_1c8d",
};

/** An RLS policy before/after a hardening edit — text DiffViewer. */
export const POLICY_BEFORE = `create policy tenant_isolation on audit_event
  for select
  using (tenant_id = current_setting('app.tenant')::uuid);`;
export const POLICY_AFTER = `create policy tenant_isolation on audit_event
  for select
  using (
    tenant_id = current_setting('app.tenant', true)::uuid
    and current_setting('app.tenant', true) is not null
  );`;

/** Remediation tasks for the KanbanBoard (columns + swimlanes). */
export interface TaskCard extends BoardCard {
  title: string;
  owner: string;
}
export const TASK_CARDS: TaskCard[] = [
  {
    id: "t1",
    columnId: "backlog",
    laneId: "compliance",
    title: "Close SC-13 crypto gap",
    owner: "u-2291",
  },
  {
    id: "t2",
    columnId: "doing",
    laneId: "compliance",
    title: "Wire retention runner (HIPAA)",
    owner: "u-8830",
  },
  {
    id: "t3",
    columnId: "review",
    laneId: "compliance",
    title: "OSCAL export for SOC 2",
    owner: "u-2291",
  },
  {
    id: "t4",
    columnId: "backlog",
    laneId: "platform",
    title: "Rotate BYOK provider keys",
    owner: "u-4410",
  },
  {
    id: "t5",
    columnId: "doing",
    laneId: "platform",
    title: "Rate-limit /query edge",
    owner: "svc",
  },
  {
    id: "t6",
    columnId: "done",
    laneId: "platform",
    title: "Deploy admin CF-Access",
    owner: "u-8830",
  },
];
export const TASK_COLUMNS = [
  { id: "backlog", title: "Backlog" },
  { id: "doing", title: "In progress" },
  { id: "review", title: "Review" },
  { id: "done", title: "Done" },
];
export const TASK_LANES = [
  { id: "compliance", title: "Compliance" },
  { id: "platform", title: "Platform" },
];
