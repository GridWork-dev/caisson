import type { CSSProperties } from "react";
import Link from "next/link";

import { buildMetadata } from "@/lib/metadata";
import { Card, Faq, Section, StatusChip } from "@/components";
import { faqPage, serializeJsonLd } from "@/lib/jsonld";

export const metadata = buildMetadata({
  title: "License",
  description:
    "Caisson commercial license summary — what you may build with the kit and what you may not redistribute. One perpetual license across the whole library.",
  path: "/legal/license",
});

// FAQ items — answer-first; also rendered as faqPage JSON-LD (only visible questions are emitted).
const FAQ_ITEMS = [
  {
    question: "Can I use Caisson to build a SaaS product I sell to customers?",
    answer:
      "Yes. Building and operating your own commercial product — including a product you sell to paying customers — is the primary intended use. Your customers use your product; they do not receive the Caisson kit source.",
  },
  {
    question: "Can I include Caisson in an open-source project I publish?",
    answer:
      "No. Open-sourcing the Caisson kit source (or a project that is substantially the kit) would make it freely redistributable, which the Commercial License prohibits. You can still build and ship your own product on Caisson — your customers use your product, not the kit source.",
  },
  {
    question: "What happens when I modify the source?",
    answer:
      "Modifications you make are yours to use in your own products. The Commercial License terms still govern the underlying Caisson code in any derivative work — you cannot strip the license and redistribute.",
  },
  {
    question: "Is the license perpetual?",
    answer:
      "Yes. The Commercial License is perpetual for the version you purchased. Compliance Updates is an optional subscription that delivers new versions with updated control mappings; it is not required to continue using the version you bought.",
  },
  {
    question: "Does Caisson claim to be SOC 2 certified or HIPAA certified?",
    answer:
      "No. Caisson ships the technical controls that SOC 2, HIPAA, and other frameworks require — fail-closed RLS, WORM storage, an append-only audit chain, field encryption, and an evidence-pack generator. The audit itself, the organizational controls (HR, vendor management, incident response), and the certification decision remain yours. Your auditor certifies your organization; Caisson provides the code that makes the technical evidence.",
  },
];

const prose = {
  paragraph: {
    marginTop: "var(--cs-space-4)",
    lineHeight: "var(--cs-leading-relaxed)",
    maxWidth: "72ch",
  } as CSSProperties,
  h3: {
    marginTop: "var(--cs-space-8)",
    marginBottom: "var(--cs-space-3)",
    fontSize: "var(--cs-text-lg)",
    fontWeight: "var(--cs-weight-semibold)",
    letterSpacing: "var(--cs-tracking-tight)",
  } as CSSProperties,
  list: {
    marginTop: "var(--cs-space-3)",
    paddingLeft: "var(--cs-space-5)",
    lineHeight: "var(--cs-leading-relaxed)",
    maxWidth: "68ch",
  } as CSSProperties,
  li: {
    marginBottom: "var(--cs-space-2)",
  } as CSSProperties,
};

export default function LicensePage() {
  const ldFaq = faqPage(FAQ_ITEMS);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(ldFaq) }}
      />

      {/* Page header */}
      <Section eyebrow="Legal" title="License" flush as="h1">
        <p className="cs-lede" style={{ marginTop: "var(--cs-space-3)" }}>
          A plain-language summary of the Caisson Commercial License — one
          perpetual license across every edition and module.
        </p>
      </Section>

      {/* Draft notice */}
      <Section band="tint">
        <Card accent>
          <p
            className="cs-status"
            style={{
              fontFamily: "var(--cs-font-mono)",
              fontSize: "var(--cs-text-xs)",
              textTransform: "uppercase",
              letterSpacing: "var(--cs-tracking-wide)",
              color: "var(--cs-accent)",
            }}
          >
            Summary only — the EULA is the binding document
          </p>
          <p style={{ marginTop: "var(--cs-space-3)", ...prose.paragraph }}>
            This page is a plain-language summary of the Caisson Commercial
            License. It is informational and is not a substitute for the full
            Commercial License Agreement (&ldquo;EULA&rdquo;), which is the
            binding document and is provided at purchase. Where this summary and
            the EULA differ, the EULA governs.
          </p>
        </Card>
      </Section>

      {/* Overview */}
      <Section eyebrow="Overview" title="The licensing model">
        <p style={prose.paragraph}>
          Caisson ships two tracks. The <strong>Base substrate</strong> —
          kernel, auth, tenancy-rls, ui, billing, credits, jobs, email,
          ai-config, mcp-server, registry-schema, observability, and the
          generator tooling (cli, migrate, license-verify) — is{" "}
          <code className="mono">Apache-2.0</code>, open source, free to use.
          Every edition, including the{" "}
          <a href="/local-first" style={{ color: "var(--cs-accent)" }}>
            Local-first AI edition
          </a>
          , plus the compliance/commercial primitives (field-crypto,
          audit-worm), the registry service, and Compliance Updates ship under a
          single proprietary Commercial License (
          <code className="mono">LicenseRef-Caisson-Commercial</code>).
        </p>
        <p style={prose.paragraph}>
          The commercial track is the kit pattern: you purchase, you build, you
          ship your own products without per-seat or per-project fees — but you
          do not redistribute or resell the kit itself.
        </p>
      </Section>

      {/* Commercial license */}
      <Section eyebrow="Commercial license" title="What you may do" band="tint">
        <p style={prose.paragraph}>
          Under the Caisson Commercial License, purchasing an entitlement grants
          you a{" "}
          <strong>
            perpetual, non-exclusive, worldwide license to use, modify, and
            integrate the source code in your own products and services
          </strong>
          , subject to the restrictions below.
        </p>

        <h3 style={prose.h3}>You may</h3>
        <ul style={prose.list}>
          <li style={prose.li}>
            Use the source code in unlimited commercial projects and products
            you build and operate yourself.
          </li>
          <li style={prose.li}>
            Modify the source code to fit your product&apos;s requirements.
          </li>
          <li style={prose.li}>
            Deploy the code on your own infrastructure or cloud accounts.
          </li>
          <li style={prose.li}>
            Include compiled or bundled output from the code in your products
            (subject to the no-redistribution restriction — your product ships,
            the kit source does not ship as a kit).
          </li>
          <li style={prose.li}>
            Transfer the license to another entity that acquires your business
            or the product in which the code is embedded (contact us for
            transfer terms).
          </li>
        </ul>

        <h3 style={prose.h3}>You may not</h3>
        <ul style={prose.list}>
          <li style={prose.li}>
            Redistribute, resell, or publish the source code as a standalone
            kit, boilerplate, library, or template that competes with Caisson.
          </li>
          <li style={prose.li}>
            Sub-license the kit to third parties as a kit — your customers may
            use your <em>product</em>, not the underlying Caisson source.
          </li>
          <li style={prose.li}>
            Remove or obscure license notices, SPDX identifiers, or the
            attribution in the code.
          </li>
          <li style={prose.li}>
            Use the code in a product whose primary purpose is to provide a
            competing compliance infrastructure kit, boilerplate service, or
            source-code library.
          </li>
        </ul>

        <p style={{ marginTop: "var(--cs-space-5)", ...prose.paragraph }}>
          The full text of the Commercial License Agreement, which is the
          binding document, is published at{" "}
          <Link href="/legal/eula" className="mono">
            caisson.sh/legal/eula
          </Link>
          . The <code className="mono">LicenseRef-Caisson-Commercial</code> SPDX
          identifier in each package&apos;s{" "}
          <code className="mono">package.json</code> resolves to that document.
        </p>
      </Section>

      {/* Entitlement mechanics */}
      <Section eyebrow="Mechanics" title="How the license is delivered">
        <p style={prose.paragraph}>
          Caisson uses an offline Ed25519 license key for entitlement
          verification. When you purchase:
        </p>
        <ul style={prose.list}>
          <li style={prose.li}>
            You receive an <strong>entitlement record</strong> and a signed{" "}
            <strong>Ed25519 offline license key</strong> covering the modules
            you purchased.
          </li>
          <li style={prose.li}>
            Your entitlement grants access to the{" "}
            <strong>GitHub Packages private registry</strong> for entitled
            packages under the <code className="mono">@caisson</code> scope.
          </li>
          <li style={prose.li}>
            The license key is verified at install time and optionally at
            runtime (for license-gated features). Verification is local —{" "}
            <strong>no call home is required</strong> for the perpetual license.
          </li>
          <li style={prose.li}>
            A Compliance Updates subscription delivers new package versions with
            updated control mappings as regulations change. This is optional;
            the perpetual license does not expire.
          </li>
        </ul>
      </Section>

      {/* Per-module clarity */}
      <Section eyebrow="Per module" title="Which license applies where">
        <p style={prose.paragraph}>
          Two licenses, split by package. The Base substrate is Apache-2.0, open
          source; editions and the commercial primitives ship under the Caisson
          Commercial License.
        </p>
        <div
          style={{
            marginTop: "var(--cs-space-5)",
            display: "grid",
            gap: "var(--cs-space-4)",
          }}
        >
          <Card>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "var(--cs-space-3)",
              }}
            >
              <span
                style={{
                  fontWeight: "var(--cs-weight-medium)",
                  fontFamily: "var(--cs-font-mono)",
                  fontSize: "var(--cs-text-sm)",
                }}
              >
                @caisson/kernel · @caisson/auth · @caisson/tenancy-rls ·
                @caisson/ui · @caisson/billing · @caisson/credits ·
                @caisson/jobs · @caisson/email · @caisson/ai-config ·
                @caisson/mcp-server · @caisson/registry-schema ·
                @caisson/observability · @caisson/cli · @caisson/migrate ·
                @caisson/license-verify
              </span>
              <StatusChip label="Apache-2.0" tone="muted" />
            </div>
            <p
              className="cs-footnote"
              style={{ marginTop: "var(--cs-space-2)" }}
            >
              The open Base substrate — free to use, modify, and redistribute
              under the Apache-2.0 terms.
            </p>
          </Card>
          <Card>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "var(--cs-space-3)",
              }}
            >
              <span
                style={{
                  fontWeight: "var(--cs-weight-medium)",
                  fontFamily: "var(--cs-font-mono)",
                  fontSize: "var(--cs-text-sm)",
                }}
              >
                @caisson/field-crypto · @caisson/audit-worm · the registry
                service · Compliance Updates · and the four editions
                (Compliance, AI Production Kit, Local-first AI, Agentic-Dev)
              </span>
              <StatusChip label="Commercial" tone="muted" />
            </div>
            <p
              className="cs-footnote"
              style={{ marginTop: "var(--cs-space-2)" }}
            >
              <code className="mono">LicenseRef-Caisson-Commercial</code> —
              perpetual paid license, no redistribution of the kit.
            </p>
          </Card>
        </div>
      </Section>

      {/* FAQ (visible + JSON-LD) */}
      <Section eyebrow="Questions" title="Common questions" band="tint">
        <Faq items={FAQ_ITEMS} style={{ marginTop: "var(--cs-space-6)" }} />
      </Section>

      {/* Contact */}
      <Section eyebrow="Contact" title="Licensing questions">
        <p style={prose.paragraph}>
          For licensing questions, volume pricing, transfer requests, or EULA
          negotiation:
        </p>
        <p style={{ marginTop: "var(--cs-space-4)", ...prose.paragraph }}>
          GridWork Digital LLC
          <br />
          Atlanta, Georgia, USA
          <br />
          <a
            href="mailto:legal@gridwork.dev"
            style={{ color: "var(--cs-accent)" }}
          >
            legal@gridwork.dev
          </a>
        </p>
      </Section>
    </>
  );
}
