import { execFileSync } from "node:child_process";
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { readFileSync } from "node:fs";

// ADR-0419 (CAI-ASK-2c): publish-image.yml is a byte-identical copy of a shared upstream CI
// template (see its own header comment) that MUST NEVER BE EDITED in this repo. Its image-scan
// step ends `exit-code: ${{ vars.TRIVY_EXIT_CODE || '0' }}` — with the repository variable unset,
// caisson's deliberate posture is that image CVEs are RECORDED (SARIF) but never block a publish,
// because the blocking supply-chain gate is `scan.sh --layer ci` instead. That choice is written
// down in exactly one place today: the "record, never block" section of the security playbook.
// If upstream ever flips the fallback from '0' to '1', publish would start BLOCKING on every
// CRITICAL/HIGH image CVE with no local signal — the playbook prose would go silently false and
// every future publish would surprise-red on the first unfixed base-image finding.
//
// This is a static drift guard, not a policy opinion: it does not argue for record-vs-block, it
// just fails loudly the moment the template's actual text stops matching what the playbook (and
// this test) claims it says. There is no code path here to fix — only prose (the playbook) and,
// upstream, the template. Never edit publish-image.yml to make this test pass.

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
const TEMPLATE_PATH = join(REPO_ROOT, ".github/workflows/publish-image.yml");
const PLAYBOOK_PATH = join(REPO_ROOT, "docs/security/tooling-playbook.md");

// The exact fallback expression, byte-for-byte, as it appears in the trivy-action step today.
const FALLBACK_EXPR = "exit-code: ${{ vars.TRIVY_EXIT_CODE || '0' }}";

describe("publish-image.yml scan-posture drift guard (ADR-0419)", () => {
  test("the template still defaults TRIVY_EXIT_CODE to '0' (record, never block)", () => {
    const template = readFileSync(TEMPLATE_PATH, "utf8");
    // FAILURE MEANS: upstream (or a local edit — which must never happen, see the template's own
    // header) changed the fallback literal, most likely '0' -> '1'. Read the diff on
    // publish-image.yml against the shared upstream template first. If upstream genuinely flipped
    // the default, that is a real posture change: decide deliberately whether caisson wants image
    // CVEs to block publish, then update BOTH this literal and the playbook section below in the
    // same change. Never patch publish-image.yml itself to restore '0' — it is not this repo's
    // file to edit; open the change upstream instead.
    expect(template).toContain(FALLBACK_EXPR);
  });

  test("no workflow in this repo sets TRIVY_EXIT_CODE locally", () => {
    // Repository/organization variables aren't visible from the checked-out tree, so this can only
    // assert the negative it CAN see: no workflow file in .github/ references TRIVY_EXIT_CODE
    // outside the one template line asserted above. The only occurrences should be the fallback
    // expression itself plus the comments explaining it in publish-image.yml.
    //
    // FAILURE MEANS: a workflow now references TRIVY_EXIT_CODE somewhere this test didn't expect
    // (e.g. a second copy of the template, or a new workflow reading the same var). Re-derive
    // whether that's a second byte-identical template copy (fine — extend the allowed-file list
    // below) or an actual local override of the posture (a real decision — surface it, don't
    // silently let this test start passing on it).
    const hits = execFileSync(
      "grep",
      ["-rl", "TRIVY_EXIT_CODE", join(REPO_ROOT, ".github")],
      { encoding: "utf8" },
    )
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    expect(hits).toEqual([TEMPLATE_PATH]);
  });

  test("the playbook still documents the record-never-block posture", () => {
    const playbook = readFileSync(PLAYBOOK_PATH, "utf8");
    // FAILURE MEANS: the playbook section that is the ONLY standing record of this deliberate
    // choice was renamed, reworded past this heading, or deleted — so the posture above would be
    // undocumented even though it's still in force (deleting the prose doesn't delete the
    // posture). Restore the section, or if the posture itself changed, rewrite this heading and
    // the assertions above together so the test and the doc can never drift from each other again.
    expect(playbook).toContain(
      "### Image-publish scan (`publish-image.yml`) — record, never block",
    );
  });
});
