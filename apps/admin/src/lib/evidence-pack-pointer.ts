import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
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
  archiveSha256: z.string().regex(/^[0-9a-f]{64}$/u),
  manifestSha256: z.string().regex(/^[0-9a-f]{64}$/u),
  generatedAt: z.string().datetime({ offset: true }),
});

export const latestEvidencePackResponseSchema = strictObject({
  kind: z.literal("latest-evidence-pack"),
  /** Digest of the immutable exported archive/logical pack, not of manifest.json. */
  sha256: z.string().regex(/^[0-9a-f]{64}$/u),
  /** Digest of the exact manifest.json bytes parsed below. */
  manifestSha256: z.string().regex(/^[0-9a-f]{64}$/u),
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

function errorCode(error: unknown): unknown {
  return typeof error === "object" && error !== null
    ? Reflect.get(error, "code")
    : undefined;
}

function isContained(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(`${root}${sep}`);
}

async function canonicalContainedFile(
  filePath: string,
  accountDir: string,
  missingMessage: string,
): Promise<string> {
  let canonical: string;
  try {
    canonical = await realpath(filePath);
  } catch (error) {
    if (isMissingFile(error)) throw new NotFoundError(missingMessage);
    throw error;
  }
  if (!isContained(accountDir, canonical)) {
    throw new InternalError(
      "persisted evidence-pack pointer escapes its account directory",
    );
  }
  if (canonical !== filePath) {
    throw new InternalError(
      "persisted evidence-pack artifacts must not use symbolic links",
    );
  }
  return canonical;
}

async function readBoundedFile(
  filePath: string,
  accountDir: string,
  maxBytes: number,
  missingMessage: string,
): Promise<string> {
  const canonical = await canonicalContainedFile(
    filePath,
    accountDir,
    missingMessage,
  );
  let handle;
  try {
    handle = await open(canonical, constants.O_RDONLY | constants.O_NOFOLLOW);
    const metadata = await handle.stat();
    if (!metadata.isFile() || metadata.size > maxBytes) {
      throw new InternalError("persisted evidence-pack artifact is invalid");
    }

    const chunks: Buffer[] = [];
    let position = 0;
    while (position <= maxBytes) {
      const chunk = Buffer.alloc(Math.min(64 * 1024, maxBytes + 1 - position));
      const { bytesRead } = await handle.read(chunk, 0, chunk.length, position);
      if (bytesRead === 0) break;
      chunks.push(chunk.subarray(0, bytesRead));
      position += bytesRead;
    }
    const after = await handle.stat();
    if (position > maxBytes || after.size !== position) {
      throw new InternalError("persisted evidence-pack artifact is invalid");
    }
    return Buffer.concat(chunks, position).toString("utf8");
  } catch (error) {
    if (isMissingFile(error)) throw new NotFoundError(missingMessage);
    if (errorCode(error) === "ELOOP") {
      throw new InternalError(
        "persisted evidence-pack artifacts must not use symbolic links",
      );
    }
    throw error;
  } finally {
    await handle?.close();
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

  const configuredRoot = resolve(root);
  let canonicalRoot: string;
  try {
    canonicalRoot = await realpath(configuredRoot);
  } catch (error) {
    if (isMissingFile(error)) {
      throw new ConfigError("CAISSON_EVIDENCE_PACK_ROOT does not exist");
    }
    throw error;
  }
  if (canonicalRoot !== configuredRoot) {
    throw new ConfigError(
      "CAISSON_EVIDENCE_PACK_ROOT must not use symbolic links",
    );
  }

  const accountDir = resolve(canonicalRoot, wormAnchorAccount(accountId));
  let canonicalAccountDir: string;
  try {
    canonicalAccountDir = await realpath(accountDir);
  } catch (error) {
    if (isMissingFile(error)) {
      throw new NotFoundError("latest evidence-pack pointer not found");
    }
    throw error;
  }
  if (
    canonicalAccountDir !== accountDir ||
    !isContained(canonicalRoot, canonicalAccountDir)
  ) {
    throw new InternalError(
      "persisted evidence-pack account directory must be contained and must not use symbolic links",
    );
  }

  const pointerPath = resolve(accountDir, "latest.json");
  const pointerContents = await readBoundedFile(
    pointerPath,
    canonicalAccountDir,
    MAX_POINTER_BYTES,
    "latest evidence-pack pointer not found",
  );

  let pointer: z.infer<typeof persistedPointerSchema>;
  try {
    pointer = parseStrict(persistedPointerSchema, parseJson(pointerContents));
  } catch {
    throw new InternalError("persisted evidence-pack pointer is invalid");
  }

  const manifestPath = resolve(canonicalAccountDir, pointer.manifestPath);
  if (!isContained(canonicalAccountDir, manifestPath)) {
    throw new InternalError(
      "persisted evidence-pack pointer escapes its account directory",
    );
  }
  let manifestContents: string;
  try {
    manifestContents = await readBoundedFile(
      manifestPath,
      canonicalAccountDir,
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
  const manifestSha256 = createHash("sha256")
    .update(manifestContents)
    .digest("hex");
  if (manifestSha256 !== pointer.manifestSha256) {
    throw new InternalError(
      "persisted evidence-pack manifest digest does not match its pointer",
    );
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
    sha256: pointer.archiveSha256,
    manifestSha256,
    generatedAt: pointer.generatedAt,
    manifest,
  });
}
