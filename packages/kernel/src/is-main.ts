// Whether a module is the script the runtime was started with. `import.meta.main` answers that on
// Bun, and on Node only from 22.18 and 24.2. A bin guarded by the flag alone prints nothing and
// exits 0 on an older Node, so this falls back to comparing the entry script's real path with the
// module's own. Real paths on both sides, so a bin started through an npm `.bin` symlink counts.
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** True when the module owning `meta` (pass `import.meta`) is the runtime's entry script. */
export function isMainModule(
  meta: { readonly main?: boolean; readonly url: string },
  entry: string | undefined = process.argv[1],
): boolean {
  if (typeof meta.main === "boolean") return meta.main;
  if (entry === undefined) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(meta.url));
  } catch {
    // The entry is not a file on disk (an eval string, a REPL), so this module was imported.
    return false;
  }
}
