import { EmailBody, EmailButton, EmailLayout } from "./layout.tsx";

export const MAGIC_LINK_SUBJECT = "Sign in to Caisson";

export function MagicLinkEmail({ url }: { url: string }): React.ReactElement {
  return (
    <EmailLayout
      preview="Your Caisson sign-in link"
      heading="Sign in to Caisson"
    >
      <EmailBody>
        Click below to sign in. This link expires shortly and can only be used
        once.
      </EmailBody>
      <EmailButton href={url} label="Sign in" />
      <EmailBody>
        If you didn&apos;t request this, you can safely ignore this email.
      </EmailBody>
    </EmailLayout>
  );
}
