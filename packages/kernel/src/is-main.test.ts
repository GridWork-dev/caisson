import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { isMainModule } from "./is-main.ts";

const dir = mkdtempSync(join(tmpdir(), "is-main-"));
const bin = join(dir, "bin.js");
const other = join(dir, "other.js");
const link = join(dir, "link");
writeFileSync(bin, "");
writeFileSync(other, "");
symlinkSync(bin, link);
const url = pathToFileURL(bin).href;

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("isMainModule", () => {
  test("the runtime's own flag wins when it exists", () => {
    expect(isMainModule({ main: true, url }, other)).toBe(true);
    expect(isMainModule({ main: false, url }, bin)).toBe(false);
  });

  // A Node without `import.meta.main`: the object carries no flag at all.
  test("without the flag, the entry script is the main module", () => {
    expect(isMainModule({ url }, bin)).toBe(true);
  });

  test("without the flag, an entry reached through a symlink still counts", () => {
    expect(isMainModule({ url }, link)).toBe(true);
  });

  test("without the flag, a module imported by another script is not main", () => {
    expect(isMainModule({ url }, other)).toBe(false);
  });

  test("without the flag, a missing entry means the module was imported", () => {
    expect(isMainModule({ url }, undefined)).toBe(false);
    expect(isMainModule({ url }, join(dir, "absent.js"))).toBe(false);
  });
});
