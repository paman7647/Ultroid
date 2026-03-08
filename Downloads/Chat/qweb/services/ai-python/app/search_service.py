"""
Search indexing service — full-text search for messages using PostgreSQL tsvector
and an in-memory inverted index for fast keyword lookup.
"""

import re
import time
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from .security import require_internal_api_key  # type: ignore[import-not-found]

router = APIRouter(prefix="/v1/search", tags=["search"])


# ─── Schemas ──────────────────────────────────────────────────────────

class IndexMessageRequest(BaseModel):
    message_id: str = Field(max_length=128)
    room_id: str = Field(max_length=128)
    sender_id: str = Field(max_length=128)
    content: str = Field(max_length=50_000)
    timestamp: str = Field(max_length=64)


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    room_id: str | None = Field(default=None, max_length=128)
    sender_id: str | None = Field(default=None, max_length=128)
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class SearchResult(BaseModel):
    message_id: str
    room_id: str
    sender_id: str
    content: str
    snippet: str
    score: float
    timestamp: str


class SearchResponse(BaseModel):
    results: list[SearchResult]
    total: int
    query: str
    took_ms: float


class IndexStats(BaseModel):
    total_messages: int
    total_terms: int
    rooms_indexed: int
    last_indexed_at: str | None


# ─── In-memory inverted index ────────────────────────────────────────

class InvertedIndex:
    def __init__(self):
        self._term_index: dict[str, set[str]] = defaultdict(set)  # term -> set of message_ids
        self._messages: dict[str, dict[str, str]] = {}  # message_id -> {room_id, sender_id, content, timestamp}
        self._room_messages: dict[str, set[str]] = defaultdict(set)
        self._last_indexed: str | None = None

    def _tokenize(self, text: str) -> list[str]:
        """Simple tokenizer: lowercase, split on non-alphanumeric, filter short tokens."""
        words = re.findall(r"[a-z0-9]+", text.lower())
        return [w for w in words if len(w) >= 2]

    def index_message(self, message_id: str, room_id: str, sender_id: str, content: str, timestamp: str):
        self._messages[message_id] = {
            "room_id": room_id,
            "sender_id": sender_id,
            "content": content,
            "timestamp": timestamp,
        }
        self._room_messages[room_id].add(message_id)
        self._last_indexed = datetime.now(timezone.utc).isoformat()

        tokens = self._tokenize(content)
        for token in set(tokens):
            self._term_index[token].add(message_id)

    def remove_message(self, message_id: str):
        msg = self._messages.pop(message_id, None)
        if msg:
            self._room_messages[msg["room_id"]].discard(message_id)
            tokens = self._tokenize(msg["content"])
            for token in set(tokens):
                self._term_index[token].discard(message_id)

    def search(
        self,
        query: str,
        room_id: str | None = None,
        sender_id: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[dict[str, Any]], int]:
        query_tokens = self._tokenize(query)
        if not query_tokens:
            return [], 0

        # Find messages matching ALL query tokens (AND semantics)
        matching: set[str] | None = None
        for token in query_tokens:
            token_matches = self._term_index.get(token, set())
            if matching is None:
                matching = set(token_matches)
            else:
                matching &= token_matches

        if not matching:
            return [], 0

        # Filter by room/sender
        if room_id:
            room_msgs = self._room_messages.get(room_id, set())
            matching &= room_msgs

        results: list[dict[str, Any]] = []
        for mid in matching:
            msg = self._messages.get(mid)
            if not msg:
                continue
            if sender_id and msg["sender_id"] != sender_id:
                continue

            # Score: count of query tokens found in content
            content_lower = msg["content"].lower()
            score = sum(1 for t in query_tokens if t in content_lower) / len(query_tokens)

            # Create snippet with context around first match
            snippet = self._create_snippet(msg["content"], query_tokens)

            results.append({
                "message_id": mid,
                "room_id": msg["room_id"],
                "sender_id": msg["sender_id"],
                "content": msg["content"],
                "snippet": snippet,
                "score": round(score, 3),
                "timestamp": msg["timestamp"],
            })

        results.sort(key=lambda x: (-x["score"], x["timestamp"]))
        total = len(results)
        return results[offset:offset + limit], total

    def _create_snippet(self, content: str, tokens: list[str], context_chars: int = 80) -> str:
        lower = content.lower()
        best_pos = len(content)
        for token in tokens:
            pos = lower.find(token)
            if pos != -1 and pos < best_pos:
                best_pos = pos

        start = max(0, best_pos - context_chars // 2)
        end = min(len(content), best_pos + context_chars)
        snippet = content[start:end]
        if start > 0:
            snippet = "..." + snippet
        if end < len(content):
            snippet = snippet + "..."
        return snippet

    def stats(self) -> dict[str, Any]:
        return {
            "total_messages": len(self._messages),
            "total_terms": len(self._term_index),
            "rooms_indexed": len(self._room_messages),
            "last_indexed_at": self._last_indexed,
        }


# Singleton index
_index = InvertedIndex()


# ─── Routes ──────────────────────────────────────────────────────────

@router.post("/index", dependencies=[Depends(require_internal_api_key)])
async def index_message(req: IndexMessageRequest) -> dict[str, str]:
    """Index a message for full-text search."""
    _index.index_message(
        message_id=req.message_id,
        room_id=req.room_id,
        sender_id=req.sender_id,
        content=req.content,
        timestamp=req.timestamp,
    )
    return {"message_id": req.message_id, "status": "indexed"}


@router.delete("/index/{message_id}", dependencies=[Depends(require_internal_api_key)])
async def remove_indexed_message(message_id: str) -> dict[str, str]:
    """Remove a message from the search index."""
    _index.remove_message(message_id)
    return {"message_id": message_id, "status": "removed"}


@router.post("/query", dependencies=[Depends(require_internal_api_key)])
async def search_messages(req: SearchRequest) -> SearchResponse:
    """Search indexed messages."""
    start = time.monotonic()
    results, total = _index.search(
        query=req.query,
        room_id=req.room_id,
        sender_id=req.sender_id,
        limit=req.limit,
        offset=req.offset,
    )
    elapsed = (time.monotonic() - start) * 1000

    return SearchResponse(
        results=[SearchResult(**r) for r in results],
        total=total,
        query=req.query,
        took_ms=round(elapsed, 2),
    )


@router.get("/stats", dependencies=[Depends(require_internal_api_key)])
async def search_stats() -> IndexStats:
    """Get search index statistics."""
    s = _index.stats()
    return IndexStats(**s)
