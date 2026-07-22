// Forgot-password entry point (better-auth email+password, ADR-0015 extension). Kept minimal —
// a copy/design polish pass follows separately, same as /login.
import type { Metadata } from "next";
import Link from "next/link";
import { Hero, Section } from "@caisson/ui/components";
import { buildMetadata } from "@/lib/metadata";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = buildMetadata({
  title: "Forgot password",
  description: "Reset the password on your Caisson buyer dashboard account.",
  path: "/forgot-password",
});

// Footer Discord parity (visual-audit): this page's footer once missed the env-gated Discord
// link because NEXT_PUBLIC_DISCORD_INVITE_URL never reached `next build` — the real gap was the
// missing build ARG in apps/site/Dockerfile (fixed there), which starved EVERY statically
// prerendered footer, not just this page. With the var baked at build, a static render resolves
// it like every other marketing page — no force-dynamic needed.

export default function ForgotPasswordPage(): React.ReactElement {
  return (
    <>
      <Hero
        eyebrow="Forgot password"
        title="Reset your password"
        lede="Enter the email on your account and we'll send a one-time reset link."
      />
      {/* No repeated eyebrow/heading here (visual-audit id 58bd2691a53e402d) - the Hero above
          already states the task; this Section is a plain form wrapper. */}
      <Section>
        <ForgotPasswordForm />
        <p className="cs-muted" style={{ fontSize: "var(--cs-text-sm)" }}>
          <Link href="/login" className="cs-muted">
            Back to sign in
          </Link>
        </p>
      </Section>
    </>
  );
}
