"""Offline policy fixtures intentionally contain known synthetic vulnerabilities."""

import copy
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import image_scan_policy as policy
import rescan_base_images as bases
import rescan_runtime_images as runtimes


def fixture(fixed="5.40.1-6+deb13u1", severity="CRITICAL", package_class="os-pkgs"):
    return {"SchemaVersion": 2, "ArtifactName": "fixture", "Metadata": {"OS": {"Family": "debian"}},
            "Results": [{"Class": "os-pkgs", "Target": "debian", "Vulnerabilities": []},
                        {"Class": package_class, "Target": "fixture", "Vulnerabilities": [{
                            "VulnerabilityID": "CVE-2026-13221", "PkgName": "perl-base",
                            "InstalledVersion": "5.40.1-6", "FixedVersion": fixed, "Severity": severity,
                        }]}]}


def fake_scanner(report):
    def run(argv, **kwargs):
        Path(argv[argv.index("--output") + 1]).write_text(json.dumps(report))
        return subprocess.CompletedProcess(argv, 0)
    return run


class RuntimeImagesTests(unittest.TestCase):
    def test_fixable_os_row_fails_runtime_but_only_reports_base(self):
        for severity in ["HIGH", "CRITICAL"]:
            report = fixture(severity=severity)
            with tempfile.TemporaryDirectory() as directory, \
                 patch.object(policy.subprocess, "run", side_effect=fake_scanner(report)):
                output = Path(directory)
                self.assertEqual(policy.scan_image("fixture", output / "runtime.json", "runtime"), 1)
                self.assertEqual(bases.scan({"images": ["fixture"]}, output), 0)
                runtime = json.loads((output / "runtime.summary.json").read_text())
                base = json.loads((output / "base-1.summary.json").read_text())
                self.assertEqual(runtime["findings"], base["findings"])
                self.assertEqual(len(base["fixableHighCritical"]), 1)
                self.assertEqual(base["exitCode"], 0)

    def test_application_rows_only_report_in_json_and_job_summary(self):
        for severity in ["HIGH", "CRITICAL"]:
            for package_type in ["node-pkg", "python-pkg", "gobinary"]:
                with self.subTest(severity=severity, package_type=package_type):
                    report = fixture(severity=severity, package_class="lang-pkgs")
                    report["Results"][1]["Type"] = package_type
                    with tempfile.TemporaryDirectory() as directory, \
                         patch.object(policy.subprocess, "run", side_effect=fake_scanner(report)):
                        output = Path(directory)
                        job_summary = output / "job.md"
                        with patch.dict(os.environ, {"GITHUB_STEP_SUMMARY": str(job_summary)}):
                            self.assertEqual(policy.scan_image("fixture", output / "runtime.json", "runtime"), 0)
                        summary = json.loads((output / "runtime.summary.json").read_text())
                        self.assertEqual(len(summary["applicationFindings"]), 1)
                        self.assertEqual(summary["fixableOSHighCritical"], [])
                        row = summary["applicationFindings"][0]
                        self.assertEqual(row["type"], package_type)
                        self.assertEqual(row["fixed"], "5.40.1-6+deb13u1")
                        rendered = job_summary.read_text()
                        for value in ["report only", row["id"], row["package"], row["installed"],
                                      row["fixed"], severity, package_type]:
                            self.assertIn(value, rendered)

    def test_mixed_report_still_enforces_os_and_preserves_application_rows(self):
        report = fixture(severity="HIGH")
        report["Results"].extend(fixture(package_class="lang-pkgs")["Results"][1:])
        summary = policy.evaluate(report, "runtime")
        self.assertEqual(summary["exitCode"], 1)
        self.assertEqual(len(summary["fixableOSHighCritical"]), 1)
        self.assertEqual(len(summary["applicationFindings"]), 1)
        self.assertEqual(len(summary["findings"]), 2)

    def test_unfixed_and_lower_severity_rows_remain_visible_without_failing(self):
        for report in [fixture(fixed=""), fixture(severity="MEDIUM")]:
            summary = policy.evaluate(report, "runtime")
            self.assertEqual(summary["exitCode"], 0)
            self.assertEqual(len(summary["findings"]), 1)
        self.assertEqual(len(policy.evaluate(fixture(fixed=""), "runtime")["unfixed"]), 1)

    def test_malformed_or_absent_os_coverage_fails_closed(self):
        bad = copy.deepcopy(fixture())
        bad["Results"][1]["Vulnerabilities"][0]["FixedVersion"] = None
        for report in [{}, {"SchemaVersion": 2, "Results": []}, bad]:
            with self.assertRaises(ValueError):
                policy.evaluate(report, "runtime")

    def test_scanner_uses_explicit_sources_fresh_db_and_no_credentials(self):
        with tempfile.TemporaryDirectory() as directory, \
             patch.dict(os.environ, {"TRIVY_PASSWORD": "fixture", "AWS_SECRET_ACCESS_KEY": "fixture"}), \
             patch.object(policy.subprocess, "run", side_effect=fake_scanner(fixture(fixed=""))) as run:
            for kind, source in [("runtime", "docker"), ("base", "remote")]:
                self.assertEqual(policy.scan_image("exact-image", Path(directory) / f"{kind}.json", kind), 0)
                argv = run.call_args.args[0]
                self.assertEqual(argv[-1], "exact-image")
                for flag, value in [("--image-src", source), ("--platform", "linux/amd64"),
                                    ("--format", "json"), ("--exit-code", "0")]:
                    self.assertEqual(argv[argv.index(flag) + 1], value)
                self.assertNotIn("--ignore-unfixed", argv)
                self.assertNotIn("--skip-db-update", argv)
                self.assertEqual(set(run.call_args.kwargs["env"]), {
                    "PATH", "HOME", "DOCKER_CONFIG", "XDG_CONFIG_HOME", "TRIVY_CACHE_DIR"})

    def test_runtime_scanner_error_or_missing_output_fails_closed(self):
        for code in [1, 23, -9, 0]:
            with tempfile.TemporaryDirectory() as directory, \
                 patch.object(policy.subprocess, "run", return_value=subprocess.CompletedProcess([], code)):
                with self.assertRaises((RuntimeError, OSError)):
                    policy.scan_image("fixture", Path(directory) / "absent.json", "runtime")

    def test_runtime_matrix_covers_final_stages_and_migrations(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "Dockerfile").write_text("FROM x AS build\nFROM build AS migrate\nFROM x AS runtime\n")
            (root / "Dockerfile.single").write_text("FROM x\n")
            with patch.object(runtimes, "census", return_value={"dockerfiles": ["Dockerfile", "Dockerfile.single"]}):
                matrix = runtimes.runtime_targets(root)["include"]
            self.assertEqual([(r["dockerfile"], r["target"]) for r in matrix], [
                ("Dockerfile", "runtime"), ("Dockerfile", "migrate"), ("Dockerfile.single", "")])
            self.assertEqual({r["context"] for r in matrix}, {"."})

    def test_workflow_runs_uncached_local_build_and_enforcement_on_schedule(self):
        root = Path(__file__).resolve().parents[2]
        workflow = (root / ".github/workflows/security-scan.yml").read_text()
        for text in ['cron: "37 6 * * *"', "no-cache: true", "push: false", "load: true",
                     "platforms: linux/amd64", "rescan_runtime_images.py --matrix",
                     'rescan_runtime_images.py --image "$IMAGE"', "runtime-rescan-", "if: always()"]:
            self.assertIn(text, workflow)
        # Zero first-party Dockerfiles skips the matrix and the gate reports it, never a vacuous green.
        for text in ["count: ${{ steps.select.outputs.count }}",
                     "if: needs.runtime-select.outputs.count != '0'",
                     'test "$MATRIX_RESULT" = skipped', "0 Dockerfiles"]:
            self.assertIn(text, workflow)
        runtime_job = workflow.split("  runtime-images:")[1]
        self.assertNotIn("continue-on-error", runtime_job)
        self.assertNotIn("secrets.", runtime_job)
        self.assertNotIn("registry", runtime_job.replace("registry writes", ""))


if __name__ == "__main__":
    unittest.main()
