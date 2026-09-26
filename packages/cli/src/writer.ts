// Disk FileSetWriter (ADR-0068). Path safety: zip-slip / traversal guard — every file path
// is validated against the target root BEFORE any write (fail-closed). Atomic: sibling temp dir
// → rename(2) into place; a partial/failed write leaves no half-tree (temp cleaned on error).
// ZERO new dependencies — node:fs / node:path only; Zod guards the options boundary.
import {
  mkdir,
  mkdtemp,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { z } from "zod";
import type { GeneratedFileSet } from "./generate.ts";

/** The disk-write seam: materialize a generated file set to `targetDir`. The default writer
 *  (`createFileSetWriter`) lives in this module, so the type is owned here too. `generate` never
 *  writes; the CLI entry calls a writer after generation, and programmatic callers bring their own. */
export type FileSetWriter = (
  targetDir: string,
  files: GeneratedFileSet,
) => Promise<void>;

/** Options accepted by `createFileSetWriter`. Validated with Zod `.strict()` (ADR-0002). */
export const WriterOptionsSchema = z
  .object({
    /** Allow writing into a non-empty target directory. Default: false (fail-closed). */
    overwrite: z.boolean().optional(),
  })
  .strict();

export type WriterOptions = z.infer<typeof WriterOptionsSchema>;

/**
 * Assert that `filePath` is safe to write under `resolvedTargetDir`.
 *
 * Rejects (hard failures — throws before any disk op):
 *  - null bytes (POSIX / OS injection vector)
 *  - absolute paths (Unix or Windows)
 *  - any `..` segment (directory traversal, pre-resolve fast check)
 *  - any resolved result that escapes the target root (belt-and-suspenders)
 *
 * Returns the resolved absolute destination path on success.
 */
function assertSafePath(resolvedTargetDir: string, filePath: string): string {
  // Null-byte check: a null byte is always an injection vector (POSIX paths cannot contain \0).
  if (filePath.includes("\0")) {
    throw new Error(
      `unsafe file path (null byte): ${JSON.stringify(filePath)}`,
    );
  }
  // Reject absolute paths before resolve() can normalize them away.
  if (
    filePath.startsWith("/") ||
    filePath.startsWith("\\") ||
    /^[A-Za-z]:/.test(filePath)
  ) {
    throw new Error(
      `unsafe file path (absolute path not allowed): ${JSON.stringify(filePath)}`,
    );
  }
  // Reject any `..` segment — pre-resolve fast check prevents normalized traversal.
  const segments = filePath.split(/[/\\]/);
  if (segments.some((s) => s === "..")) {
    throw new Error(
      `unsafe file path (directory traversal): ${JSON.stringify(filePath)}`,
    );
  }
  // Belt-and-suspenders: after resolve, the result must sit inside `<targetDir>/`.
  // The `+ sep` guard prevents a sibling path like `<target>-escape` from passing.
  const resolved = resolve(resolvedTargetDir, filePath);
  if (!resolved.startsWith(resolvedTargetDir + sep)) {
    throw new Error(
      `unsafe file path (escapes target directory): ${JSON.stringify(filePath)}`,
    );
  }
  return resolved;
}

/** Narrow an unknown catch value to a POSIX ENOENT filesystem error. */
function isEnoent(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code: unknown }).code === "ENOENT"
  );
}

/**
 * Create a `FileSetWriter` that materializes a `GeneratedFileSet` to disk.
 *
 * Safety model (fail-closed, ADR-0068):
 *  1. ALL file paths are validated (zip-slip / traversal) before any disk operation.
 *     A single invalid path aborts the entire write before touching the filesystem.
 *  2. A non-empty target directory is refused unless `overwrite: true`.
 *     `.` (cwd) is a valid target; the non-empty guard still applies.
 *  3. Files are written to a sibling temp dir (the atomicity buffer).
 *  4. The temp dir is swapped into place via rename(2) (atomic on the same filesystem —
 *     sibling in the same parent). For the running directory (cwd) we cannot safely rename
 *     or rm -rf the directory we're inside; files are moved individually instead.
 *  5. On any failure: the temp dir is removed; the target is left untouched. No partial tree.
 */
export function createFileSetWriter(raw?: unknown): FileSetWriter {
  const { overwrite = false } = WriterOptionsSchema.parse(raw ?? {});

  return async function fileSetWriter(
    targetDir: string,
    files: GeneratedFileSet,
  ): Promise<void> {
    const resolvedTarget = resolve(targetDir);

    // 1. Validate ALL paths before any disk operation (fail-closed).
    //    An invalid path in any position rejects the entire file set immediately.
    const safeFiles = files.map((f) => ({
      file: f,
      absPath: assertSafePath(resolvedTarget, f.path),
    }));

    // 2. Non-empty target guard (default: refuse — fail-closed).
    if (!overwrite) {
      const entries = await readdir(resolvedTarget).catch((e: unknown) => {
        if (isEnoent(e)) return [] as string[];
        throw e;
      });
      if (entries.length > 0) {
        throw new Error(
          `target directory is not empty: ${resolvedTarget}` +
            ` — pass { overwrite: true } to allow`,
        );
      }
    }

    // 3. Write everything to a sibling temp dir (the atomicity buffer).
    //    Parent is created first so mkdtemp has a valid prefix directory.
    const parentDir = dirname(resolvedTarget);
    await mkdir(parentDir, { recursive: true });
    const tempDir = await mkdtemp(join(parentDir, ".caisson-"));

    try {
      for (const { file, absPath } of safeFiles) {
        // Rebase the destination path from resolvedTarget → tempDir.
        const relPath = absPath.slice(resolvedTarget.length + sep.length);
        const tempPath = join(tempDir, relPath);
        await mkdir(dirname(tempPath), { recursive: true });
        await writeFile(tempPath, file.content, "utf8");
      }

      // 4. Swap the temp dir into place.
      const isCwd = resolvedTarget === resolve(".");
      if (isCwd) {
        // Never rename or rm -rf the running directory. Move each file individually;
        // per-file rename(2) is atomic at the file level.
        for (const { absPath } of safeFiles) {
          const relPath = absPath.slice(resolvedTarget.length + sep.length);
          const tempPath = join(tempDir, relPath);
          await mkdir(dirname(absPath), { recursive: true });
          await rename(tempPath, absPath);
        }
        await rm(tempDir, { recursive: true, force: true });
      } else {
        if (overwrite) {
          // Remove the existing target so rename(2) does not fail on a non-empty dir
          // (POSIX rename(2) requires the destination dir to be empty).
          await rm(resolvedTarget, { recursive: true, force: true });
        }
        // rename(2): atomic when src and dst share a filesystem (guaranteed — sibling).
        await rename(tempDir, resolvedTarget);
      }
    } catch (err) {
      // Fail-closed: purge the temp dir so no partial tree is left behind.
      // The target has not been touched at this point.
      await rm(tempDir, { recursive: true, force: true }).catch(
        () => undefined,
      );
      throw err;
    }
  };
}
