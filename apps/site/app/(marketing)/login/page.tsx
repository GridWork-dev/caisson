// Buyer sign-in (ADR-0015 / ADR-0132). A real magic-link + OAuth sign-in: this server page
// resolves which OAuth providers are configured (env-gated) and hands them to the client form,
// so an unconfigured provider is never offered. Magic-link (Resend) is the always-on primary. The
// dashboard gates on the resulting better-auth session (`requireDashboardSession`). Kept minimal —
// a copy/design polish pass follows separately.
import type { Metadata } from "next";
import { Hero, Section } from "@caisson/ui/components";
import { configuredProviderIds } from "@/lib/auth-config";
import { buildMetadata } from "@/lib/metadata";
import { LoginForm } from "./login-form";

export const metadata: Metadata = buildMetadata({
  title: "Sign in",
  description: "Sign in to your Caisson buyer dashboard.",
  path: "/login",
});

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; ref?: string }>;
}) {
  const { next, ref } = await searchParams;
  const providers = configuredProviderIds(process.env);

  return (
    <>
      <Hero
        eyebrow="Sign in"
        title="Buyer dashboard sign-in"
        lede="Get a one-time sign-in link by email, or continue with a connected account. You'll land back on your entitlements, credits, and license."
      />
      <Section eyebrow="Sign in" title="Continue to your dashboard">
        <LoginForm
          providers={providers}
          next={next ?? "/dashboard"}
          signupSource={ref}
        />
      </Section>
    </>
  );
}
