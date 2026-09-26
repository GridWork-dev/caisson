// Gate 1b transitive scan (ADR-0010/0022). checkExternalAgpl must walk the WHOLE installed
// node_modules tree, not just each package's direct deps, and must read the string/{type}/
// licenses[] license shapes — otherwise a transitive or legacy-form AGPL/SSPL dep escapes a
// tripwire that claims to hard-fail on ANY external copyleft dep. Fixtures are built in a real
// temp dir (never under the repo tree — `node_modules/` is repo-gitignored at any depth, so a
// checked-in fixture would silently vanish from git) and torn down after each test.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkExternalAgpl } from "./checks";
import type { Pkg } from "./workspace";

const APACHE = "Apache-2.0";

function pkg(over: Partial<Pkg> & Pick<Pkg, "name" | "license">): Pkg {
  return {
    dir: `/repo/packages/${over.name.replace("@caisson-sh/", "")}`,
    version: "0.0.0",
    workspaceDeps: [],
    manifestPath: null,
    hasCode: true,
    private: false,
    ...over,
  };
}

/** Writes `<root>/node_modules/<relDir>/package.json` with the given license value as-is. */
function writePackageJson(
  root: string,
  relDir: string,
  name: string,
  license: unknown,
): void {
  const dir = join(root, "node_modules", relDir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name, version: "1.0.0", license }),
  );
}

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "standards-gate-agpl-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("checkExternalAgpl (Gate 1b, ADR-0010)", () => {
  test("an all-MIT tree passes", () => {
    writePackageJson(root, "foo", "foo", "MIT");
    const consumer = pkg({
      name: "@caisson-sh/x",
      license: APACHE,
    });
    expect(checkExternalAgpl([consumer], root)).toEqual([]);
  });

  test("a nested (transitive) AGPL dep two node_modules levels deep is caught", () => {
    writePackageJson(root, "foo", "foo", "MIT");
    writePackageJson(
      root,
      "foo/node_modules/bad-lib",
      "bad-lib",
      "AGPL-3.0-only",
    );
    const consumer = pkg({
      name: "@caisson-sh/x",
      license: APACHE, // bad-lib is a dep of foo, never declared directly
    });
    const findings = checkExternalAgpl([consumer], root);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("error");
    expect(findings[0]?.rule).toBe("agpl-external");
    expect(findings[0]?.message).toContain(
      "node_modules/foo/node_modules/bad-lib",
    );
    expect(findings[0]?.message).toContain("AGPL-3.0-only");
  });

  test("legacy object-form license ({ type: ... }) is parsed and flagged", () => {
    writePackageJson(root, "bad-obj", "bad-obj", { type: "AGPL-3.0" });
    const findings = checkExternalAgpl(
      [pkg({ name: "@caisson-sh/x", license: APACHE })],
      root,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("node_modules/bad-obj");
  });

  test("legacy array-form licenses ([{ type: ... }]) is parsed and flagged (SSPL)", () => {
    const dir = join(root, "node_modules", "bad-arr");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        name: "bad-arr",
        version: "1.0.0",
        licenses: [{ type: "SSPL-1.0" }],
      }),
    );
    const findings = checkExternalAgpl(
      [pkg({ name: "@caisson-sh/x", license: APACHE })],
      root,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("SSPL-1.0");
  });

  test("a scoped package (@scope/name) is walked and flagged", () => {
    writePackageJson(root, "@scope/bad", "@scope/bad", "AGPL-3.0-or-later");
    const findings = checkExternalAgpl(
      [
        pkg({
          name: "@caisson-sh/x",
          license: APACHE,
        }),
      ],
      root,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("node_modules/@scope/bad");
  });

  test("a missing/unlicensed dep is not flagged (unknowns keep the current pass posture)", () => {
    writePackageJson(root, "mystery", "mystery", undefined);
    const findings = checkExternalAgpl(
      [
        pkg({
          name: "@caisson-sh/x",
          license: APACHE,
        }),
      ],
      root,
    );
    expect(findings).toEqual([]);
  });

  test("a symlink cycle in node_modules does not hang or duplicate findings", () => {
    writePackageJson(root, "foo", "foo", "MIT");
    // foo/node_modules/loop -> node_modules (cycle back to the root install dir).
    mkdirSync(join(root, "node_modules", "foo", "node_modules"), {
      recursive: true,
    });
    symlinkSync(
      join(root, "node_modules"),
      join(root, "node_modules", "foo", "node_modules", "loop"),
      "dir",
    );
    const findings = checkExternalAgpl(
      [pkg({ name: "@caisson-sh/x", license: APACHE })],
      root,
    );
    expect(findings).toEqual([]);
  });

  test("node_modules absent WARNs instead of erroring", () => {
    rmSync(root, { recursive: true, force: true });
    mkdirSync(root, { recursive: true }); // root exists, but no node_modules
    const findings = checkExternalAgpl(
      [pkg({ name: "@caisson-sh/x", license: APACHE })],
      root,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("warn");
  });
});
