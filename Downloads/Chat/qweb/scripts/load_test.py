"""
QWeb Load Test Suite
====================
Simulates concurrent WebSocket connections and message throughput.

Usage:
    python load_test.py --users 1000 --duration 60 --target ws://localhost:4000/chat

Requires: pip install websockets aiohttp
"""

import argparse
import asyncio
import json
import random
import string
import statistics
import time
from dataclasses import dataclass, field

try:
    import websockets
except ImportError:
    print("Install websockets: pip install websockets")
    exit(1)

try:
    import aiohttp
except ImportError:
    print("Install aiohttp: pip install aiohttp")
    exit(1)


@dataclass
class TestMetrics:
    connections_attempted: int = 0
    connections_successful: int = 0
    connections_failed: int = 0
    messages_sent: int = 0
    messages_received: int = 0
    messages_failed: int = 0
    latencies_ms: list[float] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    start_time: float = 0
    end_time: float = 0

    @property
    def duration(self) -> float:
        return self.end_time - self.start_time

    @property
    def avg_latency_ms(self) -> float:
        return statistics.mean(self.latencies_ms) if self.latencies_ms else 0

    @property
    def p50_latency_ms(self) -> float:
        return statistics.median(self.latencies_ms) if self.latencies_ms else 0

    @property
    def p95_latency_ms(self) -> float:
        if not self.latencies_ms:
            return 0
        sorted_lat = sorted(self.latencies_ms)
        idx = int(len(sorted_lat) * 0.95)
        return sorted_lat[min(idx, len(sorted_lat) - 1)]

    @property
    def p99_latency_ms(self) -> float:
        if not self.latencies_ms:
            return 0
        sorted_lat = sorted(self.latencies_ms)
        idx = int(len(sorted_lat) * 0.99)
        return sorted_lat[min(idx, len(sorted_lat) - 1)]

    @property
    def msg_per_sec(self) -> float:
        return self.messages_sent / self.duration if self.duration > 0 else 0


def random_text(length: int = 50) -> str:
    return ''.join(random.choices(string.ascii_letters + string.digits + ' ', k=length))


async def simulate_user(
    user_id: int,
    api_url: str,
    ws_url: str,
    room_id: str,
    duration: int,
    metrics: TestMetrics,
    semaphore: asyncio.Semaphore,
):
    """Simulate a single user: connect via WebSocket, send messages, measure latency."""
    async with semaphore:
        metrics.connections_attempted += 1

        try:
            # For load testing, we use a mock token approach
            # In production, this would authenticate first
            headers = {"Authorization": f"Bearer load-test-user-{user_id}"}

            async with websockets.connect(
                f"{ws_url}",
                additional_headers=headers,
                open_timeout=10,
            ) as ws:
                metrics.connections_successful += 1

                # Join room
                await ws.send(json.dumps({
                    "event": "room:join",
                    "data": {"roomId": room_id},
                }))

                end_time = time.monotonic() + duration

                while time.monotonic() < end_time:
                    try:
                        # Send a message
                        send_time = time.monotonic()
                        msg = {
                            "event": "message:send",
                            "data": {
                                "roomId": room_id,
                                "text": random_text(),
                                "clientMsgId": f"lt-{user_id}-{int(send_time * 1000)}",
                            },
                        }
                        await ws.send(json.dumps(msg))
                        metrics.messages_sent += 1

                        # Wait for ack with timeout
                        try:
                            response = await asyncio.wait_for(ws.recv(), timeout=5.0)
                            recv_time = time.monotonic()
                            latency = (recv_time - send_time) * 1000
                            metrics.latencies_ms.append(latency)
                            metrics.messages_received += 1
                        except asyncio.TimeoutError:
                            metrics.messages_failed += 1

                        # Random delay between messages (100ms - 2s)
                        await asyncio.sleep(random.uniform(0.1, 2.0))

                    except Exception as e:
                        metrics.messages_failed += 1
                        metrics.errors.append(f"User {user_id}: send error: {str(e)[:100]}")

        except Exception as e:
            metrics.connections_failed += 1
            metrics.errors.append(f"User {user_id}: connection error: {str(e)[:100]}")


async def run_load_test(
    num_users: int,
    duration: int,
    api_url: str,
    ws_url: str,
    room_id: str,
    max_concurrent: int,
):
    metrics = TestMetrics()
    semaphore = asyncio.Semaphore(max_concurrent)

    print(f"\n{'='*60}")
    print(f"  QWeb Load Test")
    print(f"  Users: {num_users}")
    print(f"  Duration: {duration}s")
    print(f"  Max concurrent: {max_concurrent}")
    print(f"  Target: {ws_url}")
    print(f"{'='*60}\n")

    metrics.start_time = time.monotonic()

    tasks = [
        simulate_user(i, api_url, ws_url, room_id, duration, metrics, semaphore)
        for i in range(num_users)
    ]

    # Stagger connection starts
    batched_tasks = []
    batch_size = min(100, num_users)
    for i in range(0, len(tasks), batch_size):
        batch = tasks[i:i + batch_size]
        batched_tasks.append(asyncio.gather(*batch, return_exceptions=True))
        if i + batch_size < len(tasks):
            await asyncio.sleep(0.5)  # 500ms between batches

    await asyncio.gather(*batched_tasks, return_exceptions=True)

    metrics.end_time = time.monotonic()

    # Print results
    print(f"\n{'='*60}")
    print(f"  RESULTS")
    print(f"{'='*60}")
    print(f"  Duration:              {metrics.duration:.1f}s")
    print(f"  Connections attempted: {metrics.connections_attempted}")
    print(f"  Connections success:   {metrics.connections_successful}")
    print(f"  Connections failed:    {metrics.connections_failed}")
    print(f"  Messages sent:         {metrics.messages_sent}")
    print(f"  Messages received:     {metrics.messages_received}")
    print(f"  Messages failed:       {metrics.messages_failed}")
    print(f"  Throughput:            {metrics.msg_per_sec:.1f} msg/s")
    print(f"  Avg latency:           {metrics.avg_latency_ms:.1f}ms")
    print(f"  P50 latency:           {metrics.p50_latency_ms:.1f}ms")
    print(f"  P95 latency:           {metrics.p95_latency_ms:.1f}ms")
    print(f"  P99 latency:           {metrics.p99_latency_ms:.1f}ms")

    if metrics.errors:
        print(f"\n  Errors ({len(metrics.errors)} total, showing first 10):")
        for err in metrics.errors[:10]:
            print(f"    - {err}")

    print(f"{'='*60}\n")

    return metrics


def main():
    parser = argparse.ArgumentParser(description="QWeb Load Test")
    parser.add_argument("--users", type=int, default=100, help="Number of simulated users")
    parser.add_argument("--duration", type=int, default=30, help="Test duration in seconds")
    parser.add_argument("--api", type=str, default="http://localhost:4000", help="API base URL")
    parser.add_argument("--target", type=str, default="ws://localhost:4000/chat", help="WebSocket URL")
    parser.add_argument("--room", type=str, default="load-test-room", help="Room ID to test")
    parser.add_argument("--concurrent", type=int, default=500, help="Max concurrent connections")
    args = parser.parse_args()

    asyncio.run(run_load_test(
        num_users=args.users,
        duration=args.duration,
        api_url=args.api,
        ws_url=args.target,
        room_id=args.room,
        max_concurrent=args.concurrent,
    ))


if __name__ == "__main__":
    main()
