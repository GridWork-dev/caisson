---
"@caisson/agent-kernel": minor
"@caisson/local-sync": minor
"@caisson/local-ai": patch
"@caisson/site": patch
---

Agent kernel gains a browser-safe `./browser` entry point: the agent/skill/rule schema and its
authoring helpers, the seven-act lifecycle FSM, the allow/deny/mutate governance algebra, and the
redacting logger can now be imported inside a client bundle. The main entry is unchanged and keeps
the full surface, including the shell-command hook handler and the audited hash-chain lifecycle;
every browser-entry export is also available there.

Local sync needs no second entry point, because its single entry is now browser-safe end to end:
the changeset types, the hybrid logical clock, and the tombstone-aware merge all import cleanly
into a client bundle. As part of that, the replica id minted when a change log is first opened now
uses the runtime's built-in WebCrypto `crypto.randomUUID()` instead of the Node crypto module —
the same UUID format, and the id is still persisted and reused on every later open — and the
package now declares a Node 20.12 minimum.

The site's agent-kernel and local-sync interactive demos run the shipped packages end to end
instead of hand-maintained copies of their logic.
