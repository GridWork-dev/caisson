#!/usr/bin/env bun
// tscn — the native TypeScript 7 compiler bin (ADR-0368 cutover). Resolves the aliased
// `tsc-native` package (typescript@7.0.2, bin-only npm publish) and execs its launcher.
// The classic typescript 6.x package stays installed solely for JS-API consumers
// (typescript-eslint, gate tooling); every check/build lane compiles through this bin.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pkgJson = fileURLToPath(import.meta.resolve("tsc-native/package.json"));
const bin = join(dirname(pkgJson), "bin", "tsc");
const result = spawnSync(bin, process.argv.slice(2), { stdio: "inherit" });
process.exit(result.status ?? 1);
