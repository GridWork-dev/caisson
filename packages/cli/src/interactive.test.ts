// `runWizard`/`promptSampleProjectName` branching (ADR-0262/ADR-0268). `cli.test.ts` locks the
// arming rule (when this module is loaded at all) by injecting a fake `loadInteractive` — it
// never exercises this module's OWN prompt-sequencing logic. These tests do, by stubbing
// `@clack/prompts` (queue-driven fakes) so the real `runWizard` code runs against canned answers.
//
// `mock.module` replaces `@clack/prompts` in Bun's process-wide module registry — it must be
// registered BEFORE `./interactive.ts` is first imported, so every test imports it via a dynamic
// `await import(...)` inside the test body (never a static top-level import here).
import { describe, expect, mock, test } from "bun:test";
import { loadRegistryIndex } from "@caisson/registry-schema";

let selectQueue: unknown[] = [];
let multiselectQueue: unknown[] = [];
let textQueue: unknown[] = [];
const CANCEL = Symbol("cancel");

const selectMock = mock(async (_opts: unknown) => selectQueue.shift());
const multiselectMock = mock(async (_opts: unknown) =>
  multiselectQueue.shift(),
);
const textMock = mock(async (_opts: unknown) => textQueue.shift());

mock.module("@clack/prompts", () => ({
  select: selectMock,
  multiselect: multiselectMock,
  text: textMock,
  cancel: () => undefined,
  isCancel: (v: unknown) => v === CANCEL,
}));

function resetQueues(): void {
  selectQueue = [];
  multiselectQueue = [];
  textQueue = [];
  selectMock.mockClear();
  multiselectMock.mockClear();
  textMock.mockClear();
}

const manifest = (id: string, description: string) => ({
  id,
  version: "0.3.0",
  kind: "primitive" as const,
  editions: [] as never[],
  tier: "paid" as const,
  priceCents: 100,
  license: "LicenseRef-Caisson-Commercial" as const,
  dependencies: [] as never[],
  entry: "src/index.ts",
  agents: "AGENTS.md",
  golden: null,
  stability: "alpha" as const,
  description,
});

const INDEX = loadRegistryIndex({
  schemaVersion: 1,
  modules: [
    {
      id: "@caisson/kernel",
      latest: "0.3.0",
      versions: [
        {
          version: "0.3.0",
          manifest: manifest("@caisson/kernel", "the kernel module"),
          publishedAt: "2026-06-27T00:00:00.000Z",
          gateAttestation: "ci@x",
        },
      ],
    },
  ],
});

describe("runWizard", () => {
  test("pure run + licensed mode: prompts name, modules, deploy(none) — no deployTarget in raw", async () => {
    resetQueues();
    selectQueue = ["licensed", "none"];
    textQueue = ["acme-app"];
    multiselectQueue = [[{ id: "@caisson/kernel", version: "0.3.0" }]];

    const { runWizard } = await import("./interactive.ts");
    const result = await runWizard(INDEX, { modules: [], pureRun: true });

    expect(result).toEqual({
      kind: "licensed",
      raw: {
        projectName: "acme-app",
        modules: [{ id: "@caisson/kernel", version: "0.3.0" }],
      },
    });
    expect(selectMock).toHaveBeenCalledTimes(2); // mode question + deploy step
    expect(textMock).toHaveBeenCalledTimes(1);
    expect(multiselectMock).toHaveBeenCalledTimes(1);

    // The multiselect options are built from the registry index: id as label, manifest
    // description as hint, version pinned to the entry's `latest`.
    const options = multiselectMock.mock.calls[0]?.[0] as {
      options: {
        value: { id: string; version: string };
        label: string;
        hint?: string;
      }[];
    };
    expect(options.options).toEqual([
      {
        value: { id: "@caisson/kernel", version: "0.3.0" },
        label: "@caisson/kernel",
        hint: "the kernel module",
      },
    ]);
  });

  test("pure run + licensed mode + a chosen deploy target lands in raw.deployTarget", async () => {
    resetQueues();
    selectQueue = ["licensed", "railway"];
    textQueue = ["acme-app"];
    multiselectQueue = [[{ id: "@caisson/kernel", version: "0.3.0" }]];

    const { runWizard } = await import("./interactive.ts");
    const result = await runWizard(INDEX, { modules: [], pureRun: true });

    expect(result).toEqual({
      kind: "licensed",
      raw: {
        projectName: "acme-app",
        modules: [{ id: "@caisson/kernel", version: "0.3.0" }],
        deployTarget: "railway",
      },
    });
  });

  test("pure run + sample mode: only prompts the project name — no modules/deploy question", async () => {
    resetQueues();
    selectQueue = ["sample"];
    textQueue = ["sample-app"];

    const { runWizard } = await import("./interactive.ts");
    const result = await runWizard(INDEX, { modules: [], pureRun: true });

    expect(result).toEqual({ kind: "sample", projectName: "sample-app" });
    expect(selectMock).toHaveBeenCalledTimes(1); // the mode question only
    expect(multiselectMock).not.toHaveBeenCalled();
  });

  test("a partial invocation (edition given) gap-fills name+modules WITHOUT the mode/deploy questions", async () => {
    resetQueues();
    textQueue = ["gapfilled-name"];
    multiselectQueue = [[{ id: "@caisson/kernel", version: "0.3.0" }]];

    const { runWizard } = await import("./interactive.ts");
    const result = await runWizard(INDEX, {
      edition: "compliance",
      modules: [],
      pureRun: false,
    });

    expect(result).toEqual({
      kind: "licensed",
      raw: {
        projectName: "gapfilled-name",
        edition: "compliance",
        modules: [{ id: "@caisson/kernel", version: "0.3.0" }],
      },
    });
    expect(selectMock).not.toHaveBeenCalled();
  });

  test("an already-supplied projectName is never re-prompted", async () => {
    resetQueues();
    multiselectQueue = [[{ id: "@caisson/kernel", version: "0.3.0" }]];

    const { runWizard } = await import("./interactive.ts");
    const result = await runWizard(INDEX, {
      projectName: "already-set",
      modules: [],
      pureRun: false,
    });

    expect(result).toEqual({
      kind: "licensed",
      raw: {
        projectName: "already-set",
        modules: [{ id: "@caisson/kernel", version: "0.3.0" }],
      },
    });
    expect(textMock).not.toHaveBeenCalled();
  });
});

describe("promptSampleProjectName", () => {
  test("returns the prompted name", async () => {
    resetQueues();
    textQueue = ["sample-name"];
    const { promptSampleProjectName } = await import("./interactive.ts");
    expect(await promptSampleProjectName()).toBe("sample-name");
  });
});

describe("DEFAULT_SAMPLE_ID", () => {
  test("matches sample-templates.ts's allowlist (single sample today)", async () => {
    const { DEFAULT_SAMPLE_ID } = await import("./interactive.ts");
    const { SAMPLE_TEMPLATES } = await import("./sample-templates.ts");
    expect(DEFAULT_SAMPLE_ID).toBe(SAMPLE_TEMPLATES[0]);
  });
});
