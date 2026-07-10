// Fixture for the no-execsync-interpolation rule. Excluded from real scans via .semgrepignore.
import { execSync, execFileSync, exec } from "node:child_process";

export function bad(userInput: string): void {
  // ruleid: no-execsync-interpolation
  execSync(`git log --grep=${userInput}`);
  // ruleid: no-execsync-interpolation
  execSync("prefix-" + userInput);
  // ruleid: no-execsync-interpolation
  exec(`rm -rf ${userInput}`);
}

export function good(userInput: string): void {
  // ok: no-execsync-interpolation
  execFileSync("git", ["log", "--grep", userInput]);
  // ok: no-execsync-interpolation
  execSync("git --version");
}
