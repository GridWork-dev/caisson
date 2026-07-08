"""Live tests deliberately read real ambient creds (DISCORD_TOKEN, GUILD_ID, LINEAR_API_KEY,
BILLING_GRANT_TOKEN, ...) and self-skip without them (module-level ``pytest.mark.live`` +
``requires_creds``). Override the parent ``tests/conftest.py``'s ``_scrub_ambient_env`` autouse
fixture with a no-op here so those creds reach ``Settings(...)``/``os.environ`` undisturbed.
"""

from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _scrub_ambient_env() -> None:
    pass
