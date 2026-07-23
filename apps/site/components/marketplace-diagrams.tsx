import type { DiagramKey } from "@/lib/media-manifest";

import {
  AgentKernelSheet,
  AgentRunnerSheet,
  AgentTrajectorySheet,
} from "./schematic-sheets-agent";
import {
  AiEvalsSheet,
  AiMeterSheet,
  GuardrailsSheet,
  PromptRegistrySheet,
} from "./schematic-sheets-ai";
import {
  AgenticDevCrossSection,
  AiProductionCrossSection,
  EverythingCrossSection,
  LocalFirstCrossSection,
  ProvenanceCrossSection,
} from "./schematic-sheets-bundles";
import {
  AccessReviewSheet,
  ComplianceCoreSheet,
  FrameworksPackSheet,
  RiskRegisterSheet,
  TrustPageSheet,
} from "./schematic-sheets-compliance";
import {
  LocalPrivacySheet,
  OrgControlsSheet,
  RetentionRunnerSheet,
  ToolExecSheet,
} from "./schematic-sheets-guard";
import {
  LocalInferenceSheet,
  LocalStoreSheet,
  LocalSyncSheet,
  UiProSheet,
} from "./schematic-sheets-local";
import {
  AlertingSheet,
  BillingOrchestrationSheet,
  CreditsSheet,
  SigningPrimitiveSheet,
} from "./schematic-sheets-money";
import {
  AuditWormSheet,
  ComplianceCrossSection,
  FieldCryptoSheet,
} from "./schematics";

// The carousel's diagram registry. Post-migration (ADR-0377 migrate-all, executed by the ADR-0378
// wave) every authored diagram is a bespoke schematic: a blueprint linework sheet per module, a
// cross-section strata sheet per bundle, all built on the shared primitive vocabulary in
// `schematics.tsx`. The 24 shared mechanism diagrams and their StageFlow/Note template that once
// lived in this file retired when every page gained its bespoke sheet; recover them from git
// history if ever needed.

const DIAGRAMS: Record<DiagramKey, () => React.ReactElement> = {
  "schematic-field-crypto": FieldCryptoSheet,
  "schematic-audit-worm": AuditWormSheet,
  "schematic-compliance": ComplianceCrossSection,
  "schematic-ai-meter": AiMeterSheet,
  "schematic-guardrails": GuardrailsSheet,
  "schematic-prompt-registry": PromptRegistrySheet,
  "schematic-ai-evals": AiEvalsSheet,
  "schematic-signing-primitive": SigningPrimitiveSheet,
  "schematic-credits": CreditsSheet,
  "schematic-billing-orchestration": BillingOrchestrationSheet,
  "schematic-alerting": AlertingSheet,
  "schematic-tool-exec": ToolExecSheet,
  "schematic-local-privacy": LocalPrivacySheet,
  "schematic-org-controls": OrgControlsSheet,
  "schematic-retention-runner": RetentionRunnerSheet,
  "schematic-local-store": LocalStoreSheet,
  "schematic-local-sync": LocalSyncSheet,
  "schematic-local-inference": LocalInferenceSheet,
  "schematic-ui-pro": UiProSheet,
  "schematic-agent-kernel": AgentKernelSheet,
  "schematic-agent-runner": AgentRunnerSheet,
  "schematic-agent-trajectory": AgentTrajectorySheet,
  "schematic-compliance-core": ComplianceCoreSheet,
  "schematic-frameworks-pack": FrameworksPackSheet,
  "schematic-access-review": AccessReviewSheet,
  "schematic-risk-register": RiskRegisterSheet,
  "schematic-trust-page": TrustPageSheet,
  "schematic-ai-production": AiProductionCrossSection,
  "schematic-local-first": LocalFirstCrossSection,
  "schematic-agentic-dev": AgenticDevCrossSection,
  "schematic-provenance": ProvenanceCrossSection,
  "schematic-everything": EverythingCrossSection,
};

export function MarketplaceDiagram({ name }: { name: DiagramKey }) {
  const D = DIAGRAMS[name];
  return <D />;
}
