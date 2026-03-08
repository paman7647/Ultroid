from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class InternalAuthorized(BaseModel):
    pass


class PublicKeyUpsert(BaseModel):
    user_id: str = Field(min_length=1, max_length=128)
    algorithm: str = Field(min_length=2, max_length=64)
    public_key: str = Field(min_length=32, max_length=20000)


class PublicKeyResponse(BaseModel):
    user_id: str
    algorithm: str
    public_key: str
    updated_at: datetime


class CreateRoomRequest(BaseModel):
    room_id: str = Field(min_length=1, max_length=128)
    member_ids: list[str] = Field(min_length=2, max_length=256)


class PresenceUpdate(BaseModel):
    user_id: str = Field(min_length=1, max_length=128)
    status: str = Field(pattern='^(online|offline)$')


class MediaAttachment(BaseModel):
    blob_key: str = Field(min_length=1, max_length=1024)
    mime_type: str = Field(min_length=1, max_length=120)
    size: int = Field(ge=0, le=1024 * 1024 * 1024)
    thumb_key: str | None = Field(default=None, max_length=1024)


class EncryptedMessageIn(BaseModel):
    room_id: str = Field(min_length=1, max_length=128)
    sender_id: str = Field(min_length=1, max_length=128)
    client_msg_id: str | None = Field(default=None, max_length=128)
    ciphertext: str = Field(min_length=8, max_length=1_200_000)
    iv: str = Field(min_length=8, max_length=1024)
    auth_tag: str = Field(min_length=8, max_length=1024)
    key_envelope: str = Field(min_length=8, max_length=20000)
    media: list[MediaAttachment] = Field(default_factory=list, max_length=10)


class EncryptedMessageOut(BaseModel):
    message_id: str
    created_at: datetime


class EncryptedMessageRecord(BaseModel):
    message_id: str
    room_id: str
    sender_id: str
    client_msg_id: str | None = None
    ciphertext: str
    iv: str
    auth_tag: str
    key_envelope: str
    media: list[MediaAttachment] = Field(default_factory=list)
    created_at: datetime


class EncryptedMessageListResponse(BaseModel):
    items: list[EncryptedMessageRecord]
    next_cursor: str | None = None


class SmartReplyRequest(BaseModel):
    messages: list[str] = Field(default_factory=list, max_length=100)
    tone: str = Field(default='neutral', max_length=32)


class SmartReplyResponse(BaseModel):
    suggestions: list[str]


class VoiceToTextRequest(BaseModel):
    transcript_hint: str | None = Field(default=None, max_length=500)
    language: str = Field(default='en', max_length=16)
    audio_base64: str | None = Field(default=None, max_length=15_000_000)


class VoiceToTextResponse(BaseModel):
    transcript: str
    provider: str


class IceServer(BaseModel):
    urls: list[str]
    username: str | None = None
    credential: str | None = None


class IceConfigResponse(BaseModel):
    ice_servers: list[IceServer]


class RoomMembersResponse(BaseModel):
    room_id: str
    member_ids: list[str]


@field_validator('messages', mode='after')
def strip_messages(value: list[str]) -> list[str]:
    return [m.strip() for m in value if m and m.strip()]
