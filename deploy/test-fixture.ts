export type FixtureManifest = {
  _source: string;
  repository: string;
  services: Record<
    string,
    {
      dockerfile: string;
      build_context: string;
      watched_paths: string[];
      healthcheck: string;
      hostnames: string[];
      runtime: "cloud-run-service";
      // Optional origin-gate env var NAMES, mirroring ServiceConfigSchema — the fleet projector
      // emits each only when the service's manifest row declares it.
      origin_secret_mode?: string;
      origin_secret_current?: string;
      origin_secret_next?: string;
    }
  >;
  jobs: Record<
    string,
    {
      dockerfile: string;
      build_context: string;
      watched_paths: string[];
      runtime: "cloud-run-job";
    }
  >;
};

export const manifestFixture: FixtureManifest = {
  _source: "test fixture",
  repository: "caisson-sh/caisson",
  services: {
    "caisson-site": {
      dockerfile: "apps/site/Dockerfile",
      build_context: ".",
      watched_paths: ["apps/site/**", "packages/**", "bun.lock"],
      healthcheck: "/healthz",
      hostnames: ["caisson.sh", "www.caisson.sh"],
      runtime: "cloud-run-service",
    },
    "caisson-docs": {
      dockerfile: "services/docs/Dockerfile",
      build_context: ".",
      watched_paths: ["services/docs/**", "packages/**", "bun.lock"],
      healthcheck: "/health",
      hostnames: ["docs-api.caisson.sh"],
      runtime: "cloud-run-service",
    },
    "caisson-demos": {
      dockerfile: "apps/demos/Dockerfile",
      build_context: ".",
      watched_paths: ["apps/demos/**", "packages/**", "bun.lock"],
      healthcheck: "/demos/healthz",
      hostnames: [],
      runtime: "cloud-run-service",
    },
  },
  jobs: {
    "caisson-migrate": {
      dockerfile: "deploy/Dockerfile.migrate",
      build_context: ".",
      watched_paths: ["deploy/migrate.ts", "packages/**", "bun.lock"],
      runtime: "cloud-run-job",
    },
  },
};
