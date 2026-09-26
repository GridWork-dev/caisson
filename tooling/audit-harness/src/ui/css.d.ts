// The composed `@caisson-sh/ui` components side-import their co-located `.css` (the ADR-0099
// recipe). This ambient declaration lets `tsc` resolve those side-effect imports when it pulls
// the kit's raw `.tsx` source into this package's program. The consuming bundler (Next via
// `transpilePackages`) emits the actual CSS.
declare module "*.css";
