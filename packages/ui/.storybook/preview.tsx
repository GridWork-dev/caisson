import { useEffect } from "react";

import "../styles/tokens.css";
import "../styles/base.css";

import type { Decorator, Preview } from "@storybook/react-vite";

/**
 * @caisson-sh/ui themes via a `data-theme="dark"|"light"` attribute on the document root (see
 * `src/components/theme-toggle.tsx` + `styles/tokens.css`), not a class or CSS-in-JS branch. This
 * decorator drives that attribute off a Storybook toolbar global so every story is checked in both
 * modes without duplicating story content.
 */
const withTheme: Decorator = (Story, context) => {
  const theme = context.globals["theme"] === "light" ? "light" : "dark";
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return <Story />;
};

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      // Promote axe violations to a hard Vitest failure — matches the repo's existing
      // deterministic-gate posture (tokens-contrast.test.ts already fails the build on a
      // contrast regression; this makes DOM-level a11y violations fail the same way).
      test: "error",
    },
    backgrounds: { disable: true },
  },
  initialGlobals: {
    theme: "dark",
  },
  globalTypes: {
    theme: {
      description: "@caisson-sh/ui data-theme",
      toolbar: {
        title: "Theme",
        icon: "mirror",
        items: [
          { value: "dark", title: "Dark" },
          { value: "light", title: "Light" },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [withTheme],
};

export default preview;
