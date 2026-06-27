// @caisson/agent-kernel — the engine-neutral agent kernel (ADR-0065): agent/skill/rule schema +
// the lifecycle act FSM + the hooks dispatcher. This barrel is filled in by the schema / lifecycle /
// hooks modules (Wave-1 shared base, T4). No vendor SDK import, no LLM call — composition mechanism
// only; both the base packages (cli, mcp-server) and the agent-dev edition consume it down-only.
export {};
