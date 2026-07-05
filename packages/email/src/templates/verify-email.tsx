import { EmailBody, EmailButton, EmailLayout } from "./layout.tsx";

export const VERIFY_EMAIL_SUBJECT = "Verify your Caisson email";

export function VerifyEmailEmail({ url }: { url: string }): React.ReactElement {
  return (
    <EmailLayout
      preview="Verify your Caisson email"
      heading="Verify your email"
    >
      <EmailBody>
        Confirm this is your email address to finish setting up password sign-in
        for your Caisson account.
      </EmailBody>
      <EmailButton href={url} label="Verify email" />
      <EmailBody>
        If you didn&apos;t create a Caisson account, you can ignore this email.
      </EmailBody>
    </EmailLayout>
  );
}
