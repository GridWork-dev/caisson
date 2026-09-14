"""Offline contract tests; fake scanner statuses are deliberately unsafe fixtures."""

import json
import os
from pathlib import Path
import subprocess
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

    def test_scanner_uses_exact_digest_and_no_inherited_credentials(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            report = {"images": [IMAGE, SECOND]}
            # Synthetic credential-shaped environment NAMES, never real credentials.
            with patch.dict(os.environ, {"TRIVY_PASSWORD": "fixture", "AWS_SECRET_ACCESS_KEY": "fixture"}), \
                 patch.object(rescan.subprocess, "run", return_value=subprocess.CompletedProcess([], 0)) as run:
                self.assertEqual(rescan.scan(report, output), 0)
            self.assertEqual(run.call_count, 2)
            for call, image in zip(run.call_args_list, [IMAGE, SECOND]):
                argv = call.args[0]
                self.assertEqual(argv[-1], image)
                for flag, value in [("--image-src", "remote"), ("--platform", "linux/amd64"),
                                    ("--severity", "HIGH,CRITICAL"), ("--exit-code", "1")]:
                    self.assertEqual(argv[argv.index(flag) + 1], value)
                self.assertNotIn("--skip-db-update", argv)
                self.assertNotIn("--ignore-unfixed", argv)
                self.assertEqual(set(call.kwargs["env"]), {"PATH", "HOME", "DOCKER_CONFIG", "XDG_CONFIG_HOME", "TRIVY_CACHE_DIR"})
            self.assertEqual(json.loads((output / "base-images.json").read_text()), report)

    def test_findings_and_scanner_failure_stop_and_preserve_status(self):
        for code in [1, 23, -9]:
            with self.subTest(code=code), tempfile.TemporaryDirectory() as directory, \
                 patch.object(rescan.subprocess, "run", return_value=subprocess.CompletedProcess([], code)) as run:
                self.assertEqual(rescan.scan({"images": [IMAGE, SECOND]}, Path(directory)), max(code, 1))
                self.assertEqual(run.call_count, 1)

    def test_workflow_reaches_source_and_base_scanners_on_schedule(self):
        root = Path(__file__).resolve().parents[2]
        workflow = (root / ".github/workflows/security-scan.yml").read_text()
        self.assertIn('cron: "37 6 * * *"', workflow)
        self.assertIn("bash tools/security/scan.sh --layer ci --strict-digests", workflow)
        self.assertIn('python3 tools/security/rescan_base_images.py --output "$RUNNER_TEMP/security-out"', workflow)
        self.assertIn("steps.scanners.outcome == 'success'", workflow)
        self.assertIn("persist-credentials: false", workflow)
        self.assertNotIn("schedule:", (root / ".github/workflows/publish-image.yml").read_text())


if __name__ == "__main__":
    unittest.main()
