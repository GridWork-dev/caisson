// The waitlist nurture follow-up — sent once, ~2 weeks after the welcome email, when the recipient
// hasn't opened the docs yet (configure the trigger in the sending provider; this file is only the
// template). Migrated from a standalone plain-HTML builder into the shared template registry —
// `email` reaches the rendered output only as JSX text content, auto-escaped by React.
import { EmailBody, EmailButton, EmailLayout } from "./layout.tsx";

export interface NurtureFollowUpData {
  email: string;
  bundle?: string;
}

export function nurtureSubject(data: NurtureFollowUpData): string {
  return `What Caisson ${data.bundle ?? "Compliance"} ships, and what it doesn't`;
}

export function NurtureFollowUpEmail({
  email,
  bundle = "Compliance",
}: NurtureFollowUpData): React.ReactElement {
  const label = `Caisson ${bundle}`;
  return (
    <EmailLayout
      preview={nurtureSubject({ email, bundle })}
      heading={`What ${label} ships, and what it doesn't`}
      footerNote="This is a one-time follow-up about the bundle you evaluated, not a recurring newsletter."
    >
      <EmailBody>
        A note for {email}: this is the one email we said we'd send, not the
        start of a drip.
      </EmailBody>
      <EmailBody>
        {label} ships the technical controls your audit requires: fail-closed
        Postgres RLS, S3 Object-Lock WORM storage, an append-only SHA-256 audit
        chain, per-tenant field encryption, and an evidence-pack generator that
        formats artifacts for your auditor. It is a codebase, not a scanner.
      </EmailBody>
      <EmailBody>
        The org controls (HR, vendor management, incident response), the audit
        engagement, and the final certification remain yours. Caisson generates
        the evidence; you close the audit. That boundary is intentional and
        stated plainly in the docs.
      </EmailBody>
      <EmailButton href="https://caisson.sh/docs" label="Read the docs" />
    </EmailLayout>
  );
}
