"""
Analytics service — usage metrics, statistics, real-time counters.
Uses Redis for real-time counters and in-memory aggregation.
"""

import time
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Any

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from .config import settings  # type: ignore[import-not-found]
from .security import require_internal_api_key  # type: ignore[import-not-found]

router = APIRouter(prefix="/v1/analytics", tags=["analytics"])

_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


# ─── Schemas ──────────────────────────────────────────────────────────

class TrackEventRequest(BaseModel):
    event_type: str = Field(max_length=64)
    user_id: str = Field(default="", max_length=128)
    room_id: str = Field(default="", max_length=128)
    metadata: dict[str, Any] = Field(default_factory=dict)


class MetricsSummary(BaseModel):
    messages_total: int
    messages_today: int
    active_users_today: int
    active_rooms_today: int
    calls_today: int
    voice_sessions_today: int
    bot_commands_today: int
    peak_concurrent_users: int
    avg_messages_per_user: float


class RoomAnalytics(BaseModel):
    room_id: str
    messages_today: int
    messages_week: int
    unique_senders_today: int
    most_active_hour: int
    avg_message_length: float


class UserAnalytics(BaseModel):
    user_id: str
    messages_sent: int
    messages_today: int
    rooms_active: int
    avg_session_duration_minutes: float
    last_active: str


class TimeSeriesPoint(BaseModel):
    timestamp: str
    value: int


class TimeSeriesResponse(BaseModel):
    metric: str
    period: str
    data: list[TimeSeriesPoint]


# ─── Redis-backed counters ───────────────────────────────────────────

def _day_key(prefix: str) -> str:
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    return f"analytics:{prefix}:{today}"


def _hour_key(prefix: str) -> str:
    now = datetime.now(timezone.utc)
    return f"analytics:{prefix}:{now.strftime('%Y%m%d')}:{now.hour:02d}"


@router.post("/track", dependencies=[Depends(require_internal_api_key)])
async def track_event(req: TrackEventRequest) -> dict[str, str]:
    """Track an analytics event."""
    r = await get_redis()
    pipe = r.pipeline()

    # Increment daily counter
    day = _day_key(req.event_type)
    pipe.incr(day)
    pipe.expire(day, 7 * 86400)

    # Increment hourly counter
    hour = _hour_key(req.event_type)
    pipe.incr(hour)
    pipe.expire(hour, 2 * 86400)

    # Track unique users per day
    if req.user_id:
        user_day = _day_key("active_users")
        pipe.sadd(user_day, req.user_id)
        pipe.expire(user_day, 7 * 86400)

    # Track unique rooms per day
    if req.room_id:
        room_day = _day_key("active_rooms")
        pipe.sadd(room_day, req.room_id)
        pipe.expire(room_day, 7 * 86400)

        # Per-room daily counter
        room_msg = _day_key(f"room:{req.room_id}:messages")
        pipe.incr(room_msg)
        pipe.expire(room_msg, 7 * 86400)

        # Per-room unique senders
        if req.user_id:
            room_senders = _day_key(f"room:{req.room_id}:senders")
            pipe.sadd(room_senders, req.user_id)
            pipe.expire(room_senders, 7 * 86400)

    await pipe.execute()
    return {"status": "tracked", "event_type": req.event_type}


@router.get("/summary", dependencies=[Depends(require_internal_api_key)])
async def get_summary() -> MetricsSummary:
    """Get overall platform metrics summary."""
    r = await get_redis()

    msgs_total = int(await r.get("analytics:messages_total") or 0)
    msgs_today = int(await r.get(_day_key("message_send")) or 0)
    active_users = await r.scard(_day_key("active_users"))  # type: ignore[misc]
    active_rooms = await r.scard(_day_key("active_rooms"))  # type: ignore[misc]
    calls_today = int(await r.get(_day_key("call_start")) or 0)
    voice_today = int(await r.get(_day_key("voice_join")) or 0)
    bot_cmds = int(await r.get(_day_key("bot_command")) or 0)
    peak = int(await r.get("analytics:peak_concurrent") or 0)

    avg_msgs = msgs_today / max(active_users, 1)

    return MetricsSummary(
        messages_total=msgs_total,
        messages_today=msgs_today,
        active_users_today=active_users,
        active_rooms_today=active_rooms,
        calls_today=calls_today,
        voice_sessions_today=voice_today,
        bot_commands_today=bot_cmds,
        peak_concurrent_users=peak,
        avg_messages_per_user=round(avg_msgs, 2),
    )


@router.get("/rooms/{room_id}", dependencies=[Depends(require_internal_api_key)])
async def get_room_analytics(room_id: str) -> RoomAnalytics:
    """Get analytics for a specific room."""
    r = await get_redis()
    today = datetime.now(timezone.utc).strftime("%Y%m%d")

    msgs_today = int(await r.get(f"analytics:room:{room_id}:messages:{today}") or 0)

    # Aggregate week
    msgs_week = 0
    for i in range(7):
        day = (datetime.now(timezone.utc) - timedelta(days=i)).strftime("%Y%m%d")
        count = int(await r.get(f"analytics:room:{room_id}:messages:{day}") or 0)
        msgs_week += count

    senders = await r.scard(f"analytics:room:{room_id}:senders:{today}")  # type: ignore[misc]

    # Find most active hour
    max_hour = 0
    max_count = 0
    for h in range(24):
        count = int(await r.get(f"analytics:room:{room_id}:messages:{today}:{h:02d}") or 0)
        if count > max_count:
            max_count = count
            max_hour = h

    return RoomAnalytics(
        room_id=room_id,
        messages_today=msgs_today,
        messages_week=msgs_week,
        unique_senders_today=senders,
        most_active_hour=max_hour,
        avg_message_length=0.0,
    )


@router.get("/timeseries/{metric}", dependencies=[Depends(require_internal_api_key)])
async def get_timeseries(
    metric: str,
    period: str = "24h",
) -> TimeSeriesResponse:
    """Get time-series data for a metric."""
    r = await get_redis()
    data: list[TimeSeriesPoint] = []

    if period == "24h":
        now = datetime.now(timezone.utc)
        for i in range(24):
            ts = now - timedelta(hours=23 - i)
            key = f"analytics:{metric}:{ts.strftime('%Y%m%d')}:{ts.hour:02d}"
            val = int(await r.get(key) or 0)
            data.append(TimeSeriesPoint(
                timestamp=ts.strftime("%Y-%m-%dT%H:00:00Z"),
                value=val,
            ))
    elif period == "7d":
        now = datetime.now(timezone.utc)
        for i in range(7):
            ts = now - timedelta(days=6 - i)
            key = f"analytics:{metric}:{ts.strftime('%Y%m%d')}"
            val = int(await r.get(key) or 0)
            data.append(TimeSeriesPoint(
                timestamp=ts.strftime("%Y-%m-%d"),
                value=val,
            ))

    return TimeSeriesResponse(metric=metric, period=period, data=data)


@router.post("/concurrent", dependencies=[Depends(require_internal_api_key)])
async def update_concurrent(count: int) -> dict[str, int]:
    """Update concurrent user count and track peak."""
    r = await get_redis()
    await r.set("analytics:concurrent_users", count, ex=300)

    peak = int(await r.get("analytics:peak_concurrent") or 0)
    if count > peak:
        await r.set("analytics:peak_concurrent", count)

    return {"concurrent": count, "peak": max(count, peak)}
