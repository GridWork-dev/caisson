import Link from "next/link";

import { Button, Card, Section } from "@/components";
import { buildMetadata } from "@/lib/metadata";

export const metadata = buildMetadata({
  title: "Support",
  description:
    "Contact Caisson Software LLC for purchase, license, delivery, refund, documentation, and security help.",
  path: "/support",
});

const supportAreas = [
  {
    title: "Orders and refunds",
    body: "Include the Paddle order number and the email address used at checkout. For a multi-item order, name the bundle or module you need help with.",
    subject: "Caisson order or refund support",
  },
  {
    title: "Licenses and delivery",
    body: "Include the order number, your Caisson account email, and the package or entitlement you expected to receive. Do not email license tokens or credentials.",
    subject: "Caisson license or delivery support",
  },
  {
    title: "Product and documentation",
    body: "Tell us what you are building, which bundle or module you are using, and link the relevant documentation page when possible.",
    subject: "Caisson product support",
  },
] as const;

export default function SupportPage() {
  return (
    <>
      <Section eyebrow="Support" title="Get help with Caisson" flush as="h1">
        <p className="cs-lede" style={{ marginTop: "var(--cs-space-3)" }}>
          Direct support from Caisson Software LLC for purchases, licenses,
          delivery, and product questions.
        </p>
        <div style={{ marginTop: "var(--cs-space-6)" }}>
          <Button
            href="mailto:support@caisson.sh?subject=Caisson%20support"
            external
            variant="primary"
          >
            Email support@caisson.sh
          </Button>
        </div>
      </Section>

      <Section title="What to include" band="tint">
        <div className="cs-grid-3">
          {supportAreas.map((area) => (
            <Card key={area.title}>
              <h3>{area.title}</h3>
              <p
                style={{
                  marginTop: "var(--cs-space-3)",
                  color: "var(--cs-fg-muted)",
                  lineHeight: "var(--cs-leading-relaxed)",
                }}
              >
                {area.body}
              </p>
              <p style={{ marginTop: "var(--cs-space-4)" }}>
                <a
                  href={`mailto:support@caisson.sh?subject=${encodeURIComponent(area.subject)}`}
                  className="cs-link"
                >
                  Email support
                </a>
              </p>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Refund policy">
        <p className="cs-lede">
          Every purchase includes an unconditional 14-day money-back guarantee.
          The dedicated policy explains eligibility, request details, and what
          happens to licenses and credits after approval.
        </p>
        <p style={{ marginTop: "var(--cs-space-5)" }}>
          <Link href="/legal/refunds" className="cs-link">
            Read the refund policy
          </Link>
        </p>
      </Section>

      <Section title="Security reports" band="tint">
        <p className="cs-lede">
          Send vulnerability reports and reproduction steps to{" "}
          <a href="mailto:security@caisson.sh" className="cs-link">
            security@caisson.sh
          </a>
          . Do not send secrets, production data, or credentials.
        </p>
        <p style={{ marginTop: "var(--cs-space-4)" }}>
          See the{" "}
          <Link href="/security" className="cs-link">
            security page
          </Link>{" "}
          and{" "}
          <Link href="/.well-known/security.txt" className="cs-link">
            security.txt
          </Link>{" "}
          for the disclosure channel.
        </p>
      </Section>

      <Section title="Paddle payment help">
        <p className="cs-lede">
          Paddle is the Merchant of Record and handles payment receipts, tax,
          and the payment-side execution of approved refunds. For Paddle account
          or receipt help, visit{" "}
          <a href="https://paddle.net" rel="noreferrer" className="cs-link">
            paddle.net
          </a>
          .
        </p>
      </Section>
    </>
  );
}
