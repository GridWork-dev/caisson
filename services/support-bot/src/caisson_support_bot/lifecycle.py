"""Bounded shutdown primitives for the disposable GCE worker.

The process has one dangerous inbound mutation: a callback can grant Discord roles.  Shutdown
therefore closes this gate before closing the Gateway, waits a bounded interval for in-flight work,
and cancels anything that cannot finish inside the container grace period.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from discord.ext import commands


class PrivilegedWorkClosed(RuntimeError):
    """Raised when a mutating request arrives after graceful shutdown has begun."""


class PrivilegedWorkGate:
    """Track privileged mutations so shutdown can reject new work and drain active work."""

    def __init__(self) -> None:
        self._accepting = True
        self._active: set[asyncio.Task[object]] = set()
        self._empty = asyncio.Event()
        self._empty.set()

    @property
    def accepting(self) -> bool:
        return self._accepting

    def stop_accepting(self) -> None:
        """Atomically close the gate. The event loop cannot interleave before ``track`` registers."""
        self._accepting = False

    @asynccontextmanager
    async def track(self) -> AsyncIterator[None]:
        """Register the current task as active, or reject it after the gate closes."""
        if not self._accepting:
            raise PrivilegedWorkClosed("privileged work gate is closed")
        task = asyncio.current_task()
        # An async context always runs inside a Task in practice.
        if task is None:  # pragma: no cover
            raise RuntimeError("privileged work must run inside an asyncio task")
        self._active.add(task)
        self._empty.clear()
        try:
            yield
        finally:
            self._active.discard(task)
            if not self._active:
                self._empty.set()

    async def drain(self, *, timeout_s: float) -> bool:
        """Stop new mutations and wait for active ones; cancel stragglers at the deadline.

        Returns ``True`` when all work completed naturally. A ``False`` result means one or more
        tasks were cancelled. Role grants remain retry-safe because the handler applies only roles
        absent from the member when a caller retries after replacement.
        """
        self.stop_accepting()
        try:
            await asyncio.wait_for(self._empty.wait(), timeout=timeout_s)
            return True
        except TimeoutError:
            active = tuple(self._active)
            for task in active:
                task.cancel()
            await asyncio.gather(*active, return_exceptions=True)
            return False


async def run_gateway(
    *,
    bot: commands.Bot,
    token: str,
    shutdown: asyncio.Event,
    work_gate: PrivilegedWorkGate,
    shutdown_grace_s: float,
) -> None:
    """Run Discord until SIGTERM, then close the mutation gate and Gateway within a deadline.

    ``discord.py`` 2.7's reconnect loop owns the protocol state: ``reconnect=True`` uses its
    exponential full-jitter backoff and preserves sequence/session/gateway fields for RESUME before
    falling back to a fresh session. Keeping that behavior in the library avoids a competing outer
    retry loop that would discard resumable state.
    """
    gateway_task = asyncio.create_task(bot.start(token, reconnect=True), name="discord-gateway")
    shutdown_task = asyncio.create_task(shutdown.wait(), name="shutdown-signal")
    done, _ = await asyncio.wait({gateway_task, shutdown_task}, return_when=asyncio.FIRST_COMPLETED)

    unexpected_exit = gateway_task in done and not shutdown.is_set()
    gateway_error: BaseException | None = None
    if gateway_task.done():
        try:
            await gateway_task
        except BaseException as exc:  # preserve the exact gateway failure after cleanup.
            gateway_error = exc

    # Ordering is load-bearing: reject a new grant, let an in-flight Discord REST mutation settle,
    # then close the Gateway/HTTP client it depends on. A stalled mutation is cancelled at the
    # drain deadline, so this cannot hold the disposable worker open indefinitely.
    work_gate.stop_accepting()
    await work_gate.drain(timeout_s=shutdown_grace_s)

    close_error: Exception | None = None
    try:
        await asyncio.wait_for(bot.close(), timeout=shutdown_grace_s)
    except TimeoutError:
        # The supervisor will replace this disposable process; do not hang past its grace window.
        pass
    # Drain first, then preserve the exact close failure for the supervisor.
    except Exception as exc:
        close_error = exc

    shutdown_task.cancel()
    await asyncio.gather(shutdown_task, return_exceptions=True)
    if not gateway_task.done():
        try:
            await asyncio.wait_for(gateway_task, timeout=shutdown_grace_s)
        except TimeoutError:
            gateway_task.cancel()
            await asyncio.gather(gateway_task, return_exceptions=True)

    if gateway_error is not None:
        raise gateway_error
    if close_error is not None:
        raise close_error
    if unexpected_exit:
        raise RuntimeError("Discord Gateway exited without a shutdown signal")
