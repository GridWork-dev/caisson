// Fixture for require-zod-strict. Excluded from real scans via .semgrepignore.
import { z } from "zod";

// ruleid: require-zod-strict
const BadBody = z.object({ email: z.string() });

// ok: require-zod-strict
const GoodBody = z.object({ email: z.string() }).strict();

// ok: require-zod-strict
const PassthroughBody = z.object({ raw: z.unknown() }).passthrough();

export { BadBody, GoodBody, PassthroughBody };
