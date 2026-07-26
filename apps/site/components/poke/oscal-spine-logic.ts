// Deterministic browser-safe mirror of @caisson/oscal-spine's
// `toOscalAssessmentPlan` for the OSCAL module poke. The real module imports `node:crypto` at
// module scope, so it cannot enter the client bundle; this mirror replaces only that default UUID
// source, and the rendered path always injects a fixed counter anyway. Byte parity against the real
// package is pinned in oscal-spine-logic.test.ts.

export const OSCAL_VERSION = "1.2.2" as const;
export const CAISSON_OSCAL_NS = "https://caisson.sh/ns/oscal";
const AP_IMPORT_SSP_HREF = "urn:caisson:oscal:assessment-plan:no-ssp";

export interface AssessmentFramework {
  readonly id: string;
  readonly title: string;
  readonly version: string;
}

export interface AssessmentPlanOptions {
  readonly now: Date;
  readonly newId?: () => string;
}

export interface AssessmentPlanDocument {
  readonly "assessment-plan": {
    readonly uuid: string;
    readonly metadata: {
      readonly title: string;
      readonly "last-modified": string;
      readonly version: string;
      readonly "oscal-version": typeof OSCAL_VERSION;
      readonly props: readonly {
        readonly name: string;
        readonly ns: string;
        readonly value: string;
      }[];
    };
    readonly "import-ssp": { readonly href: string };
    readonly "reviewed-controls": {
      readonly "control-selections": readonly [{ readonly "include-all": {} }];
    };
  };
}

export const SAMPLE_FRAMEWORKS: readonly AssessmentFramework[] = [
  {
    id: "soc2-tsc",
    title: "SOC 2 — Trust Services Criteria",
    version: "2024.1",
  },
  {
    id: "hipaa-security",
    title: "HIPAA Security Rule",
    version: "2024.1",
  },
  {
    id: "eu-ai-act",
    title: "EU AI Act — High-Risk Obligations",
    version: "2024.1",
  },
];

export const SAMPLE_NOW = new Date("2026-07-25T12:00:00.000Z");

export function makeCounterIds(): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  };
}

export function toOscalAssessmentPlan(
  framework: AssessmentFramework,
  options: AssessmentPlanOptions,
): AssessmentPlanDocument {
  if (Number.isNaN(options.now.getTime())) {
    throw new Error("oscal assessment-plan requires a valid `now` instant");
  }
  const newId = options.newId ?? (() => crypto.randomUUID());
  return {
    "assessment-plan": {
      uuid: newId(),
      metadata: {
        title: `Assessment Plan — ${framework.title}`,
        "last-modified": options.now.toISOString(),
        version: framework.version,
        "oscal-version": OSCAL_VERSION,
        props: [
          {
            name: "caisson-framework-id",
            ns: CAISSON_OSCAL_NS,
            value: framework.id,
          },
        ],
      },
      "import-ssp": { href: AP_IMPORT_SSP_HREF },
      "reviewed-controls": { "control-selections": [{ "include-all": {} }] },
    },
  };
}
