// The early-access waitlist welcome — a growth email, migrated into the shared template registry
// from a standalone plain-HTML builder so every email in the product previews and sends through one
// pile. `email` is caller-supplied and reaches the rendered output ONLY as JSX text content, which
// React escapes automatically — no hand-rolled HTML-entity escaping needed (the templates around it
// carry the same guarantee).
import { EmailBody, EmailButton, EmailLayout } from "./layout.tsx";

export interface WaitlistWelcomeData {
  /** Recipient email — displayed in the body copy. */
  email: string;
  /** The bundle they joined the waitlist from, or "Caisson" for the general list. */
  bundle?: string;
}

function bundleLabel(bundle: string): string {
  return bundle === "Caisson" ? "Caisson" : `Caisson ${bundle}`;
}

export function waitlistWelcomeSubject(data: WaitlistWelcomeData): string {
  return `You're on the ${bundleLabel(data.bundle ?? "Caisson")} early-access list`;
}

export function WaitlistWelcomeEmail({
  email,
  bundle = "Caisson",
}: WaitlistWelcomeData): React.ReactElement {
  const label = bundleLabel(bundle);
  return (
    <EmailLayout
      preview={`You're on the ${label} early-access list`}
      heading="You're on the list"
      footerNote="This confirms the early-access waitlist request you made; it is not a recurring marketing sequence."
    >
      <EmailBody>
        We received your request for early access to {label} at {email}. We'll
        reach out when it opens: roughly one email, not a drip.
      </EmailBody>
      <EmailBody>
        In the meantime, the docs cover the architecture, the module contracts,
        and the compliance control maps.
      </EmailBody>
      <EmailButton href="https://caisson.sh/docs" label="Read the docs" />
    </EmailLayout>
  );
}
