"""R344: retain full reports; gate only fixable HIGH/CRITICAL runtime OS rows."""

import html
import json
import os
from pathlib import Path
import subprocess
import tempfile


def evaluate(report: dict, kind: str) -> dict:
    if kind not in {"runtime", "base"}:
        raise ValueError("unknown image policy")
    if report.get("SchemaVersion") != 2 or not isinstance(report.get("Results"), list):
        raise ValueError("missing or unsupported Trivy report")
    metadata = report.get("Metadata", {})
    if not metadata.get("OS") or not any(r.get("Class") == "os-pkgs" for r in report["Results"]):
        raise ValueError("expected OS package scan; refusing empty coverage")
    findings = []
    for result in report["Results"]:
        vulnerabilities = result.get("Vulnerabilities") or []
        if not isinstance(vulnerabilities, list):
            raise ValueError("invalid vulnerability list")
        for row in vulnerabilities:
            if not all(isinstance(row.get(key), str) and row[key] for key in
                       ["VulnerabilityID", "PkgName", "InstalledVersion", "Severity"]):
                raise ValueError("invalid vulnerability row")
            fixed = row.get("FixedVersion", "")
            if not isinstance(fixed, str) or row["Severity"] not in {
                "UNKNOWN", "LOW", "MEDIUM", "HIGH", "CRITICAL"
            }:
                raise ValueError("invalid severity or fixed version")
            findings.append({
                "target": result.get("Target"), "class": result.get("Class"),
                "type": result.get("Type"),
                "id": row["VulnerabilityID"], "package": row["PkgName"],
                "installed": row["InstalledVersion"], "fixed": fixed,
                "severity": row["Severity"], "status": row.get("Status"),
            })
    fixable = [row for row in findings if row["fixed"].strip()
                and row["severity"] in {"HIGH", "CRITICAL"}]
    blocking = [row for row in fixable if row["class"] == "os-pkgs"]
    return {"kind": kind, "artifact": report.get("ArtifactName"),
            "os": metadata["OS"], "imageId": metadata.get("ImageID"),
            "fixableHighCritical": fixable, "fixableOSHighCritical": blocking,
            "applicationFindings": [row for row in findings if row["class"] != "os-pkgs"],
            "unfixed": [row for row in findings if not row["fixed"].strip()],
            "findings": findings, "exitCode": 1 if kind == "runtime" and blocking else 0}


def write_job_summary(summary: dict) -> None:
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not path:
        return

    def cell(value):
        return html.escape(str(value or "—")).replace("|", "&#124;").replace("\n", " ").replace("\r", " ")

    lines = [f"\n### Image scan: {cell(summary['artifact'])}",
             "Runtime policy: only fixable HIGH/CRITICAL OS rows enforce. Raw bases report only.",
             f"Fixable HIGH/CRITICAL OS rows: {len(summary['fixableOSHighCritical'])}. "
             f"Unfixed rows (all classes): {len(summary['unfixed'])}. Policy exit: {summary['exitCode']}.",
             "\nApplication residual — report only (all severities, including fixable rows):",
             "\n| Target | Type | ID | Package | Installed | Fixed | Severity |",
             "| --- | --- | --- | --- | --- | --- | --- |"]
    for row in summary["applicationFindings"]:
        lines.append("| " + " | ".join(cell(row.get(key)) for key in
                     ["target", "type", "id", "package", "installed", "fixed", "severity"]) + " |")
    if not summary["applicationFindings"]:
        lines.append("\nNo application findings in this report.")
    with Path(path).open("a") as output:
        output.write("\n".join(lines) + "\n")


def scan_image(image: str, output: Path, kind: str) -> int:
    output.parent.mkdir(parents=True, exist_ok=True)
    # No inherited registry login/cloud/scanner settings. Local runtime scans use only
    # the disposable runner's default Docker socket; base reads are anonymous remote.
    with tempfile.TemporaryDirectory(prefix="caisson-image-scan-") as temporary:
        clean = Path(temporary)
        (clean / "config.yaml").write_text("{}\n")
        (clean / "ignore").write_text("")
        env = {"PATH": os.environ.get("PATH", os.defpath), "HOME": temporary,
               "DOCKER_CONFIG": str(clean / "docker"), "XDG_CONFIG_HOME": temporary,
               "TRIVY_CACHE_DIR": str(clean / "cache")}
        result = subprocess.run([
            "trivy", "image", "--image-src", "docker" if kind == "runtime" else "remote",
            "--platform", "linux/amd64", "--config", str(clean / "config.yaml"),
            "--ignorefile", str(clean / "ignore"), "--scanners", "vuln",
            "--severity", "UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL", "--exit-code", "0",
            "--timeout", "10m", "--format", "json", "--output", str(output), image,
        ], env=env, check=False, timeout=660)
        if result.returncode != 0:
            raise RuntimeError(f"Trivy scan failed with status {result.returncode}")
    summary = evaluate(json.loads(output.read_text()), kind)
    output.with_suffix(".summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    write_job_summary(summary)
    print(json.dumps({"image": image, "kind": kind,
                      "fixableHighCritical": len(summary["fixableHighCritical"]),
                      "fixableOSHighCritical": len(summary["fixableOSHighCritical"]),
                      "applicationFindings": len(summary["applicationFindings"]),
                      "unfixed": len(summary["unfixed"]), "exitCode": summary["exitCode"]}), flush=True)
    return summary["exitCode"]
