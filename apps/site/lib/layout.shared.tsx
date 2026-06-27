import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import { gitConfig } from "./shared";

// Shared options for the docs layout. The wordmark mirrors the marketing nav (lowercase
// monospace caisson / docs); the theme is owned by the site, not fumadocs (ADR-0042/0045).
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span style={{ fontFamily: "var(--cs-font-mono)" }}>
          caisson <span style={{ color: "var(--cs-fg-muted)" }}>/ docs</span>
        </span>
      ),
      url: "/",
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
