// Sample data for every branded email template — the single source shared by the visual
// harness's email leg, so a preview and a screenshot always render the same thing.
import type { EmailTemplateId, TemplateDataMap } from "./templates/index.ts";

export const EMAIL_SAMPLE_DATA: { [K in EmailTemplateId]: TemplateDataMap[K] } =
  {
    "magic-link": {
      url: "https://caisson.sh/api/auth/magic-link/verify?token=sample",
    },
    "password-reset": {
      url: "https://caisson.sh/api/auth/reset-password/sample?callbackURL=/reset-password",
    },
    "verify-email": {
      url: "https://caisson.sh/api/auth/verify-email?token=sample",
    },
    "credits-expiring": {
      credits: 120,
      expiresOn: "2027-07-06",
      url: "https://caisson.sh/dashboard/credits",
    },
  };
