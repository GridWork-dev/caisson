// Remotion's own config file (ADR-0263) — read by the `remotion` CLI only, never by Next (it is
// excluded from the app's tsconfig; see tsconfig.json). See all options:
// https://remotion.dev/docs/config
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
