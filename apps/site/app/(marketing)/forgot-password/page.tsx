// Forgot-password entry point (better-auth email+password, ADR-0015 extension). Kept minimal —
// a copy/design polish pass follows separately, same as /login.
import type { Metadata } from "next";
import { Hero, Section } from "@caisson/ui/components";
import { buildMetadata } from "@/lib/metadata";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = buildMetadata({
  title: "Forgot password",
  description: "Reset the password on your Caisson buyer dashboard account.",
  path: "/forgot-password",
});

// Footer parity with the sibling auth pages (visual-audit): the shared footer's Discord link is
// env-gated (NEXT_PUBLIC_DISCORD_INVITE_URL) and resolved at render time. /login and
// /reset-password read searchParams and therefore render dynamically — at request time, where the
// invite is set — while this page was statically prerendered at build with an env snapshot that
// lacked it, making it the one auth page whose footer had no Discord link. An auth page has no
// SEO value worth a static render; force dynamic so the whole auth trio resolves the same env.
export const dynamic = "force-dynamic";

export default function ForgotPasswordPage(): React.ReactElement {
  return (
    <>
      <Hero
        eyebrow="Forgot password"
        title="Reset your password"
        lede="Enter the email on your account and we'll send a one-time reset link."
      />
      <Section eyebrow="Reset" title="Send a reset link">
        <ForgotPasswordForm />
      </Section>
    </>
  );
}
