// Test fixture — a stub headless agent CLI emitting a real-shaped Claude Code stream-json run WITH
// tool_use ids and paired tool_result turns, so the trajectory recorder can map tool.proposed →
// tool.result by tool_use_id (the plain stub-agent.ts omits ids/results and stays for the lifecycle
// + leak-guard tests).
const emit = (event: unknown): void => {
  process.stdout.write(`${JSON.stringify(event)}\n`);
};

emit({ type: "system", subtype: "init", task: process.argv[2] ?? "" });
emit({
  type: "assistant",
  message: { content: [{ type: "text", text: "planning the change" }] },
});
emit({
  type: "assistant",
  message: {
    content: [
      {
        type: "tool_use",
        id: "toolu_write",
        name: "Write",
        input: { file_path: "src/hello.ts" },
      },
    ],
  },
});
emit({
  type: "user",
  message: {
    content: [
      {
        type: "tool_result",
        tool_use_id: "toolu_write",
        content: "wrote 1 file",
      },
    ],
  },
});
emit({
  type: "assistant",
  message: {
    content: [
      {
        type: "tool_use",
        id: "toolu_bash",
        name: "Bash",
        input: { command: "bun test" },
      },
    ],
  },
});
emit({
  type: "user",
  message: {
    content: [
      {
        type: "tool_result",
        tool_use_id: "toolu_bash",
        content: "1 pass",
        is_error: false,
      },
    ],
  },
});
emit({
  type: "result",
  subtype: "success",
  result: "done: wrote src/hello.ts",
});
