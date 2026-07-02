// Test fixture — a stub agent CLI that never finishes on its own (killed by the kill() test).
process.stdout.write(
  `${JSON.stringify({ type: "system", subtype: "init" })}\n`,
);
setTimeout(() => {
  // ponytail: 60s ceiling so an orphaned fixture self-reaps even if the kill test dies first.
}, 60_000);
