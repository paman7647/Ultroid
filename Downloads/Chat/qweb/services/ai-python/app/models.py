from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class PublicKey(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(index=True, unique=True)
    algorithm: str
    public_key: str
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class RoomMember(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    room_id: str = Field(index=True)
    user_id: str = Field(index=True)
    created_at: datetime = Field(default_factory=utc_now)


class Presence(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(index=True, unique=True)
    status: str
    updated_at: datetime = Field(default_factory=utc_now)


class EncryptedMessage(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    message_id: str = Field(index=True, unique=True)
    room_id: str = Field(index=True)
    sender_id: str = Field(index=True)
    client_msg_id: str | None = Field(default=None, index=True)
    ciphertext: str
    iv: str
    auth_tag: str
    key_envelope: str
    media_json: str = '[]'
    created_at: datetime = Field(default_factory=utc_now, index=True)
