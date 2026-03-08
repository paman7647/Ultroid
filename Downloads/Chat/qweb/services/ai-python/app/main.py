import json
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Query
from sqlmodel import Session, select

from .config import settings  # type: ignore[import-not-found]
from .db import create_db_and_tables, get_session  # type: ignore[import-not-found]
from .models import EncryptedMessage, Presence, PublicKey, RoomMember  # type: ignore[import-not-found]
from .schemas import (  # type: ignore[import-not-found]
    CreateRoomRequest,
    EncryptedMessageIn,
    EncryptedMessageListResponse,
    EncryptedMessageOut,
    EncryptedMessageRecord,
    IceConfigResponse,
    IceServer,
    PresenceUpdate,
    PublicKeyResponse,
    PublicKeyUpsert,
    RoomMembersResponse,
    SmartReplyRequest,
    SmartReplyResponse,
    VoiceToTextRequest,
    VoiceToTextResponse,
)
from .security import require_internal_api_key  # type: ignore[import-not-found]

# Import sub-service routers
from .bot_engine import router as bot_engine_router  # type: ignore[import-not-found]
from .ai_service import router as ai_router  # type: ignore[import-not-found]
from .media_service import router as media_router  # type: ignore[import-not-found]
from .search_service import router as search_router  # type: ignore[import-not-found]
from .analytics_service import router as analytics_router  # type: ignore[import-not-found]


app = FastAPI(title='qweb ai/media service', version='0.2.0')

# Register sub-service routers
app.include_router(bot_engine_router)
app.include_router(ai_router)
app.include_router(media_router)
app.include_router(search_router)
app.include_router(analytics_router)


@app.on_event('startup')
def startup() -> None:
    create_db_and_tables()


@app.get('/healthz')
def healthz() -> dict[str, str]:
    return {'status': 'ok', 'service': settings.app_name}


@app.get('/v1/rtc/ice-servers', response_model=IceConfigResponse, dependencies=[Depends(require_internal_api_key)])
def get_ice_servers() -> IceConfigResponse:
    if settings.turn_urls:
        urls = [u.strip() for u in settings.turn_urls.split(',') if u.strip()]
        return IceConfigResponse(
            ice_servers=[
                IceServer(urls=urls, username=settings.turn_username, credential=settings.turn_credential),
            ],
        )

    return IceConfigResponse(ice_servers=[IceServer(urls=[settings.default_stun_url])])


@app.put('/v1/keys/public', response_model=PublicKeyResponse, dependencies=[Depends(require_internal_api_key)])
def upsert_public_key(payload: PublicKeyUpsert, session: Session = Depends(get_session)) -> PublicKeyResponse:
    record = session.exec(select(PublicKey).where(PublicKey.user_id == payload.user_id)).first()
    now = datetime.now(timezone.utc)

    if record is None:
        record = PublicKey(
            user_id=payload.user_id,
            algorithm=payload.algorithm,
            public_key=payload.public_key,
            created_at=now,
            updated_at=now,
        )
        session.add(record)
    else:
        record.algorithm = payload.algorithm
        record.public_key = payload.public_key
        record.updated_at = now

    session.commit()
    session.refresh(record)
    return PublicKeyResponse(
        user_id=record.user_id,
        algorithm=record.algorithm,
        public_key=record.public_key,
        updated_at=record.updated_at,
    )


@app.get('/v1/keys/public/{user_id}', response_model=PublicKeyResponse, dependencies=[Depends(require_internal_api_key)])
def get_public_key(user_id: str, session: Session = Depends(get_session)) -> PublicKeyResponse:
    record = session.exec(select(PublicKey).where(PublicKey.user_id == user_id)).first()
    if record is None:
        raise HTTPException(status_code=404, detail='Public key not found')

    return PublicKeyResponse(
        user_id=record.user_id,
        algorithm=record.algorithm,
        public_key=record.public_key,
        updated_at=record.updated_at,
    )


@app.post('/v1/rooms', dependencies=[Depends(require_internal_api_key)])
def create_room(payload: CreateRoomRequest, session: Session = Depends(get_session)) -> dict[str, str | int]:
    members = sorted(set(payload.member_ids))
    if len(members) < 2:
        raise HTTPException(status_code=400, detail='room needs at least 2 members')

    for member_id in members:
        exists = session.exec(
            select(RoomMember).where(RoomMember.room_id == payload.room_id).where(RoomMember.user_id == member_id),
        ).first()
        if exists is None:
            session.add(RoomMember(room_id=payload.room_id, user_id=member_id))

    session.commit()
    return {'room_id': payload.room_id, 'member_count': len(members)}


@app.get('/v1/rooms/{room_id}/authorize/{user_id}', dependencies=[Depends(require_internal_api_key)])
def authorize_room(room_id: str, user_id: str, session: Session = Depends(get_session)) -> dict[str, bool]:
    exists = session.exec(
        select(RoomMember).where(RoomMember.room_id == room_id).where(RoomMember.user_id == user_id),
    ).first()
    return {'authorized': exists is not None}


@app.get('/v1/rooms/{room_id}/members', response_model=RoomMembersResponse, dependencies=[Depends(require_internal_api_key)])
def list_room_members(room_id: str, session: Session = Depends(get_session)) -> RoomMembersResponse:
    members = session.exec(select(RoomMember.user_id).where(RoomMember.room_id == room_id)).all()
    return RoomMembersResponse(room_id=room_id, member_ids=sorted(members))


@app.post('/v1/presence', dependencies=[Depends(require_internal_api_key)])
def update_presence(payload: PresenceUpdate, session: Session = Depends(get_session)) -> dict[str, str]:
    record = session.exec(select(Presence).where(Presence.user_id == payload.user_id)).first()
    now = datetime.now(timezone.utc)

    if record is None:
        session.add(Presence(user_id=payload.user_id, status=payload.status, updated_at=now))
    else:
        record.status = payload.status
        record.updated_at = now

    session.commit()
    return {'user_id': payload.user_id, 'status': payload.status}


@app.post('/v1/messages/encrypted', response_model=EncryptedMessageOut, dependencies=[Depends(require_internal_api_key)])
def store_encrypted_message(payload: EncryptedMessageIn, session: Session = Depends(get_session)) -> EncryptedMessageOut:
    authorized = session.exec(
        select(RoomMember).where(RoomMember.room_id == payload.room_id).where(RoomMember.user_id == payload.sender_id),
    ).first()
    if authorized is None:
        raise HTTPException(status_code=403, detail='sender is not a room member')

    message = EncryptedMessage(
        message_id=str(uuid4()),
        room_id=payload.room_id,
        sender_id=payload.sender_id,
        client_msg_id=payload.client_msg_id,
        ciphertext=payload.ciphertext,
        iv=payload.iv,
        auth_tag=payload.auth_tag,
        key_envelope=payload.key_envelope,
        media_json=json.dumps([item.model_dump() for item in payload.media]),
    )

    session.add(message)
    session.commit()
    session.refresh(message)

    return EncryptedMessageOut(message_id=message.message_id, created_at=message.created_at)


@app.get('/v1/messages/encrypted/{room_id}', response_model=EncryptedMessageListResponse, dependencies=[Depends(require_internal_api_key)])
def list_encrypted_messages(
    room_id: str,
    user_id: str = Query(min_length=1, max_length=128),
    cursor: datetime | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    session: Session = Depends(get_session),
) -> EncryptedMessageListResponse:
    authorized = session.exec(
        select(RoomMember).where(RoomMember.room_id == room_id).where(RoomMember.user_id == user_id),
    ).first()
    if authorized is None:
        raise HTTPException(status_code=403, detail='user is not a room member')

    query = select(EncryptedMessage).where(EncryptedMessage.room_id == room_id)
    if cursor is not None:
        query = query.where(EncryptedMessage.created_at < cursor)

    rows = session.exec(query.order_by(EncryptedMessage.created_at.desc()).limit(limit)).all()  # type: ignore[union-attr]

    items: list[EncryptedMessageRecord] = []
    for row in rows:
        media = json.loads(row.media_json) if row.media_json else []
        items.append(
            EncryptedMessageRecord(
                message_id=row.message_id,
                room_id=row.room_id,
                sender_id=row.sender_id,
                client_msg_id=row.client_msg_id,
                ciphertext=row.ciphertext,
                iv=row.iv,
                auth_tag=row.auth_tag,
                key_envelope=row.key_envelope,
                media=media,
                created_at=row.created_at,
            ),
        )

    next_cursor = rows[-1].created_at.isoformat() if len(rows) == limit and rows else None
    return EncryptedMessageListResponse(items=items, next_cursor=next_cursor)


@app.post('/v1/ai/smart-reply', response_model=SmartReplyResponse, dependencies=[Depends(require_internal_api_key)])
def smart_reply(payload: SmartReplyRequest) -> SmartReplyResponse:
    last_message = payload.messages[-1].lower() if payload.messages else ''
    tone = payload.tone.lower()

    if any(keyword in last_message for keyword in ['when', 'eta', 'time']):
        suggestions = ['I can share an ETA in a moment.', 'Expected completion is in about 15 minutes.']
    elif any(keyword in last_message for keyword in ['thanks', 'thank you']):
        suggestions = ['You are welcome.', 'Happy to help.']
    elif any(keyword in last_message for keyword in ['call', 'meet', 'sync']):
        suggestions = ['Starting a call now.', 'I am available to sync in 5 minutes.']
    else:
        suggestions = ['Got it. I will follow up shortly.', 'Understood. Let me verify and get back to you.']

    if tone == 'friendly':
        suggestions = [f'{s} :)' for s in suggestions]

    return SmartReplyResponse(suggestions=suggestions)


@app.post('/v1/ai/voice-to-text', response_model=VoiceToTextResponse, dependencies=[Depends(require_internal_api_key)])
def voice_to_text(payload: VoiceToTextRequest) -> VoiceToTextResponse:
    if payload.transcript_hint:
        return VoiceToTextResponse(transcript=payload.transcript_hint.strip(), provider='hint')

    if payload.audio_base64:
        return VoiceToTextResponse(
            transcript='Audio received. Integrate Whisper/faster-whisper worker for full transcription.',
            provider='stub',
        )

    return VoiceToTextResponse(transcript='', provider='none')
