/**
 * Typed reader for the committed component manifest. `base-manifest.json` is generated
 * deterministically from @caisson-sh/ui's authoritative component barrel, prop types, JSDoc, and
 * co-located styles, then bundled alongside this file.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseComponentManifest, type ComponentManifest } from "./schema.ts";

const BASE_MANIFEST_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "base-manifest.json",
);

/** Read + validate the committed base component manifest off disk. Throws if the file is missing
 *  or fails schema validation — a caller never receives a shape it hasn't been checked against. */
export function loadBaseManifest(): ComponentManifest {
  const raw: unknown = JSON.parse(readFileSync(BASE_MANIFEST_PATH, "utf8"));
  return parseComponentManifest(raw);
}
