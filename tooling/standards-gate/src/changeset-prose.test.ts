// Changeset-source prose gate. A changeset body ships verbatim into the bumped package's
// CHANGELOG via the default `@changesets/cli/changelog` formatter, so an internal-prose leak in
// `.changeset/*.md` must fail the build the moment it's written, not at release. Real temp-dir
// fixtures (the gate reads `.changeset/*.md` off disk — same real-fs pattern as
// checkRlsEquivalence's fixtures in checks.test.ts).
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkChangesetProse } from "./checks";

describe("checkChangesetProse", () => {
  let root: string;
  let changesetDir: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "standards-gate-changeset-prose-"));
    changesetDir = join(root, ".changeset");
    mkdirSync(changesetDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function write(name: string, content: string): void {
    writeFileSync(join(changesetDir, name), content);
  }

  test("no .changeset dir → clean", () => {
    rmSync(changesetDir, { recursive: true, force: true });
    expect(checkChangesetProse(root)).toEqual([]);
  });

  test("empty changeset (frontmatter only, no body) passes", () => {
    write("empty.md", "---\n---\n");
    expect(checkChangesetProse(root)).toEqual([]);
  });

  test("a clean buyer-readable body passes", () => {
    write(
      "clean.md",
      '---\n"@caisson-sh/kernel": patch\n---\n\nFixed a bug where the retry helper double-counted attempts under load.\n',
    );
    expect(checkChangesetProse(root)).toEqual([]);
  });

  test("frontmatter package names/bump types are exempt even if they look like a leak", () => {
    // The frontmatter block itself is never scanned — only the body below the closing `---`.
    write(
      "frontmatter-only.md",
      '---\n"@caisson-sh/gw-fixture-pkg": patch\n---\n\nRenamed an internal helper for clarity.\n',
    );
    expect(checkChangesetProse(root)).toEqual([]);
  });

  test("README.md and non-.md files in .changeset/ are never scanned", () => {
    write("README.md", "ADR-1234 wave-6a docs/state/ gw-some-agent row #7");
    writeFileSync(join(changesetDir, "config.json"), "{}");
    expect(checkChangesetProse(root)).toEqual([]);
  });

  test("a bare ADR citation in the body fails", () => {
    write(
      "leak-adr.md",
      '---\n"@caisson-sh/billing": patch\n---\n\nSee ADR-0182 for the rationale.\n',
    );
    const f = checkChangesetProse(root);
    expect(f).toHaveLength(1);
    expect(f[0]?.rule).toBe("changeset-prose-adr");
    expect(f[0]?.message).toContain(".changeset/leak-adr.md:5");
  });

  test("wave-6 jargon in the body fails", () => {
    write(
      "leak-wave.md",
      '---\n"@caisson-sh/pricebook": patch\n---\n\nPart of the wave-6a compliance sweep.\n',
    );
    const f = checkChangesetProse(root);
    expect(f).toHaveLength(1);
    expect(f[0]?.rule).toBe("changeset-prose-wave");
  });

  test("row-number jargon in the body fails", () => {
    write(
      "leak-row.md",
      '---\n"@caisson-sh/pricebook": patch\n---\n\nDrops row #42 from the catalog.\n',
    );
    const f = checkChangesetProse(root);
    expect(f).toHaveLength(1);
    expect(f[0]?.rule).toBe("changeset-prose-row");
  });

  test("an internal repo path in the body fails", () => {
    write(
      "leak-path.md",
      '---\n"@caisson-sh/audit-harness": patch\n---\n\nSee docs/archive/harvest-program.md for the full list.\n',
    );
    const f = checkChangesetProse(root);
    expect(f).toHaveLength(1);
    expect(f[0]?.rule).toBe("changeset-prose-path");
  });

  test("a session/agent slug in the body fails", () => {
    write(
      "leak-slug.md",
      '---\n"@caisson-sh/kernel": patch\n---\n\nDrafted by gw-typescript-pro in this session.\n',
    );
    const f = checkChangesetProse(root);
    expect(f).toHaveLength(1);
    expect(f[0]?.rule).toBe("changeset-prose-slug");
  });

  test("multiple leaks across files are all reported", () => {
    write(
      "leak-a.md",
      '---\n"@caisson-sh/kernel": patch\n---\n\nADR-0100 fix.\n',
    );
    write(
      "leak-b.md",
      '---\n"@caisson-sh/ui": patch\n---\n\noutputs/foo.md has the notes.\n',
    );
    const f = checkChangesetProse(root);
    expect(f).toHaveLength(2);
    const rules = f.map((x) => x.rule).sort();
    expect(rules).toEqual(["changeset-prose-adr", "changeset-prose-path"]);
  });
});
