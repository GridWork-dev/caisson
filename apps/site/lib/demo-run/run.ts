// The in-process demo-run generator (ADR-0352 preview contract). Calls `@caisson/cli`'s `generateDemo`
// IN-PROCESS — never the CLI binary, never `git init`, no install/build/network/subprocess (the pure
// construction `generateDemo` already guarantees: registry-metadata → watermarked stubs, no commercial
// source ever read). The registry index is loaded once + cached with the SAME resolution precedent as
// `apps/admin/src/lib/admin-mutations-runtime.ts` `registryIndex()`: `CAISSON_REGISTRY_INDEX_PATH`
// first (cwd-independent — the Next standalone `server.js` calls `process.chdir(__dirname)` on boot, so
// the cwd fallback below only serves local `bun dev`/tests), falling back to `<cwd>/registry/index.json`.
// Output is bounded to the fixed API contract: a full path/bytes tree, a content map capped at
// MAX_TOTAL_BYTES with oversize files truncated, and a compact module summary.
import { join } from "node:path";
import { generateDemo } from "@caisson/cli";
import {
  loadRegistryIndexFromFile,
  type RegistryIndex,
} from "@caisson/registry-schema";

export interface DemoRunResult {
  readonly tree: readonly { readonly path: string; readonly bytes: number }[];
  readonly files: Record<string, string>;
  readonly moduleSummary: {
    readonly total: number;
    readonly oss: number;
    readonly paid: number;
    readonly modules: readonly {
      readonly id: string;
      readonly version: string;
      readonly tier: "oss" | "paid";
    }[];
  };
  readonly generatedInMs: number;
}

/** ≤ 400KB total content over the whole file map (fixed API contract). */
const MAX_TOTAL_BYTES = 400_000;
/** Per-file ceiling before an individual file is truncated with a marker. */
const MAX_FILE_BYTES = 64_000;

function truncationMarker(keptBytes: number, totalBytes: number): string {
  return `\n\n... [truncated: showing ${keptBytes} of ${totalBytes} bytes — run create-caisson --demo for the full scaffold] ...\n`;
}

/** Byte-accurate, UTF-8-safe head of `s` at most `maxBytes` long (backs off a split multibyte char). */
export function truncateUtf8(s: string, maxBytes: number): string {
  const buf = Buffer.from(s, "utf8");
  if (buf.length <= maxBytes) return s;
  let end = maxBytes;
  while (end > 0 && ((buf[end] ?? 0) & 0xc0) === 0x80) end--; // 0b10xxxxxx = continuation byte
  return buf.subarray(0, end).toString("utf8");
}

/** Split a generated file set into a full `{path, bytes}` tree (true sizes) and a bounded content map:
 *  each file capped at MAX_FILE_BYTES, the cumulative content capped at MAX_TOTAL_BYTES; anything over
 *  either bound is truncated with a marker. Exported for a direct unit test on fabricated oversize input
 *  (the real demo output may well fit under the total, so truncation needs its own coverage). */
export function boundFiles(
  files: readonly { readonly path: string; readonly content: string }[],
): {
  tree: { path: string; bytes: number }[];
  bounded: Record<string, string>;
} {
  const tree: { path: string; bytes: number }[] = [];
  const bounded: Record<string, string> = {};
  let used = 0;
  for (const f of files) {
    const bytes = Buffer.byteLength(f.content, "utf8");
    tree.push({ path: f.path, bytes });
    const budget = Math.min(MAX_FILE_BYTES, MAX_TOTAL_BYTES - used);
    if (budget <= 0) {
      bounded[f.path] = truncationMarker(0, bytes);
      continue;
    }
    if (bytes <= budget) {
      bounded[f.path] = f.content;
      used += bytes;
      continue;
    }
    const head = truncateUtf8(f.content, budget);
    const keptBytes = Buffer.byteLength(head, "utf8");
    bounded[f.path] = head + truncationMarker(keptBytes, bytes);
    used += keptBytes;
  }
  return { tree, bounded };
}

let cachedIndex: RegistryIndex | undefined;

function registryIndex(): RegistryIndex {
  if (cachedIndex === undefined) {
    const path =
      process.env.CAISSON_REGISTRY_INDEX_PATH?.trim() ||
      join(process.cwd(), "registry", "index.json");
    cachedIndex = loadRegistryIndexFromFile(path);
  }
  return cachedIndex;
}

/** Generate one visitor's demo scaffold in-process and bound it to the fixed API contract. Synchronous
 *  (`generateDemo` is pure construction) — may throw on a registry inconsistency, which the handler
 *  turns into a fail-closed 500. */
export function generateDemoRun(projectName: string): DemoRunResult {
  const started = performance.now();
  const { files, modules } = generateDemo(registryIndex(), { projectName });
  const generatedInMs = Math.round(performance.now() - started);
  const { tree, bounded } = boundFiles(files);
  const oss = modules.filter((m) => m.tier === "oss").length;
  return {
    tree,
    files: bounded,
    moduleSummary: {
      total: modules.length,
      oss,
      paid: modules.length - oss,
      modules: modules.map((m) => ({
        id: m.id,
        version: m.version,
        tier: m.tier,
      })),
    },
    generatedInMs,
  };
}
