import { EmailBody, EmailButton, EmailLayout } from "./layout.tsx";

export const PASSWORD_RESET_SUBJECT = "Reset your Caisson password";

export function PasswordResetEmail({
  url,
}: {
  url: string;
}): React.ReactElement {
  return (
    <EmailLayout
      preview="Reset your Caisson password"
      heading="Reset your password"
    >
      <EmailBody>
        Someone requested a password reset for your Caisson account.
      </EmailBody>
      <EmailButton href={url} label="Reset password" />
      <EmailBody>
        If you didn&apos;t request this, you can ignore this email and your
        password stays unchanged.
      </EmailBody>
    </EmailLayout>
  );
}
