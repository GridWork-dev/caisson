---
"@caisson/agent-usage": minor
---

New usage-adapter package for the agent-trajectory event contract: a Codex CLI rollout reader and a
price-normalization pass that turns real, adapter-extracted token counts into a cost estimate you can
trust. The Codex reader never guesses which model or provider produced a turn, reads per-turn usage
from the session's own reported deltas rather than summing its running counters, and marks a session
with no usable usage data as unsupported instead of reporting a false zero. The price-normalization
pass upgrades an adapter's estimated usage into a priced cost statement — computed against the same
versioned rate table the metered gateway uses, in whole credit units — whenever the reported model is
one this release recognizes; an unrecognized model is left as an honest estimate rather than a guess.
This is a cost statement only: nothing here settles against your credit balance. Reserved and
unpublished for now: it joins no bundle and carries no committed price until the runtime loop lands.
