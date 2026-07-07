// Browser sign-in client (better-auth React client), same-origin to `/api/auth/*` (ADR-0283). No
// plugins needed — GitHub sign-in (`signIn.social`) is a core client method, unlike the buyer
// site's magic-link flow.
import { createAuthClient } from "better-auth/react";

export const adminAuthClient = createAuthClient();
