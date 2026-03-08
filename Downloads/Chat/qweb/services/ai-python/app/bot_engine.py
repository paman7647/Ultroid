"""
Bot engine service — runs bot commands and dispatches events to bot workers.
Uses Redis Streams for event distribution and command queuing.
"""

import asyncio
import json
import time
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .config import settings  # type: ignore[import-not-found]
from .security import require_internal_api_key  # type: ignore[import-not-found]

router = APIRouter(prefix="/v1/bots", tags=["bots"])

# Redis connection for bot event streams
_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(
            settings.redis_url, decode_responses=True, max_connections=20
        )
    return _redis


# ─── Schemas ──────────────────────────────────────────────────────────

class BotEvent(BaseModel):
    event_type: str = Field(max_length=64)
    bot_id: str = Field(max_length=128)
    room_id: str = Field(max_length=128)
    data: dict[str, Any] = Field(default_factory=dict)


class BotCommandExec(BaseModel):
    bot_id: str = Field(max_length=128)
    room_id: str = Field(max_length=128)
    user_id: str = Field(max_length=128)
    command: str = Field(max_length=256)
    args: list[str] = Field(default_factory=list, max_length=64)


class BotCommandResult(BaseModel):
    bot_id: str
    command: str
    result: dict[str, Any]
    executed_at: str


class BotWorkerStatus(BaseModel):
    bot_id: str
    status: str  # running, stopped, error
    uptime_seconds: float
    commands_processed: int
    last_heartbeat: str


# ─── In-memory bot worker registry ───────────────────────────────────

_bot_workers: dict[str, dict[str, Any]] = {}
_worker_stats: dict[str, dict[str, Any]] = {}


# ─── Built-in command handlers ───────────────────────────────────────

async def _handle_ping(bot_id: str, args: list[str]) -> dict[str, Any]:
    return {"response": "pong", "timestamp": datetime.now(timezone.utc).isoformat()}


async def _handle_help(bot_id: str, args: list[str]) -> dict[str, Any]:
    r = await get_redis()
    commands_raw = await r.hgetall(f"bot:commands:{bot_id}")  # type: ignore[misc]
    commands = []
    for name, meta_json in commands_raw.items():
        meta = json.loads(meta_json)
        commands.append({"name": name, "description": meta.get("description", "")})
    return {"commands": commands}


BUILTIN_COMMANDS: dict[str, Any] = {
    "ping": _handle_ping,
    "help": _handle_help,
}


# ─── Routes ──────────────────────────────────────────────────────────

@router.post("/events/dispatch", dependencies=[Depends(require_internal_api_key)])
async def dispatch_bot_event(event: BotEvent) -> dict[str, str]:
    """Push a bot event into the Redis stream for async processing."""
    r = await get_redis()
    stream_key = f"bot:events:{event.bot_id}"
    event_id = await r.xadd(
        stream_key,
        {
            "event_type": event.event_type,
            "room_id": event.room_id,
            "data": json.dumps(event.data),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
        maxlen=10_000,
    )
    return {"event_id": event_id, "stream": stream_key}


@router.post("/commands/execute", dependencies=[Depends(require_internal_api_key)])
async def execute_bot_command(cmd: BotCommandExec) -> BotCommandResult:
    """Execute a bot command synchronously (for simple commands) or queue it."""
    r = await get_redis()

    # Check built-in commands first
    handler = BUILTIN_COMMANDS.get(cmd.command)
    if handler:
        result = await handler(cmd.bot_id, cmd.args)
        return BotCommandResult(
            bot_id=cmd.bot_id,
            command=cmd.command,
            result=result,
            executed_at=datetime.now(timezone.utc).isoformat(),
        )

    # Check registered custom commands
    cmd_meta_raw = await r.hget(f"bot:commands:{cmd.bot_id}", cmd.command)  # type: ignore[misc]
    if not cmd_meta_raw:
        raise HTTPException(status_code=404, detail=f"Command '{cmd.command}' not found")

    # Queue for async execution via Redis stream
    job_id = str(uuid4())
    await r.xadd(
        f"bot:commands:queue:{cmd.bot_id}",
        {
            "job_id": job_id,
            "command": cmd.command,
            "args": json.dumps(cmd.args),
            "user_id": cmd.user_id,
            "room_id": cmd.room_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
        maxlen=5_000,
    )

    # Wait for result with timeout (simple polling)
    result_key = f"bot:cmd:result:{job_id}"
    for _ in range(50):  # 5 seconds max
        result_raw = await r.get(result_key)
        if result_raw:
            await r.delete(result_key)
            return BotCommandResult(
                bot_id=cmd.bot_id,
                command=cmd.command,
                result=json.loads(result_raw),
                executed_at=datetime.now(timezone.utc).isoformat(),
            )
        await asyncio.sleep(0.1)

    # Timeout — return queued status
    return BotCommandResult(
        bot_id=cmd.bot_id,
        command=cmd.command,
        result={"status": "queued", "job_id": job_id},
        executed_at=datetime.now(timezone.utc).isoformat(),
    )


@router.post("/commands/register", dependencies=[Depends(require_internal_api_key)])
async def register_bot_command(
    bot_id: str = Field(max_length=128),
    command: str = Field(max_length=64),
    description: str = Field(default="", max_length=256),
    usage: str = Field(default="", max_length=256),
) -> dict[str, str]:
    """Register a custom command for a bot."""
    r = await get_redis()
    await r.hset(  # type: ignore[misc]
        f"bot:commands:{bot_id}",
        command,
        json.dumps({"description": description, "usage": usage}),
    )
    return {"bot_id": bot_id, "command": command, "status": "registered"}


@router.get("/workers/{bot_id}/status", dependencies=[Depends(require_internal_api_key)])
async def get_worker_status(bot_id: str) -> BotWorkerStatus:
    """Get the status of a bot worker."""
    r = await get_redis()
    heartbeat = await r.get(f"bot:heartbeat:{bot_id}")
    stats_raw = await r.hgetall(f"bot:stats:{bot_id}")  # type: ignore[misc]

    if not heartbeat:
        return BotWorkerStatus(
            bot_id=bot_id,
            status="stopped",
            uptime_seconds=0,
            commands_processed=0,
            last_heartbeat="never",
        )

    return BotWorkerStatus(
        bot_id=bot_id,
        status="running",
        uptime_seconds=float(stats_raw.get("uptime", 0)),
        commands_processed=int(stats_raw.get("commands_processed", 0)),
        last_heartbeat=heartbeat,
    )


@router.post("/workers/{bot_id}/heartbeat", dependencies=[Depends(require_internal_api_key)])
async def bot_heartbeat(bot_id: str, commands_processed: int = 0) -> dict[str, str]:
    """Record a bot worker heartbeat."""
    r = await get_redis()
    now = datetime.now(timezone.utc).isoformat()
    await r.set(f"bot:heartbeat:{bot_id}", now, ex=120)
    await r.hset(f"bot:stats:{bot_id}", mapping={  # type: ignore[misc]
        "commands_processed": str(commands_processed),
        "last_heartbeat": now,
    })
    return {"status": "ok", "bot_id": bot_id}


@router.get("/events/{bot_id}/stream", dependencies=[Depends(require_internal_api_key)])
async def read_bot_events(
    bot_id: str, last_id: str = "0", count: int = 50
) -> dict[str, Any]:
    """Read events from a bot's event stream."""
    r = await get_redis()
    stream_key = f"bot:events:{bot_id}"
    entries = await r.xrange(stream_key, min=last_id, count=min(count, 200))
    events = []
    for entry_id, fields in entries:
        data = json.loads(fields.get("data", "{}"))
        events.append({
            "id": entry_id,
            "event_type": fields.get("event_type"),
            "room_id": fields.get("room_id"),
            "data": data,
            "timestamp": fields.get("timestamp"),
        })
    return {"bot_id": bot_id, "events": events}
