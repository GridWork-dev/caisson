// FileSetWriter tests (ADR-0068). Four concerns:
//   (1) path safety — zip-slip / traversal / null-byte / absolute rejected before any write,
//   (2) non-empty target guard — refused by default; opt-in overwrite honored,
//   (3) rollback — a mid-write failure cleans the temp dir; target is untouched,
//   (4) happy path — byte-exact materialization, nested trees, missing target created.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createFileSetWriter } from "./writer.ts";

let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "caisson-writer-"));
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// (1) Path safety — zip-slip / traversal / absolute / null-byte
// ---------------------------------------------------------------------------

describe("path safety — rejected before any write (ADR-0068)", () => {
  test("rejects a `../` traversal", async () => {
    const target = join(testDir, "out");
    await mkdir(target);
    const writer = createFileSetWriter();

    await expect(
      writer(target, [{ path: "../escape.txt", content: "x" }]),
    ).rejects.toThrow(/directory traversal/);

    // Target must be untouched.
    expect(await readdir(target)).toHaveLength(0);
  });

  test("rejects a deeply-nested `..` traversal (sub/../../escape)", async () => {
    const target = join(testDir, "out");
    await mkdir(target);
    const writer = createFileSetWriter();

    await expect(
      writer(target, [{ path: "sub/../../escape.txt", content: "x" }]),
    ).rejects.toThrow(/directory traversal/);
  });

  test("rejects an absolute path", async () => {
    const target = join(testDir, "out");
    await mkdir(target);
    const writer = createFileSetWriter();

    await expect(
      writer(target, [{ path: "/etc/passwd", content: "x" }]),
    ).rejects.toThrow(/absolute path/);
  });

  test("rejects a null-byte path", async () => {
    const target = join(testDir, "out");
    await mkdir(target);
    const writer = createFileSetWriter();

    await expect(
      writer(target, [{ path: "foo\0bar.txt", content: "x" }]),
    ).rejects.toThrow(/null byte/);
  });

  test("validates ALL paths before writing ANY file", async () => {
    // If file[1] is unsafe, file[0] must NOT have been written (validation runs on the
    // whole file set before the first disk op — fail-closed).
    const target = join(testDir, "out");
    await mkdir(target);
    const writer = createFileSetWriter();

    await expect(
      writer(target, [
        { path: "safe.txt", content: "ok" },
        { path: "../escape.txt", content: "x" }, // traversal — must abort before safe.txt write
      ]),
    ).rejects.toThrow(/directory traversal/);

    expect(await readdir(target)).toHaveLength(0); // safe.txt must NOT be present
  });
});

// ---------------------------------------------------------------------------
// (2) Non-empty target guard
// ---------------------------------------------------------------------------

describe("non-empty target guard", () => {
  test("refuses a non-empty target by default (fail-closed)", async () => {
    const target = join(testDir, "out");
    await mkdir(target);
    await writeFile(join(target, "existing.txt"), "old");
    const writer = createFileSetWriter();

    await expect(
      writer(target, [{ path: "new.txt", content: "new" }]),
    ).rejects.toThrow(/not empty/);

    // Existing file must be untouched.
    expect(await readFile(join(target, "existing.txt"), "utf8")).toBe("old");
  });

  test("overwrite: true succeeds on a non-empty target", async () => {
    const target = join(testDir, "out");
    await mkdir(target);
    await writeFile(join(target, "existing.txt"), "old");
    const writer = createFileSetWriter({ overwrite: true });

    await writer(target, [{ path: "new.txt", content: "new" }]);

    expect(await readFile(join(target, "new.txt"), "utf8")).toBe("new");
  });

  test("accepts an empty target without overwrite", async () => {
    const target = join(testDir, "out");
    await mkdir(target);
    const writer = createFileSetWriter();

    await writer(target, [{ path: "file.txt", content: "hello" }]);
    expect(await readFile(join(target, "file.txt"), "utf8")).toBe("hello");
  });

  test("accepts a missing target (creates it) without overwrite", async () => {
    const target = join(testDir, "new-project"); // does not exist yet
    const writer = createFileSetWriter();

    await writer(target, [{ path: "README.md", content: "# hi\n" }]);
    expect(await readFile(join(target, "README.md"), "utf8")).toBe("# hi\n");
  });
});

// ---------------------------------------------------------------------------
// (3) Rollback — mid-write failure leaves no partial tree
// ---------------------------------------------------------------------------

describe("rollback — mid-write failure leaves no partial tree", () => {
  test("cleans up the temp dir on EISDIR; target is untouched", async () => {
    // Strategy: file[0] creates `sub/` as a directory in the temp tree; file[1] then
    // tries to writeFile at the path `sub` itself (a directory) → EISDIR mid-write.
    const target = join(testDir, "out");
    await mkdir(target);
    const writer = createFileSetWriter();

    await expect(
      writer(target, [
        { path: "sub/child.txt", content: "a" }, // creates tempDir/sub/ + writes child.txt
        { path: "sub", content: "b" }, // EISDIR: tempDir/sub is now a directory
      ]),
    ).rejects.toThrow();

    // Target must be untouched (no partial tree).
    expect(await readdir(target)).toHaveLength(0);

    // Temp dir must have been cleaned up (no .caisson-* siblings of target).
    const siblings = await readdir(testDir);
    const tempDirs = siblings.filter((s) => s.startsWith(".caisson-"));
    expect(tempDirs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// (4) Happy path — byte-exact materialization
// ---------------------------------------------------------------------------

describe("happy path — byte-exact materialization", () => {
  test("writes a flat + nested file tree byte-exact", async () => {
    const target = join(testDir, "project");
    const writer = createFileSetWriter();
    const files = [
      { path: "package.json", content: '{"name":"test"}\n' },
      {
        path: ".npmrc",
        content: "@caisson-sh:registry=https://npm.pkg.github.com\n",
      },
      { path: "src/index.ts", content: "export {};\n" },
      { path: "src/lib/util.ts", content: "export const x = 1;\n" },
    ] as const;

    await writer(target, files);

    for (const f of files) {
      expect(await readFile(join(target, f.path), "utf8")).toBe(f.content);
    }
  });

  test("multi-level nested directories are created on demand", async () => {
    const target = join(testDir, "project");
    const writer = createFileSetWriter();

    await writer(target, [{ path: "a/b/c/deep.txt", content: "deep" }]);

    expect(await readFile(join(target, "a/b/c/deep.txt"), "utf8")).toBe("deep");
  });

  test("missing target directory (and parents) are created", async () => {
    // Neither `does/` nor `does/not/` nor `does/not/exist/` exist.
    const target = join(testDir, "does", "not", "exist");
    const writer = createFileSetWriter();

    await writer(target, [{ path: "hello.txt", content: "world" }]);
    expect(await readFile(join(target, "hello.txt"), "utf8")).toBe("world");
  });

  test("unicode content is preserved byte-exact", async () => {
    const target = join(testDir, "proj");
    const writer = createFileSetWriter();
    const content = "# 한국어 テスト émoji 🎉\n";

    await writer(target, [{ path: "README.md", content }]);
    expect(await readFile(join(target, "README.md"), "utf8")).toBe(content);
  });

  test("an empty file set produces an empty target directory", async () => {
    const target = join(testDir, "empty-project");
    const writer = createFileSetWriter();

    await writer(target, []);
    expect(await readdir(target)).toHaveLength(0);
  });
});
