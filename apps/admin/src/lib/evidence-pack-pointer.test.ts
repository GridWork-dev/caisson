import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { wormAnchorAccount } from "@caisson/service-license";
import { readLatestEvidencePack } from "./evidence-pack-pointer.ts";

const ACCOUNT = "buyer_account_01";
const ARCHIVE_SHA256 = "a".repeat(64);
let root: string;
let accountDir: string;
let manifestContents: string;
const originalRoot = process.env.CAISSON_EVIDENCE_PACK_ROOT;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function writePointer(
  overrides: Partial<{
    readonly archiveSha256: string;
    readonly manifestPath: string;
    readonly manifestSha256: string;
  }> = {},
): Promise<void> {
  await writeFile(
    join(accountDir, "latest.json"),
    JSON.stringify({
      formatVersion: "1",
      manifestPath: overrides.manifestPath ?? "packs/manifest.json",
      archiveSha256: overrides.archiveSha256 ?? ARCHIVE_SHA256,
      manifestSha256: overrides.manifestSha256 ?? sha256(manifestContents),
      generatedAt: "2026-07-25T18:00:00.000Z",
    }),
  );
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "caisson-pointer-test-"));
  accountDir = join(root, wormAnchorAccount(ACCOUNT));
  await mkdir(join(accountDir, "packs"), { recursive: true });
  const manifest = JSON.parse(
    await readFile(
      new URL(
        "../../../../packages/compliance-core/src/__golden__/evidence-pack.manifest.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as Record<string, unknown>;
  manifest.tenantId = ACCOUNT;
  manifestContents = JSON.stringify(manifest);
  await writeFile(join(accountDir, "packs", "manifest.json"), manifestContents);
  process.env.CAISSON_EVIDENCE_PACK_ROOT = root;
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  if (originalRoot === undefined) delete process.env.CAISSON_EVIDENCE_PACK_ROOT;
  else process.env.CAISSON_EVIDENCE_PACK_ROOT = originalRoot;
});

describe("readLatestEvidencePack", () => {
  test("binds the parsed manifest to its own digest while preserving the distinct archive digest", async () => {
    await writePointer();

    const latest = await readLatestEvidencePack(ACCOUNT);

    expect(latest.sha256).toBe(ARCHIVE_SHA256);
    expect(latest.manifestSha256).toBe(sha256(manifestContents));
    expect(latest.manifest.tenantId).toBe(ACCOUNT);
  });

  test("rejects a manifest whose bytes do not match manifestSha256", async () => {
    await writePointer({ manifestSha256: "b".repeat(64) });

    await expect(readLatestEvidencePack(ACCOUNT)).rejects.toThrow(
      "manifest digest does not match",
    );
  });

  test("rejects symlinked pointer and manifest files even when they resolve inside the account root", async () => {
    await writePointer();
    await writeFile(join(accountDir, "pointer-target.json"), "{}");
    await rm(join(accountDir, "latest.json"));
    await symlink("pointer-target.json", join(accountDir, "latest.json"));
    await expect(readLatestEvidencePack(ACCOUNT)).rejects.toThrow(
      "symbolic links",
    );

    await rm(join(accountDir, "latest.json"));
    await writePointer();
    await writeFile(
      join(accountDir, "packs", "manifest-target.json"),
      manifestContents,
    );
    await rm(join(accountDir, "packs", "manifest.json"));
    await symlink(
      "manifest-target.json",
      join(accountDir, "packs", "manifest.json"),
    );
    await expect(readLatestEvidencePack(ACCOUNT)).rejects.toThrow(
      "symbolic links",
    );
  });

  test("realpath containment rejects a symlinked directory that escapes the account root", async () => {
    const outside = await mkdtemp(join(tmpdir(), "caisson-pointer-outside-"));
    try {
      await writeFile(join(outside, "manifest.json"), manifestContents);
      await rm(join(accountDir, "packs"), { recursive: true, force: true });
      await symlink(outside, join(accountDir, "packs"));
      await writePointer();

      await expect(readLatestEvidencePack(ACCOUNT)).rejects.toThrow(
        "escapes its account directory",
      );
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });
});
