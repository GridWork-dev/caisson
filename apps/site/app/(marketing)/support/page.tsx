import Link from "next/link";

import { Button, Card, Section } from "@/components";
import { buildMetadata } from "@/lib/metadata";

export const metadata = buildMetadata({
  title: "Support",
  description:
    "Contact Caisson Software LLC for product, documentation, and security help.",
  path: "/support",
});

const supportAreas = [
  {
    title: "Product and documentation",
    body: "Tell us what you are building, which module family or module you are using, and link the relevant documentation page when possible.",
    subject: "Caisson product support",
  },
] as const;

export default function SupportPage() {
  return (
    <>
      <Section eyebrow="Support" title="Get help with Caisson" flush as="h1">
        <p className="cs-lede" style={{ marginTop: "var(--cs-space-3)" }}>
          Direct support from Caisson Software LLC for product and documentation
          questions.
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

      <Section title="Security reports">
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
    </>
  );
}
