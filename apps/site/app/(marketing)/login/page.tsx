// Sign-in stub (ADR-0114/ADR-0015). The dashboard's auth GATE (the `caisson_session` EdDSA-JWT
// cookie + `requireDashboardSession`) is fully wired; the sign-in FLOW itself — better-auth's
// magic-link/OAuth UI that actually mints that cookie — is a separate, larger seam this task does
// not build (investigate-only per the kickoff scope). This page is the real redirect target so
// `/dashboard` never 404s an unauthenticated visitor; it explains the state honestly rather than
// faking a working form.
import type { Metadata } from "next";
import { Hero, Section } from "@caisson/ui/components";
import { Button } from "@/components";
import { buildMetadata } from "@/lib/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Sign in",
  description: "Sign in to your Caisson buyer dashboard.",
  path: "/login",
});

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <>
      <Hero
        eyebrow="Sign in"
        title="Buyer dashboard sign-in"
        lede="Sign-in is being wired up. In the meantime, reach out and we'll get you access to your entitlements, credits, and license."
        ctas={
          <Button href="mailto:security@caisson.sh" external variant="primary">
            Contact us
          </Button>
        }
      />
      <Section eyebrow="Why you're here" title="What this page is for">
        <p className="cs-muted">
          {next
            ? `You tried to reach ${next}, which requires an active session.`
            : "This route requires an active session."}{" "}
          Once sign-in is live, this page authenticates you and returns you to
          where you started.
        </p>
      </Section>
    </>
  );
}
