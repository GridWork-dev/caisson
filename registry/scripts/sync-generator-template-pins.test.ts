import { afterEach, expect, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { syncGeneratorTemplatePins } from "./sync-generator-template-pins";

const roots: string[] = [];
const NEXT = "packages/cli/templates/framework/next/package.json";
const SAMPLE = "packages/cli/templates/eu-ai-act-sample/package.json";
function write(root: string, path: string, value: unknown): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), `${JSON.stringify(value, null, 2)}\n`);
}
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "caisson-generator-pins-"));
  roots.push(root);
  write(root, NEXT, {
    scripts: { build: "next build" },
    dependencies: {
      "@caisson/kernel": "^1.0.0",
      "@caisson/auth": "^1.0.0",
      next: "^16.0.0",
    },
    devDependencies: { typescript: "^6.0.0" },
  });
  write(root, SAMPLE, {
    name: "{{projectName}}",
    dependencies: { "@caisson/kernel": "^1.0.0" },
  });
  write(root, "packages/kernel/package.json", {
    name: "@caisson/kernel",
    version: "2.3.4",
  });
  write(root, "packages/auth/package.json", {
    name: "@caisson/auth",
    version: "3.4.5",
  });
  return root;
}
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

test("derives both templates' pins, preserving unrelated manifest fields", () => {
  const root = fixture();
  expect(syncGeneratorTemplatePins(root)).toEqual([NEXT, SAMPLE]);
  expect(JSON.parse(readFileSync(join(root, NEXT), "utf8"))).toEqual({
    scripts: { build: "next build" },
    dependencies: {
      "@caisson/kernel": "^2.3.4",
      "@caisson/auth": "^3.4.5",
      next: "^16.0.0",
    },
    devDependencies: { typescript: "^6.0.0" },
  });
  expect(JSON.parse(readFileSync(join(root, SAMPLE), "utf8"))).toEqual({
    name: "{{projectName}}",
    dependencies: { "@caisson/kernel": "^2.3.4" },
  });
  const before = [NEXT, SAMPLE].map((path) =>
    readFileSync(join(root, path), "utf8"),
  );
  expect(syncGeneratorTemplatePins(root)).toEqual([]);
  expect(
    [NEXT, SAMPLE].map((path) => readFileSync(join(root, path), "utf8")),
  ).toEqual(before);
});

test("validates the second template before writing the first", () => {
  const root = fixture();
  write(root, SAMPLE, { dependencies: { "@caisson/missing": "^1.0.0" } });
  const before = readFileSync(join(root, NEXT), "utf8");
  expect(() => syncGeneratorTemplatePins(root)).toThrow();
  expect(readFileSync(join(root, NEXT), "utf8")).toBe(before);
});

test("rejects a workspace with the wrong identity or version", () => {
  const root = fixture();
  write(root, "packages/kernel/package.json", {
    name: "@caisson/not-kernel",
    version: "2.3.4",
  });
  expect(() => syncGeneratorTemplatePins(root)).toThrow(
    "Workspace name mismatch",
  );
  write(root, "packages/kernel/package.json", {
    name: "@caisson/kernel",
    version: "workspace:*",
  });
  expect(() => syncGeneratorTemplatePins(root)).toThrow();
});

test("rejects dependency traversal and a template with no workspace pins", () => {
  const root = fixture();
  // Deliberately hostile fixture: no dependency name may escape packages/.
  write(root, SAMPLE, { dependencies: { "@caisson/../../outside": "^1.0.0" } });
  expect(() => syncGeneratorTemplatePins(root)).toThrow(
    "Invalid workspace dependency",
  );
  write(root, SAMPLE, { dependencies: { next: "^16.0.0" } });
  expect(() => syncGeneratorTemplatePins(root)).toThrow("No workspace pins");
});
