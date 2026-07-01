// Browser sign-in client (better-auth React client). Same-origin: it talks to the route handler
// mounted at `/api/auth/*`. Only the magic-link client plugin is needed here — OAuth sign-in
// (`signIn.social`) is a core client method, no plugin required. Used by the `/login` form.
import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [magicLinkClient()],
});
