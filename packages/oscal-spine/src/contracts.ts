/** Structural evidence-pack projection consumed by the OSCAL adapters. */
export interface OscalEvidencePackFramework {
  readonly id: string;
  readonly title: string;
  readonly version: string;
}

export interface OscalManifestEvidenceItem {
  readonly collectorId: string;
  readonly title: string;
  readonly summary: string;
  readonly status: "pass" | "flagged";
  readonly reason?: string | undefined;
  readonly facts: Readonly<Record<string, unknown>>;
  readonly manualSlots: readonly unknown[];
}

export interface OscalManifestControl {
  readonly controlId: string;
  readonly title: string;
  readonly family: string;
  readonly statement: string;
  readonly crosswalk: readonly unknown[];
  readonly evidence: readonly OscalManifestEvidenceItem[];
  readonly readiness: "ready" | "gap";
}

export interface OscalEvidencePackManifest {
  readonly formatVersion: string;
  readonly tenantId: string;
  readonly framework: OscalEvidencePackFramework;
  readonly chainAnchor: {
    readonly length: number;
    readonly tipHash: string;
    readonly genesisHash?: string | undefined;
  };
  readonly controls: readonly OscalManifestControl[];
  readonly summary: {
    readonly totalControls: number;
    readonly controlsReady: number;
    readonly controlsWithGaps: number;
    readonly totalEvidenceItems: number;
    readonly posture: string;
  };
  readonly crosswalkRollup: unknown;
}

/** Structural framework-catalog projection consumed by the OSCAL catalog exporter. */
export interface OscalFramework {
  readonly id: string;
  readonly title: string;
  readonly version: string;
  readonly controls: readonly {
    readonly id: string;
    readonly title: string;
    readonly family: string;
    readonly statement: string;
    readonly guidance?: string | undefined;
  }[];
}

/** Structural ISO 27001 SoA row consumed by the OSCAL component-definition exporter. */
export interface OscalSoaRow {
  readonly control: string;
  readonly applicable: "applicable" | "unresolved";
  readonly justification: string;
  readonly status: "ready" | "gap" | "unresolved";
  readonly evidencePointer?: string | undefined;
}
