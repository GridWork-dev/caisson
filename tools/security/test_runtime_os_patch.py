"""R333: runtime targets inherit an OS upgrade without changing base pins."""

from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[2]
TARGETS = {
    "services/license/Dockerfile": ["migrate", "runtime"],
}
BUN = "oven/bun:1.4.2-slim@sha256:cb3bbbb08e13a4a2ff400f24c7a2a1d5efa83f6ef8544d52d95a519631e2fc61"
UPGRADE = "RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get upgrade -y && rm -rf /var/lib/apt/lists/*"


def stages(text):
    states = {}
    current = None
    for line in text.splitlines():
        if line.startswith("FROM "):
            parts = line.split()
            current = parts[3] if len(parts) == 4 else str(len(states))
            states[current] = states.get(parts[1], False)
        elif line == UPGRADE:
            states[current] = True
    return states


class RuntimePatchTests(unittest.TestCase):
    def test_all_runtime_and_migration_targets_are_patched(self):
        for name, targets in TARGETS.items():
            with self.subTest(dockerfile=name):
                states = stages((ROOT / name).read_text())
                for target in targets:
                    self.assertTrue(states[target], f"{name}:{target} lacks OS upgrade")

    def test_base_pins_stay_locked_and_upgrade_runs_before_nonroot(self):
        for name in TARGETS:
            text = (ROOT / name).read_text()
            external = re.findall(r"^FROM (\S+@sha256:\S+)", text, re.MULTILINE)
            self.assertTrue(external)
            self.assertEqual(set(external), {BUN})
            root_user = True
            for line in text.splitlines():
                if line.startswith("FROM ") and "@sha256:" in line:
                    root_user = True
                elif line.startswith("USER "):
                    root_user = line.split()[1] in ["root", "0"]
                elif line == UPGRADE:
                    self.assertTrue(root_user, f"{name}: upgrade runs after USER")


if __name__ == "__main__":
    unittest.main()
