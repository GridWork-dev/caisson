"""Offline contract tests; fake scanner statuses are deliberately unsafe fixtures."""

import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import rescan_base_images as rescan


IMAGE = "oven/bun:1.4.2-slim@sha256:" + "a" * 64
SECOND = "python:3.14-slim@sha256:" + "b" * 64


class RescanTests(unittest.TestCase):
    def test_external_bases_and_actual_prior_aliases(self):
        text = f"FROM {IMAGE} AS build\nFROM build AS runtime\nFROM scratch\nFROM {SECOND}\n"
        self.assertEqual(rescan.from_images(text, "Dockerfile"), [
            {"image": IMAGE, "path": "Dockerfile", "line": 1},
            {"image": SECOND, "path": "Dockerfile", "line": 4},
        ])
        self.assertEqual(len(rescan.from_images(f"from --platform=linux/amd64 {IMAGE} as build", "D")), 1)

    def test_unknown_alias_is_not_silently_ignored(self):
        for source in ["FROM ubuntu", "FROM unknown AS final", "FROM $BASE", "FROM oven/bun:latest",
                       "FROM x@sha256:abc", f"FROM --platform=linux/arm64 {IMAGE}", "# empty"]:
            with self.subTest(source=source), self.assertRaises(ValueError):
                rescan.from_images(source, "D")

    def test_census_deduplicates_and_excludes_only_templates(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in ["apps/site/Dockerfile", "services/new/Dockerfile.extra"]:
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(f"FROM {IMAGE}\nFROM {IMAGE}\n")
            paths = "apps/site/Dockerfile\0services/new/Dockerfile.extra\0packages/cli/templates/Dockerfile\0README.md\0"
            with patch.object(rescan, "git", side_effect=[paths, "deadbeef\n"]):
                report = rescan.census(root)
            self.assertEqual(report["images"], [IMAGE])
            self.assertEqual(len(report["references"]), 4)
            self.assertEqual(len(report["dockerfiles"]), 2)
            with patch.object(rescan, "git", return_value=""):
                with self.assertRaisesRegex(ValueError, "empty scan"):
                    rescan.census(root)

    def test_census_reports_zero_dockerfiles_when_the_tree_has_none(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(rescan, "git", side_effect=["README.md\0packages/cli/templates/Dockerfile\0", "deadbeef\n"]):
                report = rescan.census(Path(directory))
            self.assertEqual(report["dockerfiles"], [])
            self.assertEqual(report["images"], [])

    def test_census_refuses_dockerfiles_that_yield_no_external_base(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "Dockerfile").write_text("FROM scratch\n")
            with patch.object(rescan, "git", side_effect=["Dockerfile\0", "deadbeef\n"]):
                with self.assertRaisesRegex(ValueError, "no external base images"):
                    rescan.census(root)

    def test_raw_base_findings_report_and_operational_errors_continue(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            with patch.object(rescan.image_scan_policy, "scan_image", side_effect=[RuntimeError("fixture"), 0]) as scan:
                self.assertEqual(rescan.scan({"images": [IMAGE, SECOND]}, output), 0)
                self.assertEqual(scan.call_count, 2)
                self.assertEqual([c.args[2] for c in scan.call_args_list], ["base", "base"])
            self.assertEqual(len(json.loads((output / "base-scan-errors.json").read_text())), 1)

    def test_workflow_reaches_source_and_base_scanners_on_schedule(self):
        root = Path(__file__).resolve().parents[2]
        workflow = (root / ".github/workflows/security-scan.yml").read_text()
        self.assertIn('cron: "37 6 * * *"', workflow)
        self.assertIn("bash tools/security/scan.sh --layer ci --strict-digests", workflow)
        self.assertIn('python3 tools/security/rescan_base_images.py --output "$RUNNER_TEMP/security-out"', workflow)
        self.assertIn("steps.scanners.outcome == 'success'", workflow)
        self.assertIn("continue-on-error: true # R335", workflow)
        self.assertIn("persist-credentials: false", workflow)


if __name__ == "__main__":
    unittest.main()
