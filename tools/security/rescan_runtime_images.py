"""Build matrix and enforcing scanner for actual first-party runtime images."""

import argparse
import json
from pathlib import Path
import re
import sys

from image_scan_policy import scan_image
from rescan_base_images import census


def runtime_targets(root: Path) -> dict:
    report = census(root)
    targets = []
    for path in report["dockerfiles"]:
        # census has already rejected unsupported FROM syntax and unpinned sources.
        stages = []
        for line in (root / path).read_text().splitlines():
            if re.match(r"^\s*FROM\s", line, re.IGNORECASE):
                parts = line.split()
                stages.append(parts[-1] if len(parts) >= 4 and parts[-2].lower() == "as" else "")
        if not stages:
            raise ValueError(f"{path}: no runtime stage")
        selected = list(dict.fromkeys([stages[-1], *[s for s in stages if s.lower() == "migrate"]]))
        for stage in selected:
            name = re.sub(r"[^a-z0-9-]", "-", path.lower()) + "-" + (stage or "final")
            targets.append({"name": name, "dockerfile": path, "target": stage, "context": "."})
    return {"include": targets}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--matrix", action="store_true")
    parser.add_argument("--image")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    if args.matrix:
        matrix = runtime_targets(root)
        print(json.dumps(matrix))
        dockerfiles = len({t["dockerfile"] for t in matrix["include"]})
        print(f"runtime images: {dockerfiles} Dockerfiles, {len(matrix['include'])} targets", file=sys.stderr)
        return 0
    if not args.image or args.output is None:
        parser.error("--image and --output are required for runtime scans")
    if not re.fullmatch(r"caisson-runtime-rescan:[a-z0-9-]+", args.image):
        parser.error("runtime image must be a local caisson-runtime-rescan tag")
    return scan_image(args.image, args.output.resolve(), "runtime")


if __name__ == "__main__":
    raise SystemExit(main())
