#!/usr/bin/env node
// Alias bin: runs the @caisson-sh/cli generator with this process's arguments.
import { main } from "@caisson-sh/cli/create";

await main(process.argv.slice(2));
