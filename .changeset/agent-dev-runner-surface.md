---
"@caisson/agent-dev": minor
---

The Agentic-Dev edition now re-exports the sandboxed agent-runner surface (createAgentRunner, buildEngineEnv, run summaries, and the runner config types) from the edition's single import home, completing the composition the edition manifest already declares. Runner provider configuration types are exposed as AgentRunnerProviderConfig / AgentRunnerProviderConfigInput to avoid clashing with the AI-config provider types.
