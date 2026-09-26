#!/usr/bin/env python3
"""Scan declared public base digests, without registry credentials or a daemon."""

import argparse
import json
from pathlib import Path
import re
import subprocess
import image_scan_policy


PIN = re.compile(r"[a-zA-Z0-9][a-zA-Z0-9._/:+-]*@sha256:[0-9a-f]{64}")


def from_images(text: str, path: str) -> list[dict]:
    aliases = set()
    images = []
    count = 0
    for number, line in enumerate(text.splitlines(), 1):
        if not re.match(r"^\s*FROM(?:\s|$)", line, re.IGNORECASE):
            continue
        count += 1
        parts = line.split()[1:]
        if parts and parts[0] == "--platform=linux/amd64":
            parts = parts[1:]
        if not (len(parts) == 1 or (len(parts) == 3 and parts[1].lower() == "as")):
            raise ValueError(f"{path}:{number}: unsupported FROM syntax")
        image = parts[0]
        if image.lower() not in aliases and image.lower() != "scratch":
            if not PIN.fullmatch(image):
                raise ValueError(f"{path}:{number}: expected a literal sha256-pinned base")
            images.append({"image": image, "path": path, "line": number})
        if len(parts) == 3:
            if not re.fullmatch(r"[a-zA-Z][a-zA-Z0-9_.-]*", parts[2]):
                raise ValueError(f"{path}:{number}: unsupported stage alias")
            aliases.add(parts[2].lower())
    if count == 0:
        raise ValueError(f"{path}: no FROM instructions")
    return images


def git(root: Path, *args: str) -> str:
    return subprocess.check_output(["git", "-C", str(root), *args], text=True, timeout=30)


def census(root: Path, ref: str | None = None) -> dict:
    tracked = git(root, "ls-tree", "-rz", "--name-only", ref) if ref else git(root, "ls-files", "-z")
    if not tracked.strip("\0"):
        # No tracked files at all means the census could not see the tree, not that it is clean.
        raise ValueError("no tracked files; refusing an empty scan")
    paths = sorted(
        path for path in tracked.split("\0") if path
        and (Path(path).name == "Dockerfile" or Path(path).name.startswith("Dockerfile."))
        and not path.startswith("packages/cli/templates/")
    )
    records = []
    for path in paths:
        resolved = (root / path).resolve()
        if not resolved.is_relative_to(root.resolve()):
            raise ValueError(f"{path}: Dockerfile escapes checkout")
        text = git(root, "show", f"{ref}:{path}") if ref else resolved.read_text()
        records.extend(from_images(text, path))
    # Zero Dockerfiles is a legitimate, reported state (the tree ships no runtime image); callers
    # print the count so the zero is visible rather than silent.
    return {
        "source": git(root, "rev-parse", ref or "HEAD").strip(),
        "dockerfiles": paths,
        "references": records,
        "images": sorted({record["image"] for record in records}),
        "platform": "linux/amd64",
    }


def scan(report: dict, output: Path) -> int:
    output.mkdir(parents=True, exist_ok=True)
    (output / "base-images.json").write_text(json.dumps(report, indent=2) + "\n")
    errors = []
    for index, image in enumerate(report["images"]):
        try:
            image_scan_policy.scan_image(image, output / f"base-{index + 1}.json", "base")
        except (RuntimeError, ValueError, OSError, subprocess.SubprocessError) as error:
            # R335: informational means operational failures are visible, not a gate.
            errors.append({"image": image, "error": str(error)})
            print(f"::warning::raw base scan failed for image {index + 1}", flush=True)
    (output / "base-scan-errors.json").write_text(json.dumps(errors, indent=2) + "\n")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--list", action="store_true", help="print census without network access")
    parser.add_argument("--ref", help="git ref for read-only census; requires --list")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.ref and not args.list:
        parser.error("--ref requires --list; scans always use the checked-out source")
    root = Path(__file__).resolve().parents[2]
    report = census(root, args.ref)
    if args.list:
        print(json.dumps(report, indent=2))
        return 0
    if args.output is None:
        parser.error("--output is required for scanning")
    return scan(report, args.output.resolve())


if __name__ == "__main__":
    raise SystemExit(main())
