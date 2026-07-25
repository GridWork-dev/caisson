import { stat, readFile } from "node:fs/promises";
import { isAbsolute, resolve, sep } from "node:path";
import {
  evidencePackManifestSchema,
  parseEvidencePackManifest,
} from "@caisson/compliance-core";
import {
  ConfigError,
  InternalError,
  NotFoundError,
  parseStrict,
  strictObject,
} from "@caisson/kernel";
import { wormAnchorAccount } from "@caisson/service-license";
import { z } from "zod";

const MAX_POINTER_BYTES = 16 * 1024;
const MAX_MANIFEST_BYTES = 5 * 1024 * 1024;

const persistedPointerSchema = strictObject({
  formatVersion: z.literal("1"),
  manifestPath: z
    .string()
    .trim()
    .min(1)
    .max(512)
    .refine(
      (value) =>
        !isAbsolute(value) &&
        !value.includes("\0") &&
        !value.split(/[\\/]/u).includes(".."),
      "manifestPath must be relative and contained",
    ),
  sha256: z.string().regex(/^[0-9a-f]{64}$/u),
  generatedAt: z.string().datetime({ offset: true }),
});

export const latestEvidencePackResponseSchema = strictObject({
  kind: z.literal("latest-evidence-pack"),
  sha256: z.string().regex(/^[0-9a-f]{64}$/u),
  generatedAt: z.string().datetime({ offset: true }),
  manifest: evidencePackManifestSchema,
});

export type LatestEvidencePackResponse = z.infer<
  typeof latestEvidencePackResponseSchema
>;

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    Reflect.get(error, "code") === "ENOENT"
  );
}

async function readBoundedFile(
  filePath: string,
  maxBytes: number,
  missingMessage: string,
): Promise<string> {
  try {
    const metadata = await stat(filePath);
    if (!metadata.isFile() || metadata.size > maxBytes) {
      throw new InternalError("persisted evidence-pack artifact is invalid");
    }
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (isMissingFile(error)) throw new NotFoundError(missingMessage);
    throw error;
  }
}

function parseJson(contents: string): unknown {
  try {
    return JSON.parse(contents);
  } catch {
    throw new InternalError("persisted evidence-pack artifact is not JSON");
  }
}

export async function readLatestEvidencePack(
  accountId: string,
): Promise<LatestEvidencePackResponse> {
  const root = process.env.CAISSON_EVIDENCE_PACK_ROOT?.trim() ?? "";
  if (root === "" || !isAbsolute(root)) {
    throw new ConfigError(
      "CAISSON_EVIDENCE_PACK_ROOT must be an absolute directory",
    );
  }

  const accountDir = resolve(root, wormAnchorAccount(accountId));
  const pointerPath = resolve(accountDir, "latest.json");
  const pointerContents = await readBoundedFile(
    pointerPath,
    MAX_POINTER_BYTES,
    "latest evidence-pack pointer not found",
  );

  let pointer: z.infer<typeof persistedPointerSchema>;
  try {
    pointer = parseStrict(persistedPointerSchema, parseJson(pointerContents));
  } catch {
    throw new InternalError("persisted evidence-pack pointer is invalid");
  }

  const manifestPath = resolve(accountDir, pointer.manifestPath);
  if (!manifestPath.startsWith(`${accountDir}${sep}`)) {
    throw new InternalError(
      "persisted evidence-pack pointer escapes its account directory",
    );
  }
  let manifestContents: string;
  try {
    manifestContents = await readBoundedFile(
      manifestPath,
      MAX_MANIFEST_BYTES,
      "persisted evidence-pack manifest not found",
    );
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw new InternalError(
        "persisted evidence-pack pointer references a missing manifest",
      );
    }
    throw error;
  }

  let manifest;
  try {
    manifest = parseEvidencePackManifest(parseJson(manifestContents));
  } catch {
    throw new InternalError("persisted evidence-pack manifest is invalid");
  }
  if (manifest.tenantId !== accountId) {
    throw new InternalError(
      "persisted evidence-pack manifest belongs to another account",
    );
  }

  return parseStrict(latestEvidencePackResponseSchema, {
    kind: "latest-evidence-pack",
    sha256: pointer.sha256,
    generatedAt: pointer.generatedAt,
    manifest,
  });
}
