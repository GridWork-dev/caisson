// Remotion entry point (ADR-0263). Offline render only — `bun run remotion:render` (package.json)
// invokes the `remotion` CLI against this file; it never runs inside the deployed Next process
// (Remotion documents in-app SSR rendering as unsupported) and this whole tree is excluded from
// the app's tsconfig so it never enters the Next build (verified by `next build`).
import { registerRoot } from "remotion";

import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
