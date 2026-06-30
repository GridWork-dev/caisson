"""Minimal liveness HTTP server for the cloud runner (ADR-0105).

The bot's Discord connection is outbound; the only inbound surface is ``/health``, which a runner
(Railway/Fly) polls to know the container is alive. It is unauthenticated liveness only — no secret,
no business data — so it needs no token (and thus no timing-safe compare). A stdlib asyncio TCP
responder keeps the dependency surface tiny; it runs as a task alongside the gateway.
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable


async def serve_health(
    *,
    port: int,
    is_ready: Callable[[], bool],
    host: str = "0.0.0.0",  # noqa: S104 - container liveness bind; the intended inbound surface.
) -> asyncio.AbstractServer:
    """Start a tiny HTTP server answering any request with the bot's readiness. Returns the server."""

    async def handle(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        try:
            await reader.read(2048)  # drain the request; the path is irrelevant for liveness.
            ready = is_ready()
            status = "200 OK" if ready else "503 Service Unavailable"
            body = b'{"ok":true}' if ready else b'{"ok":false}'
            head = (
                f"HTTP/1.1 {status}\r\n"
                "Content-Type: application/json\r\n"
                f"Content-Length: {len(body)}\r\n"
                "Connection: close\r\n\r\n"
            ).encode()
            writer.write(head + body)
            await writer.drain()
        except (ConnectionError, asyncio.IncompleteReadError):
            pass
        finally:
            writer.close()

    return await asyncio.start_server(handle, host, port)
