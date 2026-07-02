// Test fixture — a stub headless agent CLI. Emits a minimal stream-json transcript shaped like a
// real agent run (init → text → tool_use → result), INCLUDING a full dump of its own env so the
// leak-guard test can assert end-to-end that no parent secret crossed the spawn boundary.
const emit = (event: unknown): void => {
  process.stdout.write(`${JSON.stringify(event)}\n`);
};

emit({
  type: "system",
  subtype: "init",
  task: process.argv[2] ?? "",
  env: { ...process.env },
});
emit({
  type: "assistant",
  message: { content: [{ type: "text", text: "planning the change" }] },
});
emit({
  type: "assistant",
  message: {
    content: [
      { type: "tool_use", name: "Write", input: { file_path: "src/hello.ts" } },
    ],
  },
});
emit({
  type: "assistant",
  message: {
    content: [
      { type: "tool_use", name: "Bash", input: { command: "bun test" } },
    ],
  },
});
emit({
  type: "result",
  subtype: "success",
  result: "done: wrote src/hello.ts",
});
