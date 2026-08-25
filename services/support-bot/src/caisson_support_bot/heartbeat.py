"""External dead-man heartbeat for the GCE worker.

The app emits one Google Cloud Monitoring custom gauge only while Discord reports ready. The writer
is disabled by default; T41 enables it and owns the missing-data alert policy. No database query or
local state participates, so the beat cannot keep Neon awake or make the VM authoritative.
"""

from __future__ import annotations

import asyncio
import sys
import time
from collections.abc import Callable

from google.cloud import monitoring_v3
from google.cloud.monitoring_v3.services.metric_service import MetricServiceAsyncClient

METRIC_TYPE = "custom.googleapis.com/caisson/support_bot/heartbeat"
_WRITE_TIMEOUT_S = 5.0


async def write_heartbeat(
    *, client: MetricServiceAsyncClient, project_id: str, now_s: float | None = None
) -> None:
    """Append one boolean GAUGE point to the worker's dead-man time series."""
    timestamp = time.time() if now_s is None else now_s
    seconds = int(timestamp)
    nanos = int((timestamp - seconds) * 1_000_000_000)

    series = monitoring_v3.TimeSeries()
    series.metric.type = METRIC_TYPE
    # Exactly one bot may be active, so the project-global resource is collision-free. It also
    # avoids a metadata-server dependency merely to discover the disposable VM's instance id.
    series.resource.type = "global"
    series.resource.labels["project_id"] = project_id
    series.points = [
        monitoring_v3.Point(
            {
                "interval": {"end_time": {"seconds": seconds, "nanos": nanos}},
                "value": {"bool_value": True},
            }
        )
    ]
    await client.create_time_series(
        name=f"projects/{project_id}", time_series=[series], timeout=_WRITE_TIMEOUT_S
    )


async def run_heartbeat(
    *,
    project_id: str,
    interval_s: float,
    stop: asyncio.Event,
    is_gateway_ready: Callable[[], bool],
    client: MetricServiceAsyncClient | None = None,
) -> None:
    """Emit while the Gateway is ready; failures are visible but never crash the bot."""
    owned_client = client is None
    if client is None:
        try:
            metric_client = MetricServiceAsyncClient()
        except Exception as exc:  # noqa: BLE001 - telemetry must not crash product work.
            sys.stderr.write(f"[heartbeat] client initialization failed ({type(exc).__name__})\n")
            return
    else:
        metric_client = client
    try:
        while not stop.is_set():
            if is_gateway_ready():
                try:
                    await write_heartbeat(client=metric_client, project_id=project_id)
                except Exception as exc:  # noqa: BLE001 - telemetry must not crash product work.
                    # Class only: API exception messages can contain request metadata.
                    sys.stderr.write(f"[heartbeat] emission failed ({type(exc).__name__})\n")
            try:
                await asyncio.wait_for(stop.wait(), timeout=interval_s)
            except TimeoutError:
                pass
    finally:
        if owned_client:
            try:
                await metric_client.transport.close()
            except Exception as exc:  # noqa: BLE001 - shutdown remains fail-soft.
                sys.stderr.write(f"[heartbeat] client close failed ({type(exc).__name__})\n")
