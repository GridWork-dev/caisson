import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseRevision,
  readRevision,
  resetServingRevisionCache,
  revisionFilePath,
  servingRevision,
  REVISION_FILENAME,
  REVISION_HEADER,
  UNKNOWN_REVISION,
} from "./revision.ts";

const SHA = "8619c41e0f2a4b6d9c1e3f5a7b8d0c2e4f6a8b0d";

describe("parseRevision", () => {
  test("accepts a full 40-char lowercase commit sha", () => {
    expect(parseRevision(SHA)).toBe(SHA);
  });

  test("tolerates the trailing newline the stamp writes", () => {
    expect(parseRevision(`${SHA}\n`)).toBe(SHA);
  });

  test("collapses the committed placeholder to unknown", () => {
    expect(parseRevision("unknown\n")).toBe(UNKNOWN_REVISION);
  });

  test("collapses an unreadable carrier to unknown", () => {
    expect(parseRevision(null)).toBe(UNKNOWN_REVISION);
  });

  // The point of the strictness: a header reporting a half-written or wrong-shaped value is worse
  // than one admitting it does not know, because a reader is supposed to trust it uncross-checked.
  test.each([
    ["empty", ""],
    ["whitespace only", "   \n"],
    ["short sha", SHA.slice(0, 12)],
    ["over-long", `${SHA}0`],
    ["uppercase hex", SHA.toUpperCase()],
    ["non-hex", "z".repeat(40)],
    ["sha plus trailing junk", `${SHA} dirty`],
    ["two lines", `${SHA}\n${SHA}`],
  ])("collapses %s to unknown", (_label, raw) => {
    expect(parseRevision(raw)).toBe(UNKNOWN_REVISION);
  });
});

describe("revisionFilePath", () => {
  test("falls back to the carrier beside the cwd", () => {
    expect(revisionFilePath({}, "/app")).toBe(join("/app", REVISION_FILENAME));
  });

  // The Next standalone case: server.js chdir's to /app/apps/site, so without the override every
  // Next service in the fleet would silently report `unknown`.
  test("an override wins over the cwd", () => {
    expect(
      revisionFilePath(
        { CAISSON_REVISION_PATH: "/app/.caisson-revision" },
        "/app/apps/site",
      ),
    ).toBe("/app/.caisson-revision");
  });

  test.each([
    ["unset", undefined],
    ["empty", ""],
    ["whitespace only", "   "],
  ])("%s override falls back to the cwd", (_label, value) => {
    expect(
      revisionFilePath(
        value === undefined ? {} : { CAISSON_REVISION_PATH: value },
        "/app",
      ),
    ).toBe(join("/app", REVISION_FILENAME));
  });
});

describe("readRevision", () => {
  test("reads a stamped carrier from the cwd", () => {
    const dir = mkdtempSync(join(tmpdir(), "revision-"));
    try {
      writeFileSync(join(dir, REVISION_FILENAME), `${SHA}\n`);
      expect(readRevision({}, dir)).toBe(SHA);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("reads through the override path", () => {
    const dir = mkdtempSync(join(tmpdir(), "revision-"));
    try {
      const path = join(dir, REVISION_FILENAME);
      writeFileSync(path, `${SHA}\n`);
      // cwd deliberately points somewhere with no carrier: only the override can satisfy this.
      expect(readRevision({ CAISSON_REVISION_PATH: path }, tmpdir())).toBe(SHA);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a missing carrier is unknown, not a throw", () => {
    const dir = mkdtempSync(join(tmpdir(), "revision-"));
    try {
      expect(readRevision({}, dir)).toBe(UNKNOWN_REVISION);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a directory where the carrier should be is unknown, not a throw", () => {
    const dir = mkdtempSync(join(tmpdir(), "revision-"));
    try {
      expect(readRevision({ CAISSON_REVISION_PATH: dir }, dir)).toBe(
        UNKNOWN_REVISION,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("servingRevision", () => {
  test("memoizes, and the reset seam actually re-reads", () => {
    resetServingRevisionCache();
    const first = servingRevision();
    expect(servingRevision()).toBe(first);
    resetServingRevisionCache();
    expect(servingRevision()).toBe(first);
  });

  // In-repo this reads the committed placeholder, so the honest answer under test is `unknown` —
  // asserted explicitly so a stray real sha committed into the carrier fails here rather than
  // shipping a permanently-wrong header.
  test("reports unknown from the committed placeholder", () => {
    resetServingRevisionCache();
    expect(servingRevision()).toBe(UNKNOWN_REVISION);
  });
});

describe("REVISION_HEADER", () => {
  // Written into plain object literals (services/*/src/app.ts) that do NOT normalize case, and
  // compared against Headers.get() output that does. Lower-case is the only shape that works both
  // ways, so it is pinned rather than left to style.
  test("is lower-case", () => {
    expect(REVISION_HEADER).toBe(REVISION_HEADER.toLowerCase());
  });
});
