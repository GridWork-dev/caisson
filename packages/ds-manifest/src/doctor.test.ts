// Proves the static doctor is the SPEC's acceptance shape: zero findings on a correct-usage screen
// that uses >=3 kit components, typed findings on deliberately broken usage (unknown import, token
// override + hard-coded colour, invalid data-variant, missing aria-describedby wiring, version
// skew), and a WCAG contrast regression on a flattened theme — via checkContrast, the kit's own gate.
// Fixture sources are inline string constants (not .tsx files) so tsc never tries to compile them.
import { describe, expect, test } from "bun:test";
import { loadBaseManifest } from "./read.ts";
import {
  checkUsage,
  type ContrastFunctional,
  type ContrastTheme,
} from "./index.ts";

const manifest = loadBaseManifest();
const darkTheme: ContrastTheme = {
  bg: "#000000",
  surface1: "#000000",
  surface2: "#000000",
  border: "#777777",
  borderStrong: "#ffffff",
  fg: "#ffffff",
  fgMuted: "#ffffff",
  accent: "#ffffff",
  accentHover: "#ffffff",
  onAccent: "#000000",
  accentTint: "#000000",
  focus: "#ffffff",
  link: "#ffffff",
  glowAccent: "#000000",
  scrim: "#000000",
};
const functionalDark: ContrastFunctional = {
  success: "#ffffff",
  warning: "#ffffff",
  danger: "#ffffff",
  info: "#ffffff",
};

// A brand-conformant screen using three kit components the right way — no colour literals, no token
// overrides, no data-* variants, no hand-rolled aria. This is the "no-credentials agent builds a
// working screen" half of the SPEC acceptance.
const CORRECT_SCREEN = `
import { Button, Card, FormField } from "@caisson-sh/ui";

export function SignupPanel() {
  return (
    <Card accent>
      <h2>Create your account</h2>
      <FormField label="Work email" helperText="We only use this for login.">
        <input type="email" name="email" />
      </FormField>
      <Button variant="primary">Create account</Button>
    </Card>
  );
}
`;

// One file that breaks five different rules at once.
const BROKEN_SCREEN = `
import { Button, Frobnicate } from "@caisson-sh/ui";

export function BrokenPanel() {
  return (
    <div style={{ "--cs-accent": "#ff0000" }}>
      <Frobnicate />
      <Button data-variant="tertiary">Go</Button>
      <input aria-invalid="true" />
      <span style={{ color: "oklch(0.5 0.1 200)" }}>x</span>
    </div>
  );
}
`;

const BROKEN_PACKAGE_JSON = `{
  "name": "buyer-app",
  "dependencies": { "@caisson-sh/ui": "^0.5.0" }
}`;

describe("checkUsage — correct usage", () => {
  test("a clean >=3-component screen yields zero findings", () => {
    expect(
      checkUsage(manifest, {
        files: [{ path: "src/SignupPanel.tsx", contents: CORRECT_SCREEN }],
      }),
    ).toEqual([]);
  });
});

describe("checkUsage — broken usage yields typed findings", () => {
  const findings = checkUsage(manifest, {
    files: [{ path: "src/BrokenPanel.tsx", contents: BROKEN_SCREEN }],
  });
  const rules = new Set(findings.map((f) => f.rule));

  test("flags the hallucinated import, token override, colour literals, bad variant, and aria gap", () => {
    expect(rules).toContain("unknown-component");
    expect(rules).toContain("token-override");
    expect(rules).toContain("raw-color-literal");
    expect(rules).toContain("invalid-variant");
    expect(rules).toContain("missing-aria-describedby");
  });

  test("every finding is typed and file-anchored with a severity", () => {
    for (const f of findings) {
      expect(f.file).toBe("src/BrokenPanel.tsx");
      expect(["error", "warning"]).toContain(f.severity);
      expect(f.message.length).toBeGreaterThan(0);
    }
  });

  test("the unknown import points at the component name and a line", () => {
    const f = findings.find((x) => x.rule === "unknown-component");
    expect(f?.message).toContain("Frobnicate");
    expect(f?.loc?.line).toBeGreaterThan(0);
  });

  // Real buyers import from the `@caisson-sh/ui/components` subpath (the root barrel is tokens+theme
  // only) — the headline unknown-component check must fire on that path, not just the bare barrel.
  test("a hallucinated import from the real /components subpath is flagged", () => {
    const real = `import { Button, Frobnicate } from "@caisson-sh/ui/components";\n<Frobnicate />`;
    const f = checkUsage(manifest, {
      files: [{ path: "src/Screen.tsx", contents: real }],
    });
    const unknown = f.find((x) => x.rule === "unknown-component");
    expect(unknown?.message).toContain("Frobnicate");
    expect(f.some((x) => x.message.includes("Button"))).toBe(false); // real component, not flagged
  });
});

describe("checkUsage — version skew from package.json", () => {
  test("a mismatched @caisson-sh/ui pin is flagged against the manifest version", () => {
    const findings = checkUsage(manifest, {
      files: [{ path: "package.json", contents: BROKEN_PACKAGE_JSON }],
    });
    const skew = findings.find((f) => f.rule === "version-skew");
    expect(skew).toBeDefined();
    expect(skew?.message).toContain(manifest.generatedFor.version);
    expect(skew?.file).toBe("package.json");
    expect(skew?.message).toContain("pins @caisson-sh/ui");
  });
});

describe("checkUsage — contrast gate over a buyer theme", () => {
  test("a flattened theme (fg == bg) raises a contrast finding", () => {
    const flattened: ContrastTheme = { ...darkTheme, fg: darkTheme.bg };
    const findings = checkUsage(manifest, {
      files: [],
      themes: [
        {
          mode: "dark",
          file: "theme.ts",
          theme: flattened,
          fn: functionalDark,
        },
      ],
    });
    const contrast = findings.filter((f) => f.rule === "contrast");
    expect(contrast.length).toBeGreaterThan(0);
    expect(contrast[0]?.file).toBe("theme.ts");
  });

  test("the live dark theme raises no contrast finding", () => {
    const findings = checkUsage(manifest, {
      files: [],
      themes: [
        {
          mode: "dark",
          file: "theme.ts",
          theme: darkTheme,
          fn: functionalDark,
        },
      ],
    });
    expect(findings.filter((f) => f.rule === "contrast")).toEqual([]);
  });
});

describe("checkUsage — untrusted input is strict-validated", () => {
  test("an unknown field on a file is rejected (.strict boundary)", () => {
    expect(() =>
      checkUsage(manifest, {
        files: [{ path: "x.tsx", contents: "", sneaky: true }],
      }),
    ).toThrow();
  });
});
