"use client";

// @caisson/demo-registry — the five per-package `./ui` surfaces. Each is a headless-data-in,
// SSR-safe component that renders whatever domain data it is HANDED (no DB, no fetch) — exactly
// the shape a demo needs: static sample data in, a live render out. Only StoreSearch is genuinely
// controlled (query state); it gets a small wrapper.
import { useState } from "react";
import { ChainViewer } from "@caisson/audit-worm/ui";
import { StoreSearch, type StoreSearchResult } from "@caisson/local-store/ui";
import { PromptBrowser } from "@caisson/prompt-registry/ui";
import { UsageChart, type UsageEventDatum } from "@caisson/ai-meter/ui";
import { MatrixViewer } from "@caisson/audit-harness/ui";
import type { CatalogEntry } from "../schema.ts";

const CHAIN_ENTRIES = [
  {
    seq: 0,
    prevHash: null,
    payload: { event: "created" },
    hash: "a".repeat(64),
  },
  {
    seq: 1,
    prevHash: "a".repeat(64),
    payload: { event: "locked" },
    hash: "b".repeat(64),
  },
];

const PROMPT_VERSIONS = [
  {
    id: "p1",
    accountId: "acc_1",
    name: "support.triage",
    version: 3,
    supersedesId: "p0",
    messages: [
      {
        role: "system" as const,
        content: "Classify the ticket by {{category}}.",
      },
      { role: "user" as const, content: "{{ticket}}" },
    ],
    varSpec: { category: "string" as const, ticket: "string" as const },
    createdAt: "2026-07-01T10:00:00Z",
  },
];

const USAGE_EVENTS: UsageEventDatum[] = [
  {
    model: "gpt-5-mini",
    inputTokens: 12_400,
    outputTokens: 3_100,
    costMicroUsd: 42_000,
    credits: 210,
  },
  {
    model: "claude-sonnet-5",
    inputTokens: 8_900,
    outputTokens: 2_200,
    costMicroUsd: 61_000,
    credits: 305,
  },
];

const HARNESS_FINDINGS = [
  {
    id: "f1",
    domain: "packages/kernel",
    dimension: "D1",
    subject: "kernel/timing.ts",
    title: "raw === on token compare",
    severity: "high" as const,
    status: "open" as const,
  },
  {
    id: "f2",
    domain: "apps/admin",
    dimension: "D4",
    subject: "admin/route.ts",
    title: "missing rate limit",
    severity: "warn" as const,
    status: "fixed" as const,
  },
];
const HARNESS_COVERAGE = [
  {
    round: 1,
    domain: "packages/kernel",
    dimension: "D1",
    filesScanned: 12,
    findings: 1,
    executed: true,
  },
  {
    round: 1,
    domain: "apps/admin",
    dimension: "D4",
    filesScanned: 30,
    findings: 1,
    executed: true,
  },
];

function StoreSearchDemo() {
  const [query, setQuery] = useState("audit");
  const results: StoreSearchResult[] = [
    {
      id: "doc-1",
      text: "Kit tiering — staged buildout design notes",
      score: 0.91,
    },
    { id: "doc-2", text: "Audit-worm chain viewer design notes", score: 0.77 },
  ];
  return (
    <StoreSearch
      query={query}
      onQueryChange={setQuery}
      results={results}
      total={128}
    />
  );
}

export const PACKAGE_SURFACE_ENTRIES: CatalogEntry[] = [
  {
    id: "audit-worm.chain-viewer",
    name: "ChainViewer",
    package: "@caisson/audit-worm",
    tier: "per-package-ui",
    description:
      "The hash-chain integrity verdict + entry ledger for a tenant's audit-worm chain.",
    variants: ["verified"],
    render: () => (
      <ChainViewer
        entries={CHAIN_ENTRIES}
        verification={{ valid: true, brokenAt: null }}
      />
    ),
  },
  {
    id: "local-store.store-search",
    name: "StoreSearch",
    package: "@caisson/local-store",
    tier: "per-package-ui",
    description:
      "A controlled query box over the tenant hybrid store + a ranked results table.",
    variants: ["with results"],
    render: () => <StoreSearchDemo />,
  },
  {
    id: "prompt-registry.prompt-browser",
    name: "PromptBrowser",
    package: "@caisson/prompt-registry",
    tier: "per-package-ui",
    description:
      "The append-only prompt catalog — one row per name@version, role shape, var count.",
    variants: ["default"],
    render: () => <PromptBrowser versions={PROMPT_VERSIONS} />,
  },
  {
    id: "ai-meter.usage-chart",
    name: "UsageChart",
    package: "@caisson/ai-meter",
    tier: "per-package-ui",
    description:
      "Metered-usage credits/cost/calls headline, a per-model bar chart, and a numeric table.",
    variants: ["default"],
    render: () => <UsageChart events={USAGE_EVENTS} />,
  },
  {
    id: "audit-harness.matrix-viewer",
    name: "MatrixViewer",
    package: "@caisson/audit-harness",
    tier: "per-package-ui",
    description:
      "The domain × dimension coverage grid atop the reconciled findings ledger.",
    variants: ["with coverage"],
    render: () => (
      <MatrixViewer findings={HARNESS_FINDINGS} coverage={HARNESS_COVERAGE} />
    ),
  },
];
