/**
 * EU AI Act — RESERVED framework slot (ADR-0057). NAMED MANIFEST ONLY — NO control content.
 *
 * The EU AI Act high-risk obligations are not yet authored as canonical controls. This file
 * therefore does NOT call `defineFramework` (which requires at least one control) and ships NO
 * golden catalog (golden:null). It reserves the framework id/title and records the Annex IV
 * (technical documentation) section outline that future canonical controls will be authored and
 * crosswalked against.
 *
 * Clean-room note: the entries below are short, own-authored descriptions of the Annex IV section
 * structure used purely as an authoring outline. The regulation itself is public law; we copy no
 * third-party catalog content (TM-J / flag-never-guess). When the controls are authored (a later
 * task), this slot is replaced by a `defineFramework` pack with its own catalog golden.
 */

/**
 * A framework that is named and reserved but carries no authored control content yet. Distinct from
 * `Framework` (which mandates >=1 control): a reserved slot is a manifest concern, not a catalog.
 */
export interface ReservedFramework {
  /** Kebab-case framework slug — matches the file name and the future `defineFramework` id. */
  readonly id: string;
  /** Human title. */
  readonly title: string;
  /** Always `"reserved"` while no controls are authored. */
  readonly status: "reserved";
  /** Why this slot carries no controls yet — surfaced to the catalog manifest and tests. */
  readonly reason: string;
  /**
   * Structural authoring outline only (Annex IV technical-documentation sections). These are NOT
   * controls and carry no requirement statements; they exist to scope future clean-room authoring.
   */
  readonly outline: readonly {
    readonly section: string;
    readonly heading: string;
  }[];
}

/**
 * The reserved EU AI Act slot. `golden:null` (no catalog fixture) — its only assertions are that it
 * stays a reservation (no controls) and that its id/title are stable for the manifest.
 */
export const euAiAct: ReservedFramework = {
  id: "eu-ai-act",
  title: "EU AI Act — High-Risk System Obligations (reserved)",
  status: "reserved",
  reason:
    "Controls not yet authored. Reserved as a named slot; Annex IV outline scopes future " +
    "clean-room authoring. No control content, no catalog golden.",
  outline: [
    { section: "1", heading: "General description of the AI system" },
    {
      section: "2",
      heading:
        "Detailed description of the system's elements and its development process",
    },
    {
      section: "3",
      heading: "Monitoring, functioning, and control of the AI system",
    },
    {
      section: "4",
      heading: "Appropriateness of the performance metrics",
    },
    { section: "5", heading: "Risk management system" },
    {
      section: "6",
      heading: "Relevant changes made over the system's lifecycle",
    },
    { section: "7", heading: "Harmonised standards applied" },
    { section: "8", heading: "EU declaration of conformity" },
    {
      section: "9",
      heading: "Post-market monitoring plan and performance evaluation",
    },
  ],
};
