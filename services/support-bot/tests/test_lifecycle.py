"""Disposable-worker lifecycle contracts: close the mutation gate, drain, then exit."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

import pytest

from caisson_support_bot.lifecycle import PrivilegedWorkClosed, PrivilegedWorkGate, run_gateway


async def test_gate_rejects_new_work_after_shutdown_starts() -> None:
    gate = PrivilegedWorkGate()
    gate.stop_accepting()

    with pytest.raises(PrivilegedWorkClosed):
        async with gate.track():
            pass


async def test_gate_drains_an_active_mutation_before_returning() -> None:
    gate = PrivilegedWorkGate()
    entered = asyncio.Event()
    release = asyncio.Event()

    async def mutate() -> None:
        async with gate.track():
            entered.set()
            await release.wait()

    task = asyncio.create_task(mutate())
    await entered.wait()
    drain = asyncio.create_task(gate.drain(timeout_s=1.0))
    await asyncio.sleep(0)

    assert not drain.done()
    release.set()
    assert await drain is True
    await task


async def test_gate_cancels_a_stalled_mutation_at_the_drain_deadline() -> None:
    gate = PrivilegedWorkGate()
    entered = asyncio.Event()

    async def mutate_forever() -> None:
        async with gate.track():
            entered.set()
            await asyncio.Event().wait()

    task = asyncio.create_task(mutate_forever())
    await entered.wait()

    assert await gate.drain(timeout_s=0.01) is False
    assert task.cancelled()


async def test_gateway_enables_library_reconnect_and_closes_after_gate_stops() -> None:
    shutdown = asyncio.Event()
    gate = PrivilegedWorkGate()
    order: list[str] = []

    async def start(_token: str, *, reconnect: bool) -> None:
        assert reconnect is True
        order.append("gateway-start")
        await shutdown.wait()

    async def close() -> None:
        assert gate.accepting is False
        order.append("gateway-close")

    bot = AsyncMock()
    bot.start.side_effect = start
    bot.close.side_effect = close

    task = asyncio.create_task(
        run_gateway(
            bot=bot,
            token="discord-token",
            shutdown=shutdown,
            work_gate=gate,
            shutdown_grace_s=1.0,
        )
    )
    await asyncio.sleep(0)
    shutdown.set()
    await task

    assert order == ["gateway-start", "gateway-close"]
    bot.start.assert_awaited_once_with("discord-token", reconnect=True)
    bot.close.assert_awaited_once()


async def test_gateway_drains_active_privileged_work_before_closing_discord() -> None:
    shutdown = asyncio.Event()
    gate = PrivilegedWorkGate()
    entered = asyncio.Event()
    release = asyncio.Event()
    close_called = asyncio.Event()
    order: list[str] = []

    async def mutate() -> None:
        async with gate.track():
            order.append("mutation-start")
            entered.set()
            await release.wait()
            order.append("mutation-finish")

    mutation = asyncio.create_task(mutate())
    await entered.wait()

    async def start(_token: str, *, reconnect: bool) -> None:
        assert reconnect is True
        await shutdown.wait()

    async def close() -> None:
        close_called.set()
        order.append("gateway-close")

    bot = AsyncMock()
    bot.start.side_effect = start
    bot.close.side_effect = close
    task = asyncio.create_task(
        run_gateway(
            bot=bot,
            token="discord-token",
            shutdown=shutdown,
            work_gate=gate,
            shutdown_grace_s=1.0,
        )
    )
    await asyncio.sleep(0)
    shutdown.set()
    await asyncio.sleep(0.01)

    assert not close_called.is_set()
    bot.close.assert_not_awaited()
    release.set()
    await task
    await mutation
    assert order == ["mutation-start", "mutation-finish", "gateway-close"]


async def test_gateway_close_failure_still_cancels_stalled_privileged_work() -> None:
    shutdown = asyncio.Event()
    gate = PrivilegedWorkGate()
    entered = asyncio.Event()

    async def mutate_forever() -> None:
        async with gate.track():
            entered.set()
            await asyncio.Event().wait()

    mutation = asyncio.create_task(mutate_forever())
    await entered.wait()

    async def start(_token: str, *, reconnect: bool) -> None:
        assert reconnect is True
        await shutdown.wait()

    bot = AsyncMock()
    bot.start.side_effect = start
    bot.close.side_effect = RuntimeError("gateway close failed")
    task = asyncio.create_task(
        run_gateway(
            bot=bot,
            token="discord-token",
            shutdown=shutdown,
            work_gate=gate,
            shutdown_grace_s=0.01,
        )
    )
    await asyncio.sleep(0)
    shutdown.set()

    with pytest.raises(RuntimeError, match="gateway close failed"):
        await task
    assert mutation.cancelled()
