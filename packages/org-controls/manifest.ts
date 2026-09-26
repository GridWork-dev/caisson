// Registry manifest: must agree with package.json on id, version, license and the @caisson-sh/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest";

export default defineModule({
  id: "@caisson-sh/org-controls",
  version: pkg.version,
  license: pkg.license,
  dependencies: [
    "@caisson-sh/auth",
    "@caisson-sh/kernel",
    "@caisson-sh/tenancy-rls",
  ],
  description:
    "Org & operator controls: WorkOS SSO sign-in, the owner-gated multi-user membership surface (list/add/manage), and the cross-tenant admin-write RLS layer the operator control plane mutates through.",
});
