import Link from "next/link";

import { Card, Section } from "@/components";
import { PADDLE_MOR_DISCLOSURE } from "@/lib/legal";
import { buildMetadata } from "@/lib/metadata";
import { prose } from "../prose";
import { LegalToc, type LegalTocItem } from "../toc";

export const metadata = buildMetadata({
  title: "Refund Policy",
  description:
    "Caisson's unconditional 14-day money-back guarantee, how to request a refund, and what happens to refunded licenses and credits.",
  path: "/legal/refunds",
});

const TOC: readonly LegalTocItem[] = [
  { id: "guarantee", label: "14-day guarantee" },
  { id: "request", label: "Request a refund" },
  { id: "processing", label: "Refund processing" },
  { id: "access", label: "Licenses and credits" },
  { id: "questions", label: "Questions" },
];

export default function RefundsPage() {
  return (
    <>
      <LegalToc items={TOC} />

      <Section eyebrow="Legal" title="Refund Policy" flush as="h1">
        <p className="cs-lede" style={{ marginTop: "var(--cs-space-3)" }}>
          Effective 3 July 2026. Every Caisson purchase includes an
          unconditional 14-day money-back guarantee.
        </p>
      </Section>

      <Section id="guarantee" title="14-day money-back guarantee">
        <Card accent>
          <p style={prose.paragraph}>
            Request a refund within 14 days of your purchase, for any reason,
            and you receive a full refund. The guarantee applies whether or not
            you have downloaded, installed, or used the software, and to every
            buyer regardless of location or whether you buy as a consumer or a
            business.
          </p>
        </Card>
      </Section>

      <Section id="request" title="How to request a refund" band="tint">
        <p style={prose.paragraph}>
          Email{" "}
          <a
            href="mailto:support@caisson.sh?subject=Caisson%20refund%20request"
            className="cs-link"
          >
            support@caisson.sh
          </a>{" "}
          from the address used for the purchase and include your Paddle order
          number. If the order contains several bundles or modules, identify the
          line item you want refunded.
        </p>
        <p style={prose.paragraph}>
          You may also contact Paddle directly through{" "}
          <a href="https://paddle.net" rel="noreferrer" className="cs-link">
            paddle.net
          </a>
          .
        </p>
      </Section>

      <Section id="processing" title="How refunds are processed">
        <p style={prose.paragraph}>
          {PADDLE_MOR_DISCLOSURE} Paddle executes approved refunds and returns
          the payment to the original payment method, where possible, within 14
          days of approval.
        </p>
        <p style={prose.paragraph}>
          Individual line items in a multi-item order can be refunded on their
          own. A refund applies only to the line items identified and approved.
        </p>
      </Section>

      <Section
        id="access"
        title="What happens to licenses and credits"
        band="tint"
      >
        <p style={prose.paragraph}>
          An approved refund revokes the license entitlement granted by the
          refunded purchase and removes any unused credits it granted. Access
          already exercised and credits already spent are not affected.
        </p>
        <p style={prose.paragraph}>
          The commercial license terms remain available in the{" "}
          <Link href="/legal/eula" className="cs-link">
            Commercial License Agreement
          </Link>
          .
        </p>
      </Section>

      <Section id="questions" title="Questions">
        <p style={prose.paragraph}>
          For order, license, or refund questions, email{" "}
          <a href="mailto:support@caisson.sh" className="cs-link">
            support@caisson.sh
          </a>
          .
        </p>
      </Section>
    </>
  );
}
