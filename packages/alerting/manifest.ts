// Registry manifest: must agree with package.json on id, version, license and the @caisson/*
// dependency set (the standards gate fails the build on drift).
import pkg from "./package.json";
import { defineModule } from "../../registry/schema/module-manifest";

export default defineModule({
  id: "@caisson/alerting",
  version: pkg.version,
  license: pkg.license,
  dependencies: ["@caisson/email", "@caisson/kernel"],
  description:
    "SOC2 CC7.2 multi-channel alerting pipeline: dedup -> rate-cap+digest -> IANA-tz quiet-hours (critical override) -> multi-channel delivery (email/webhook/Slack/Telegram) -> structured audit log.",
});
