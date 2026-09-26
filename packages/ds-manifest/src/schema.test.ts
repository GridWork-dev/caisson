import { describe, expect, test } from "bun:test";
import {
  type Component,
  type ComponentManifest,
  parseComponentManifest,
} from "./schema";

const okComponent: Component = {
  name: "Button",
  summary: "Primary interactive control.",
  props: [
    {
      name: "variant",
      type: '"primary" | "ghost"',
      optional: true,
      doc: "Visual weight.",
    },
  ],
  variants: { variant: ["primary", "ghost"] },
  tokenDeps: ["--cs-accent", "--cs-fg"],
  a11yNotes: ['defaults type="button" to avoid an accidental form submit'],
  recipeRules: ["co-located-css-cs-tokens-only"],
  hasDataStar: true,
};

const validManifest: ComponentManifest = {
  schemaVersion: 1,
  generatedFor: { pkg: "@caisson-sh/ui", version: "0.6.0" },
  components: [okComponent],
};

describe("componentManifestSchema", () => {
  test("parses a valid manifest", () => {
    const parsed = parseComponentManifest(validManifest);
    expect(parsed.components).toHaveLength(1);
    expect(parsed.components[0]?.name).toBe("Button");
  });

  test("a component with no variant union parses with an empty variants map", () => {
    const noVariant: ComponentManifest = {
      ...validManifest,
      components: [{ ...okComponent, variants: {}, hasDataStar: false }],
    };
    expect(() => parseComponentManifest(noVariant)).not.toThrow();
  });

  test("rejects an unknown top-level field", () => {
    expect(() =>
      parseComponentManifest({ ...validManifest, extra: true }),
    ).toThrow();
  });

  test("rejects an unknown field on a component", () => {
    const bad = {
      ...validManifest,
      components: [{ ...okComponent, extra: true }],
    };
    expect(() => parseComponentManifest(bad)).toThrow();
  });

  test("rejects an unknown field on a prop", () => {
    const bad = {
      ...validManifest,
      components: [
        {
          ...okComponent,
          props: [{ ...okComponent.props[0], extra: true }],
        },
      ],
    };
    expect(() => parseComponentManifest(bad)).toThrow();
  });

  test("rejects a non-integer schemaVersion", () => {
    expect(() =>
      parseComponentManifest({ ...validManifest, schemaVersion: 1.5 }),
    ).toThrow();
  });
});
