#!/usr/bin/env node
import { closeSync, fstatSync, openSync, readSync } from "node:fs";
import { MAX_PACK_INPUT_BYTES, verifyEvidencePack } from "./index.ts";

function readBoundedPack(path: string): string | undefined {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(path, "r");
    const file = fstatSync(descriptor);
    if (!file.isFile() || file.size > MAX_PACK_INPUT_BYTES) return undefined;
    const bytes = Buffer.alloc(
      Math.min(file.size + 1, MAX_PACK_INPUT_BYTES + 1),
    );
    let offset = 0;
    while (offset < bytes.length) {
      const read = readSync(
        descriptor,
        bytes,
        offset,
        bytes.length - offset,
        null,
      );
      if (read === 0) break;
      offset += read;
    }
    if (offset > MAX_PACK_INPUT_BYTES || offset === bytes.length) {
      return undefined;
    }
    return bytes.subarray(0, offset).toString("utf8");
  } catch {
    return undefined;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

const packPath = process.argv[2];
const expectedPublicKeySha256 = process.env["CAISSON_VERIFY_PACK_KEY_SHA256"];
if (
  packPath === undefined ||
  process.argv.length !== 3 ||
  expectedPublicKeySha256 === undefined
) {
  process.stderr.write(
    "usage: set CAISSON_VERIFY_PACK_KEY_SHA256 to an independently obtained fingerprint, then run verify-pack <logical-evidence-pack.json>\n",
  );
  process.exitCode = 2;
} else {
  let input: unknown;
  try {
    const contents = readBoundedPack(packPath);
    input = contents === undefined ? undefined : JSON.parse(contents);
  } catch {
    input = undefined;
  }

  if (input === undefined) {
    process.stdout.write("FAIL — pack file is unreadable or malformed JSON.\n");
    process.exitCode = 1;
  } else {
    const result = await verifyEvidencePack(input, {
      expectedPublicKeySha256,
    });
    if (result.ok) {
      const fileCount =
        typeof input === "object" &&
        input !== null &&
        "files" in input &&
        Array.isArray(input.files)
          ? input.files.length
          : 0;
      for (const row of result.rows) {
        process.stdout.write(
          `row ${String(row.seq)}: link=${row.linkRecompute} anchor-equality=${row.anchorEquality} signature=${row.signature} -> PASS\n`,
        );
      }
      process.stdout.write(
        `PASS — signed evidence pack verified (${String(fileCount)} files, ${String(result.rows.length)} rows).\n`,
      );
    } else {
      for (const error of result.errors) {
        process.stdout.write(`FAIL — ${error}\n`);
      }
      process.exitCode = 1;
    }
  }
}
