// Reset-password landing page (better-auth email+password, ADR-0015 extension). better-auth's
// mailed link redirects here with `?token=`. The page reads `token` server-side (same pattern as
// /login's `next` param) so it renders ONE coherent message — a missing/invalid token never gets
// "choose a new password" copy above a form that immediately says it can't. Kept minimal — a
// copy/design polish pass follows separately, same as /login.
import type { Metadata } from "next";
import { Hero, Section } from "@caisson/ui/components";
import { Button } from "@/components/button";
import { buildMetadata } from "@/lib/metadata";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = buildMetadata({
  title: "Reset password",
  description: "Set a new password for your Caisson buyer dashboard account.",
  path: "/reset-password",
});

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}): Promise<React.ReactElement> {
  const { token } = await searchParams;

  if (token === undefined || token === "") {
    return (
      <Hero
        eyebrow="Reset password"
        title="This reset link is missing its token"
        lede="It may be malformed or already used. Request a new one below."
        ctas={
          <Button href="/forgot-password" variant="primary">
            Request a new reset link
          </Button>
        }
      />
    );
  }

  return (
    <>
      <Hero
        eyebrow="Reset password"
        title="Choose a new password"
        lede="This link is one-time use. Set a new password to finish resetting your account."
      />
      <Section eyebrow="Reset" title="New password">
        <ResetPasswordForm token={token} />
      </Section>
    </>
  );
}
