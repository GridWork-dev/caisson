// Registry manifest: must agree with package.json on id, version, license and the @caisson-sh/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../registry-schema/src/module-manifest.ts";

export default defineModule({
  id: "@caisson-sh/jobs",
  version: pkg.version,
  license: pkg.license,
  dependencies: ["@caisson-sh/kernel", "@caisson-sh/tenancy-rls"],
  description:
    "Provider-agnostic background-job queue port with in-memory, Trigger.dev, Inngest, pg-boss, and BullMQ drivers — billing and credit side-effects enqueued, never inline.",
});
