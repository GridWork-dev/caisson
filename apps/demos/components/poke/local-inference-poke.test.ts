import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { describe, expect, mock, test } from "bun:test";
import {
  nodeBuiltinTaint,
  nodeGlobalTaint,
} from "@caisson-sh/testing/module-graph";
import { renderIntoJsdom } from "@caisson-sh/testing";
import {
  DEFAULT_ONNX_MODEL,
  EMBEDDING_DIM,
  StubInferenceBackend,
} from "@caisson-sh/local-inference/browser";

import LocalInferencePoke, {
  computeSampleEmbedding,
  evaluateEgress,
} from "./local-inference-poke";

const WORKSPACE_ROOT = join(import.meta.dir, "../../../..");
const POKE_ENTRY = join(import.meta.dir, "local-inference-poke.tsx");
const RETIRED_MIRROR = join(import.meta.dir, "local-inference-logic.ts");

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (reason: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function editPrompt(
  document: Document,
  act: (fn: () => void) => void,
  value: string,
): void {
  const textarea = document.querySelector("textarea");
  if (!(textarea instanceof document.defaultView!.HTMLTextAreaElement)) {
    throw new Error("local-inference poke textarea not found");
  }
  const setter = Object.getOwnPropertyDescriptor(
    document.defaultView!.HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  if (setter === undefined)
    throw new Error("textarea value setter unavailable");
  act(() => {
    setter.call(textarea, value);
    textarea.dispatchEvent(
      new document.defaultView!.Event("input", { bubbles: true }),
    );
    textarea.dispatchEvent(
      new document.defaultView!.Event("change", { bubbles: true }),
    );
  });
}

function renderedBars(document: Document): number {
  return document.querySelectorAll('div[aria-hidden="true"] > span[style]')
    .length;
}

describe("the local-inference poke runs the package's browser-safe stub", () => {
  const walk = nodeBuiltinTaint(POKE_ENTRY, { workspaceRoot: WORKSPACE_ROOT });

  test("the client graph reaches the real browser entry without node taint", () => {
    expect(walk.offenders).toEqual([]);
    expect(walk.unresolved).toEqual([]);
    expect(walk.files).toContain("packages/local-inference/src/browser.ts");
    expect(walk.files).toContain("packages/local-inference/src/stub.ts");
    expect(
      nodeGlobalTaint(walk.files, { workspaceRoot: WORKSPACE_ROOT }),
    ).toEqual([]);
    expect(walk.external).toEqual(["lucide-react", "radix-ui", "react", "zod"]);
  });

  test("the mirror is deleted and the component imports only the package browser entry", () => {
    const source = readFileSync(POKE_ENTRY, "utf8");
    expect(existsSync(RETIRED_MIRROR)).toBe(false);
    expect(source).toMatch(/from "@caisson-sh\/local-inference\/browser";/);
    expect(source).not.toMatch(/from "\.\/local-inference-logic"/);
    expect(source).not.toContain('outcome: "egressed"');
    expect(source).not.toContain("Crossed the boundary");
    expect(source).not.toContain("requests: 1");
  });

  test("ONNX, rented transports, credentials, SigV4, and metering stay out", () => {
    for (const excluded of [
      "onnx-backend.ts",
      "rented-backend.ts",
      "openrouter-transport.ts",
      "azure-openai-transport.ts",
      "bedrock-transport.ts",
      "sigv4.ts",
    ]) {
      expect(walk.files).not.toContain(
        `packages/local-inference/src/${excluded}`,
      );
    }
    expect(walk.files).not.toContain(
      "packages/local-privacy/src/egress-guard.ts",
    );
  });

  test("the real stub preserves the package geometry, model coordinates, and golden", async () => {
    const stub = new StubInferenceBackend({ dim: 8 });
    expect(DEFAULT_ONNX_MODEL.dim).toBe(EMBEDDING_DIM);
    expect(stub.model).toBe("caisson-stub-embed");
    expect(Array.from(await stub.embed("offline-first"))).toEqual([
      0.13572371006011963, 0.40440019965171814, -0.6178563833236694,
      -0.30705133080482483, -0.25519251823425293, -0.04712666571140289,
      0.3809182941913605, -0.3599577844142914,
    ]);
  });

  test("the component adapters execute the real async stub and privacy guard", async () => {
    expect((await computeSampleEmbedding("offline-first")).length).toBe(
      EMBEDDING_DIM,
    );
    expect(evaluateEgress("on-device", false)).toEqual({
      outcome: "local",
      host: null,
      sinkKind: null,
      requests: 0,
      usage: null,
    });
    expect(evaluateEgress("rented", false)).toMatchObject({
      outcome: "blocked",
      requests: 0,
    });
    expect(evaluateEgress("rented", true)).toEqual({
      outcome: "allowed",
      host: "api.rented-inference.example",
      sinkKind: "rented-backend",
      requests: 0,
      usage: null,
    });
  });

  test("clears the old vector on prompt edits and ignores stale async completions", async () => {
    const originalEmbed = StubInferenceBackend.prototype.embed;
    const calls: Array<{
      readonly prompt: string;
      readonly run: Deferred<Float32Array>;
    }> = [];
    StubInferenceBackend.prototype.embed = mock((prompt: string) => {
      const run = deferred<Float32Array>();
      calls.push({ prompt, run });
      return run.promise;
    }) as typeof StubInferenceBackend.prototype.embed;

    const rendered = renderIntoJsdom(createElement(LocalInferencePoke));
    try {
      expect(calls).toHaveLength(1);
      expect(rendered.container.textContent).toContain(
        "Computing sample embedding",
      );

      await rendered.act(async () => {
        calls[0]!.run.resolve(Float32Array.from([0.25, 0.75]));
        await calls[0]!.run.promise;
      });
      expect(rendered.container.textContent).toContain(
        "Sample embedding computed",
      );
      expect(renderedBars(rendered.document)).toBeGreaterThan(0);

      editPrompt(rendered.document, rendered.act, "second prompt");
      expect(calls.at(-1)?.prompt).toBe("second prompt");
      expect(rendered.container.textContent).toContain(
        "Computing sample embedding",
      );
      expect(renderedBars(rendered.document)).toBe(0);

      editPrompt(rendered.document, rendered.act, "current prompt");
      expect(calls.at(-1)?.prompt).toBe("current prompt");
      await rendered.act(async () => {
        calls[1]!.run.resolve(Float32Array.from([1, 0]));
        await calls[1]!.run.promise;
      });
      expect(rendered.container.textContent).toContain(
        "Computing sample embedding",
      );
      expect(renderedBars(rendered.document)).toBe(0);

      await rendered.act(async () => {
        calls[2]!.run.resolve(Float32Array.from([0, 1]));
        await calls[2]!.run.promise;
      });
      expect(rendered.container.textContent).toContain(
        "Sample embedding computed",
      );
      expect(renderedBars(rendered.document)).toBeGreaterThan(0);
    } finally {
      rendered.unmount();
      StubInferenceBackend.prototype.embed = originalEmbed;
    }
  });

  test("renders a bounded error when the async stub rejects", async () => {
    const originalEmbed = StubInferenceBackend.prototype.embed;
    StubInferenceBackend.prototype.embed = mock(() =>
      Promise.reject(new Error("sample backend offline")),
    ) as typeof StubInferenceBackend.prototype.embed;

    const rendered = renderIntoJsdom(createElement(LocalInferencePoke));
    try {
      await rendered.act(
        () => new Promise((resolve) => setTimeout(resolve, 0)),
      );
      expect(rendered.container.textContent).toContain(
        "Sample embedding unavailable",
      );
      expect(rendered.container.textContent).not.toContain(
        "Sample embedding computed",
      );
      expect(renderedBars(rendered.document)).toBe(0);
    } finally {
      rendered.unmount();
      StubInferenceBackend.prototype.embed = originalEmbed;
    }
  });
});
