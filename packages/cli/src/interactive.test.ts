// `runWizard` branching (ADR-0262/ADR-0268). `cli.test.ts` locks the
// arming rule (when this module is loaded at all) by injecting a fake `loadInteractive` — it
// never exercises this module's OWN prompt-sequencing logic. These tests do, by stubbing
// `@clack/prompts` (queue-driven fakes) so the real `runWizard` code runs against canned answers.
//
// `mock.module` replaces `@clack/prompts` in Bun's process-wide module registry — it must be
// registered BEFORE `./interactive.ts` is first imported, so every test imports it via a dynamic
// `await import(...)` inside the test body (never a static top-level import here).
import { describe, expect, mock, test } from "bun:test";
import { loadRegistryIndex } from "@caisson-sh/registry-schema";

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
  license: "Apache-2.0" as const,
  dependencies: [] as never[],
  stability: "alpha" as const,
  description,
});

const INDEX = loadRegistryIndex({
  schemaVersion: 1,
  modules: [
    {
      id: "@caisson-sh/kernel",
      latest: "0.3.0",
      versions: [
        {
          version: "0.3.0",
          manifest: manifest("@caisson-sh/kernel", "the kernel module"),
          publishedAt: "2026-06-27T00:00:00.000Z",
          gateAttestation: "ci@x",
        },
      ],
    },
  ],
});

describe("runWizard", () => {
  test("pure run: prompts name, modules, deploy(none) — no deployTarget in raw", async () => {
    resetQueues();
    selectQueue = ["none"];
    textQueue = ["acme-app"];
    multiselectQueue = [[{ id: "@caisson-sh/kernel", version: "0.3.0" }]];

    const { runWizard } = await import("./interactive.ts");
    const result = await runWizard(INDEX, { modules: [], pureRun: true });

    expect(result).toEqual({
      projectName: "acme-app",
      modules: [{ id: "@caisson-sh/kernel", version: "0.3.0" }],
    });
    expect(selectMock).toHaveBeenCalledTimes(1); // the deploy step only
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
        value: { id: "@caisson-sh/kernel", version: "0.3.0" },
        label: "@caisson-sh/kernel",
        hint: "the kernel module",
      },
    ]);
  });

  test("pure run + a chosen deploy target lands in raw.deployTarget", async () => {
    resetQueues();
    selectQueue = ["railway"];
    textQueue = ["acme-app"];
    multiselectQueue = [[{ id: "@caisson-sh/kernel", version: "0.3.0" }]];

    const { runWizard } = await import("./interactive.ts");
    const result = await runWizard(INDEX, { modules: [], pureRun: true });

    expect(result).toEqual({
      projectName: "acme-app",
      modules: [{ id: "@caisson-sh/kernel", version: "0.3.0" }],
      deployTarget: "railway",
    });
  });

  test("framework (ADR-0287) is carried through untouched — never its own prompt", async () => {
    resetQueues();
    textQueue = ["gapfilled-name"];
    multiselectQueue = [[{ id: "@caisson-sh/kernel", version: "0.3.0" }]];

    const { runWizard } = await import("./interactive.ts");
    const result = await runWizard(INDEX, {
      framework: "next",
      modules: [],
      pureRun: false,
    });

    expect(result).toEqual({
      projectName: "gapfilled-name",
      modules: [{ id: "@caisson-sh/kernel", version: "0.3.0" }],
      framework: "next",
    });
    expect(selectMock).not.toHaveBeenCalled();
  });

  test("an already-supplied projectName is never re-prompted", async () => {
    resetQueues();
    multiselectQueue = [[{ id: "@caisson-sh/kernel", version: "0.3.0" }]];

    const { runWizard } = await import("./interactive.ts");
    const result = await runWizard(INDEX, {
      projectName: "already-set",
      modules: [],
      pureRun: false,
    });

    expect(result).toEqual({
      projectName: "already-set",
      modules: [{ id: "@caisson-sh/kernel", version: "0.3.0" }],
    });
    expect(textMock).not.toHaveBeenCalled();
  });
});
