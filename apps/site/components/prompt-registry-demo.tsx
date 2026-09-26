"use client";

// The prompt-registry module's `component` media slide (ADR-0308 full-depth) — the module's own
// shipped surface `@caisson-sh/prompt-registry/ui` <PromptBrowser>, rendered live over sample append-
// only prompt versions. The component derives the distinct-name / total-version headline, the role
// chips, the variable count, and the first-message preview. Presentational still-frame — no filter/
// paging wired. Loaded via next/dynamic (ssr: false) so this commercial-tier tree never lands in the
// shared client bundle. Source: packages/prompt-registry/src/ui/prompt-browser.tsx.
import { PromptBrowser } from "@caisson-sh/prompt-registry/ui";
import type { PromptVersion } from "@caisson-sh/prompt-registry";

import { MediaFrame } from "./media-frame";

const VERSIONS: readonly PromptVersion[] = [
  {
    id: "pv_3",
    accountId: "acme",
    name: "support-triage",
    version: 3,
    supersedesId: "pv_2",
    messages: [
      {
        role: "system",
        content:
          "You are a support triage assistant for {{product}}. Classify the ticket by {{severity}}.",
      },
      { role: "user", content: "{{ticket}}" },
    ],
    varSpec: { product: "string", severity: "string", ticket: "string" },
    createdAt: "2026-07-07T11:20:00Z",
  },
  {
    id: "pv_4",
    accountId: "acme",
    name: "changelog-writer",
    version: 1,
    supersedesId: null,
    messages: [
      {
        role: "system",
        content:
          "Summarize the diff into a single changelog entry, past tense.",
      },
      { role: "user", content: "{{diff}}" },
    ],
    varSpec: { diff: "string" },
    createdAt: "2026-07-06T09:10:00Z",
  },
  {
    id: "pv_5",
    accountId: "acme",
    name: "eval-grader",
    version: 2,
    supersedesId: "pv_1",
    messages: [
      {
        role: "system",
        content: "Grade the response against {{rubric}}, 1-5.",
      },
      { role: "user", content: "{{response}}" },
    ],
    varSpec: { rubric: "string", response: "string" },
    createdAt: "2026-07-05T18:40:00Z",
  },
];

export default function PromptRegistryDemo() {
  return (
    <MediaFrame label="Registry browser">
      <div style={{ padding: "var(--cs-space-6)" }}>
        <PromptBrowser versions={VERSIONS} />
      </div>
    </MediaFrame>
  );
}
