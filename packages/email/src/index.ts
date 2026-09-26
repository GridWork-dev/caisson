export { createCaptureEmailer, createResendEmailer } from "./email.ts";
export type {
  CaptureEmailer,
  Emailer,
  EmailMessage,
  ResendConfig,
  ResendQuota,
} from "./email.ts";
export { createPostmarkEmailer } from "./postmark.ts";
export type { PostmarkConfig } from "./postmark.ts";
export { createSesEmailer, sesSmtpConfig } from "./ses.ts";
export type { SesConfig } from "./ses.ts";
export { createSmtpEmailer } from "./smtp.ts";
export type { SmtpConfig, SmtpTransport } from "./smtp.ts";
export {
  EMAIL_TEMPLATE_IDS,
  isEmailTemplateId,
  renderEmailTemplate,
  tryRenderEmailTemplate,
} from "./templates/index.ts";
export { EMAIL_SAMPLE_DATA } from "./sample-data.ts";
export type {
  CreditsExpiringData,
  EmailTemplateData,
  EmailTemplateId,
  RenderedEmail,
  TemplateDataMap,
} from "./templates/index.ts";
