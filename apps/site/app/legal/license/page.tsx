import type { CSSProperties } from "react";

import { buildMetadata } from "@/lib/metadata";
import { Button, Card, Section, StatusChip } from "@/components";

export const metadata = buildMetadata({
  title: "License",
  description:
    "Caisson commercial license summary — what you may build, what you may not redistribute, and the AGPL open-core for the Local-first AI edition.",
  path: "/legal/license",
});

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
  return (
    <>
      {/* Page header */}
      <Section eyebrow="Legal" title="License" flush as="h1">
        <p className="cs-lede" style={{ marginTop: "var(--cs-space-3)" }}>
          A plain-language summary of the Caisson Commercial License and the
          AGPL open-core for the Local-first AI edition.
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
            Working draft — operator legal review required before launch
          </p>
          <p style={{ marginTop: "var(--cs-space-3)", ...prose.paragraph }}>
            This page summarises the licensing model adopted in ADR-0023. It is
            a working draft for review purposes and is not a substitute for the
            full Commercial License Agreement (&ldquo;EULA&rdquo;), which will
            be published before any sale. The EULA text is the binding document;
            this summary is informational only.
          </p>
        </Card>
      </Section>

      {/* Overview */}
      <Section eyebrow="Overview" title="The licensing model">
        <p style={prose.paragraph}>
          Caisson is a fully commercial developer library. Every module ships
          under a proprietary Commercial License (
          <code className="mono">LicenseRef-Caisson-Commercial</code>), except
          for one deliberate open-core flank: the{" "}
          <a href="/local-first" style={{ color: "var(--cs-accent)" }}>
            Local-first AI edition
          </a>
          , which is dual-licensed under AGPL-3.0-only.
        </p>
        <p style={prose.paragraph}>
          There is no free permissive tier (no Apache-2.0 or MIT core). The
          model is the commercial kit pattern: you purchase, you build, you ship
          your own products without per-seat or per-project fees — but you do
          not redistribute or resell the kit itself.
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
          binding document, will be published at{" "}
          <code className="mono">caisson.sh/legal/eula</code> before the first
          sale. The <code className="mono">LicenseRef-Caisson-Commercial</code>{" "}
          SPDX identifier in each package&apos;s{" "}
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

      {/* AGPL edition */}
      <Section
        eyebrow="Open core"
        title="Local-first AI — AGPL-3.0"
        band="tint"
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--cs-space-3)",
            marginTop: "var(--cs-space-4)",
          }}
        >
          <StatusChip label="AGPL-3.0-only" tone="accent" dot />
          <StatusChip label="Open source" tone="success" />
        </div>
        <p style={{ marginTop: "var(--cs-space-5)", ...prose.paragraph }}>
          The Local-first AI edition is the single exception to the
          fully-commercial model. It is dual-licensed:
        </p>
        <ul style={prose.list}>
          <li style={prose.li}>
            <strong>
              AGPL-3.0-only (open source, free to use under copyleft).
            </strong>{" "}
            If you use the Local-first AI edition in a product you distribute or
            deploy as a network service, you must release your modifications and
            the source of any work that incorporates it under AGPL-3.0. This is
            standard AGPL copyleft — not a Caisson restriction.
          </li>
          <li style={prose.li}>
            <strong>Commercial license (optional, paid).</strong> If AGPL
            copyleft is incompatible with your product model — e.g., you are
            building a closed-source SaaS — you may purchase a commercial
            license for the Local-first AI edition that removes the copyleft
            obligation.
          </li>
        </ul>
        <p style={prose.paragraph}>
          The AGPL edition is publicly hosted on GitHub. You may fork it, audit
          it, and use it under AGPL terms today, without waiting for early
          access.
        </p>
        <div
          style={{
            display: "flex",
            gap: "var(--cs-space-3)",
            marginTop: "var(--cs-space-6)",
          }}
        >
          <Button
            href="https://github.com/GridWork-dev/caisson"
            variant="ghost"
            external
          >
            View on GitHub
          </Button>
          <Button href="/local-first" variant="ghost">
            Local-first AI edition
          </Button>
        </div>
      </Section>

      {/* Per-module clarity */}
      <Section eyebrow="Per module" title="Which license applies where">
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
              }}
            >
              <span
                style={{
                  fontWeight: "var(--cs-weight-medium)",
                  fontFamily: "var(--cs-font-mono)",
                  fontSize: "var(--cs-text-sm)",
                }}
              >
                @caisson/base · @caisson/auth · @caisson/tenancy-rls ·
                @caisson/audit-worm · @caisson/field-crypto · @caisson/billing ·
                @caisson/ai-config
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

          <Card>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontWeight: "var(--cs-weight-medium)",
                  fontFamily: "var(--cs-font-mono)",
                  fontSize: "var(--cs-text-sm)",
                }}
              >
                @caisson/local-ai (Local-first AI edition)
              </span>
              <StatusChip label="AGPL-3.0 / Commercial" tone="accent" dot />
            </div>
            <p
              className="cs-footnote"
              style={{ marginTop: "var(--cs-space-2)" }}
            >
              Dual-licensed. Free under AGPL copyleft; commercial license
              available to remove the copyleft obligation.
            </p>
          </Card>
        </div>
      </Section>

      {/* FAQ */}
      <Section eyebrow="Questions" title="Common questions" band="tint">
        <h3 style={prose.h3}>
          Can I use Caisson to build a SaaS product I sell to customers?
        </h3>
        <p style={prose.paragraph}>
          Yes. Building and operating your own commercial product — including a
          product you sell to paying customers — is the primary intended use.
          Your customers use your product; they do not receive the Caisson kit
          source.
        </p>

        <h3 style={prose.h3}>
          Can I include Caisson in an open-source project I publish?
        </h3>
        <p style={prose.paragraph}>
          No. Open-sourcing the Caisson kit source (or a project that is
          substantially the kit) would make it freely redistributable, which the
          Commercial License prohibits. If you are building open-source
          compliance tooling, the Local-first AI AGPL edition may be appropriate
          depending on its scope.
        </p>

        <h3 style={prose.h3}>What happens when I modify the source?</h3>
        <p style={prose.paragraph}>
          Modifications you make are yours to use in your own products. The
          Commercial License terms still govern the underlying Caisson code in
          any derivative work — you cannot strip the license and redistribute.
        </p>

        <h3 style={prose.h3}>Is the license perpetual?</h3>
        <p style={prose.paragraph}>
          Yes. The Commercial License is perpetual for the version you
          purchased. Compliance Updates is an optional subscription that
          delivers new versions with updated control mappings; it is not
          required to continue using the version you bought.
        </p>

        <h3 style={prose.h3}>
          Does Caisson claim to be SOC 2 certified or HIPAA certified?
        </h3>
        <p style={prose.paragraph}>
          No. Caisson ships the technical controls that SOC 2, HIPAA, and other
          frameworks require — fail-closed RLS, WORM storage, an append-only
          audit chain, field encryption, and an evidence-pack generator. The
          audit itself, the organizational controls (HR, vendor management,
          incident response), and the certification decision remain yours. Your
          auditor certifies your organization; Caisson provides the code that
          makes the technical evidence.
        </p>
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
            href="mailto:<email>"
            style={{ color: "var(--cs-accent)" }}
          >
            <email>
          </a>
        </p>
      </Section>
    </>
  );
}
