import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

import { z } from "zod";

import { MARKETING_ROUTES } from "../../../../apps/site/lib/routes";

export const ringSchema = z.enum(["public", "buyer", "admin"]);
export type Ring = z.infer<typeof ringSchema>;

const mutationContractSchema = z
  .object({
    owner: z.string().trim().min(1),
    precondition: z.string().trim().min(1),
    expectedTransition: z.string().trim().min(1),
    compensator: z.string().trim().min(1),
    cleanupAssertion: z.string().trim().min(1),
    stopCondition: z.string().trim().min(1),
  })
  .strict();

const surfaceSchema = z
  .object({
    id: z.string().trim().min(1),
    ring: ringSchema,
    url: z.string().startsWith("/"),
    label: z.string().trim().min(1),
    authMode: z.enum(["public", "probe", "operator"]),
    source: z.string().trim().min(1),
  })
  .strict();

const journeySchema = z
  .object({
    id: z.string().trim().min(1),
    ring: ringSchema,
    actor: z.enum(["visitor", "buyer-probe", "admin-operator"]),
    goal: z.string().trim().min(1),
    surfaceIds: z.array(z.string().trim().min(1)).min(1),
    prerequisites: z.array(z.string().trim().min(1)),
    evidence: z.array(
      z.enum([
        "before",
        "action",
        "after",
        "revert",
        "console",
        "network",
        "accessibility",
      ]),
    ),
    mutation: mutationContractSchema.optional(),
  })
  .strict();

const manifestSchema = z
  .object({
    runId: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/),
    generatedAt: z.string().datetime(),
    productionOrigins: z
      .object({ site: z.string().url(), admin: z.string().url() })
      .strict(),
    surfaces: z.array(surfaceSchema).min(1),
    journeys: z.array(journeySchema).min(1),
  })
  .strict();

export type Surface = z.infer<typeof surfaceSchema>;
export type Journey = z.infer<typeof journeySchema>;
export type AuditManifest = z.infer<typeof manifestSchema>;

const RING_ORDER: Record<Ring, number> = { public: 0, buyer: 1, admin: 2 };

function pageFiles(root: string): string[] {
  const files: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name === "page.tsx") files.push(path);
    }
  };
  walk(root);
  return files;
}

function pageRoute(root: string, file: string): string | null {
  const segments = relative(root, file)
    .split(sep)
    .slice(0, -1)
    .filter((segment) => !segment.startsWith("("));
  if (segments.some((segment) => segment.startsWith("["))) return null;
  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

function derivedSurfaces(
  root: string,
  ring: Exclude<Ring, "public">,
  authMode: "probe" | "operator",
): Surface[] {
  return pageFiles(root)
    .map((file) => ({ file, url: pageRoute(root, file) }))
    .filter((item): item is { file: string; url: string } => item.url !== null)
    .map(({ file, url }) => ({
      id: `${ring}:${url}`,
      ring,
      url,
      label: url === "/" ? `${ring} home` : url.slice(1).replaceAll("/", " / "),
      authMode,
      source: relative(process.cwd(), file),
    }));
}

export function validateManifest(input: unknown): AuditManifest {
  const manifest = manifestSchema.parse(input);
  const keys = new Set<string>();
  for (const surface of manifest.surfaces) {
    const key = `${surface.ring}:${surface.url}`;
    if (keys.has(key)) throw new Error(`duplicate surface: ${key}`);
    keys.add(key);
  }
  const surfaceIds = new Set(manifest.surfaces.map((surface) => surface.id));
  const assignedSurfaceIds = new Set<string>();
  for (const journey of manifest.journeys) {
    for (const surfaceId of journey.surfaceIds) {
      if (!surfaceIds.has(surfaceId)) {
        throw new Error(`unassigned journey surface: ${surfaceId}`);
      }
      assignedSurfaceIds.add(surfaceId);
    }
  }
  for (const surfaceId of surfaceIds) {
    if (!assignedSurfaceIds.has(surfaceId)) {
      throw new Error(`unassigned surface: ${surfaceId}`);
    }
  }
  return manifest;
}

export function buildManifest(
  runId: string,
  repoRoot = process.cwd(),
): AuditManifest {
  const publicSurfaces: Surface[] = [
    ...MARKETING_ROUTES.map((route) => ({
      id: `public:${route.path || "/"}`,
      ring: "public" as const,
      url: route.path || "/",
      label: route.label,
      authMode: "public" as const,
      source: "apps/site/lib/routes.ts",
    })),
    ...[
      ["/docs", "Docs"],
      ["/login", "Buyer login"],
      ["/security", "Security"],
    ].map(([url, label]) => ({
      id: `public:${url}`,
      ring: "public" as const,
      url: url!,
      label: label!,
      authMode: "public" as const,
      source: "apps/site/app",
    })),
  ];
  const uniquePublic = [
    ...new Map(publicSurfaces.map((item) => [item.id, item])).values(),
  ];
  const buyer = derivedSurfaces(
    join(repoRoot, "apps/site/app"),
    "buyer",
    "probe",
  ).filter(
    (surface) =>
      surface.url === "/dashboard" || surface.url.startsWith("/dashboard/"),
  );
  const admin = derivedSurfaces(
    join(repoRoot, "apps/admin/src/app"),
    "admin",
    "operator",
  ).filter((surface) => surface.url !== "/login");
  const surfaces = [...uniquePublic, ...buyer, ...admin].sort(
    (a, b) =>
      RING_ORDER[a.ring] - RING_ORDER[b.ring] || a.url.localeCompare(b.url),
  );
  const journeys: Journey[] = surfaces.map((surface) => ({
    id: `${surface.ring}-${surface.url === "/" ? "home" : surface.url.slice(1).replaceAll("/", "-")}`,
    ring: surface.ring,
    actor:
      surface.ring === "public"
        ? "visitor"
        : surface.ring === "buyer"
          ? "buyer-probe"
          : "admin-operator",
    goal: `Complete the user goal exposed by ${surface.label}`,
    surfaceIds: [surface.id],
    prerequisites:
      surface.authMode === "public"
        ? []
        : [`authorized ${surface.authMode} session`],
    evidence: ["before", "action", "after", "accessibility"],
  }));
  return validateManifest({
    runId,
    generatedAt: new Date().toISOString(),
    productionOrigins: {
      site: "https://caisson.sh",
      admin: "https://admin.caisson.sh",
    },
    surfaces,
    journeys,
  });
}

export function writeManifest(
  runId: string,
  repoRoot = process.cwd(),
  outputRoot = join(repoRoot, "outputs/browser-audit"),
): string {
  const manifest = buildManifest(runId, repoRoot);
  const root = resolve(outputRoot);
  const runDirectory = resolve(root, manifest.runId);
  if (!runDirectory.startsWith(`${root}${sep}`)) {
    throw new Error("run id escapes the browser-audit output root");
  }
  mkdirSync(runDirectory, { recursive: true });
  const path = join(runDirectory, "manifest.json");
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, {
    mode: 0o600,
  });
  return path;
}

if (import.meta.main) {
  const runId = Bun.argv[2];
  if (!runId) throw new Error("usage: bun build-manifest.ts <run-id>");
  process.stdout.write(`${writeManifest(runId)}\n`);
}
