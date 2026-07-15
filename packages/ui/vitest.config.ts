import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const dir = dirname(fileURLToPath(import.meta.url));

// Storybook 10.5 trial (Kickoff-S task 10): a standalone Vitest config scoped to the storybook
// project only. This package's own `bun test ./src` suite (bun:test, not Vitest) is untouched —
// the two runners are wired to disjoint globs and neither script invokes the other.
//
// No `setupFiles` / `setProjectAnnotations` here: Storybook >=10.3's addon-vitest applies preview
// annotations (including the a11y addon's) automatically. An earlier hand-authored
// `.storybook/vitest.setup.ts` (following the addon's own "manual setup" doc example, which
// predates 10.3's auto-provisioning) produced a startup warning telling us to remove it — a
// version-drift documentation gap worth flagging (see the trial's friction log).
export default defineConfig({
  test: {
    name: "storybook",
    projects: [
      {
        extends: true,
        plugins: [
          storybookTest({
            configDir: join(dir, ".storybook"),
            storybookScript: "bun run storybook --ci",
          }),
        ],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            provider: playwright({}),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
