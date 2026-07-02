// Test fixture — a minimal stub agent CLI for the runner-demo exit test: one edit tool_use +
// a result, plus an env dump so the composed demo re-asserts the leak contract.
const line = (event: unknown): void => {
  process.stdout.write(`${JSON.stringify(event)}\n`);
};
line({ type: "system", subtype: "init", env: { ...process.env } });
line({
  type: "assistant",
  message: {
    content: [
      {
        type: "tool_use",
        name: "Edit",
        input: { file_path: "demo/output.ts" },
      },
    ],
  },
});
line({ type: "result", subtype: "success", result: "stub run complete" });
