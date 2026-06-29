// Component kit barrel (ADR-0097). Consumers import from `@caisson/ui/components`; set
// `transpilePackages: ["@caisson/ui"]` in next.config so the raw .tsx + co-located .css transpile.
// Kit-first rule: new reusable UI lands HERE, never inlined on a screen.
export { Button } from "./button";
export type { ButtonProps, ButtonSize, ButtonVariant } from "./button";
