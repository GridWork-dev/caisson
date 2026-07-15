import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { StorybookConfig } from "@storybook/react-vite";

/**
 * Resolve an addon package to an absolute directory instead of a bare specifier. `storybook init`
 * crashed under this Bun workspace (see the Kickoff-S trial notes) before it finished scaffolding
 * this file, so this config is hand-authored; the getAbsolutePath indirection is the pattern the
 * CLI's own template used and is the documented fix for addon resolution inside a workspace where
 * a bare package name may not resolve relative to `.storybook/`.
 */
function getAbsolutePath(value: string): string {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: [
    getAbsolutePath("@storybook/addon-docs"),
    getAbsolutePath("@storybook/addon-a11y"),
    getAbsolutePath("@storybook/addon-vitest"),
    {
      name: getAbsolutePath("@storybook/addon-mcp"),
      options: {
        toolsets: {
          dev: true,
          docs: true,
        },
      },
    },
  ],
  framework: {
    name: getAbsolutePath("@storybook/react-vite"),
    options: {},
  },
  // Required for addon-mcp's docs toolset (component manifest generation); React-only per the
  // addon's README.
  features: {
    experimentalComponentsManifest: true,
  },
  typescript: {
    reactDocgen: "react-docgen-typescript",
  },
  core: {
    // No anonymous-usage egress from a repo-security-floor trial (identity/security.md
    // acknowledged-sinks ledger has no Storybook telemetry entry).
    disableTelemetry: true,
  },
};

export default config;
