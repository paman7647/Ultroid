# Real-Time Communication API Contract

> Complete WebSocket and REST API reference for QWeb's communication platform.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Authentication](#authentication)
3. [REST API Endpoints](#rest-api-endpoints)
4. [WebSocket Namespaces](#websocket-namespaces)
5. [Database Schema](#database-schema-new-models)
6. [Infrastructure](#infrastructure)
7. [WebRTC Flow](#webrtc-flow)

---

## Architecture Overview

```text
┌──────────────┐    ┌───────────────┐    ┌──────────────┐
│   Next.js    │────│   NestJS API  │────│  PostgreSQL  │
│   Frontend   │    │   (Port 4000) │    │              │
│  (Port 3000) │    ├───────────────┤    └──────────────┘
│              │    │  /chat   WS   │
│              │────│  /calls  WS   │────┌──────────────┐
│              │    │  /voice  WS   │    │    Redis     │
│              │    │  /presence WS │    │  (Presence,  │
│              │    └───────────────┘    │  PubSub, IO) │
│              │                         └──────────────┘
│              │    ┌───────────────┐
│              │────│  Signaling    │    ┌──────────────┐
│              │    │  (Port 4100)  │    │   LiveKit    │
│              │    └───────────────┘    │  SFU Server  │
│              │                         │  (Port 7880) │
└──────────────┘    ┌───────────────┐    └──────────────┘
                    │    Worker     │
                    │  (BullMQ)    │────┌──────────────┐
                    │  - malware   │    │ MinIO (S3)   │
                    │  - media     │    └──────────────┘
                    │  - notifs    │
                    └───────────────┘    ┌──────────────┐
                                         │   coturn     │
                                         │ TURN Server  │
                                         └──────────────┘
```

---

## Authentication

All WebSocket connections require a JWT token:

```typescript
// Socket.IO connection with auth
const socket = io('http://localhost:4000/chat', {
  auth: { token: 'Bearer <jwt>' },
  transports: ['websocket', 'polling'],
});
```

REST endpoints require `Authorization: Bearer <jwt>` header.

---

## REST API Endpoints

### Calls

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/v1/calls` | Initiate a new call |
| `POST` | `/v1/calls/:callId/answer` | Answer an incoming call |
| `POST` | `/v1/calls/:callId/reject` | Reject an incoming call |
| `POST` | `/v1/calls/:callId/end` | End a call |
| `POST` | `/v1/calls/:callId/leave` | Leave a call |
| `POST` | `/v1/calls/:callId/mute` | Toggle mute |
| `POST` | `/v1/calls/:callId/video` | Toggle video |
| `POST` | `/v1/calls/:callId/screen-share` | Toggle screen share |
| `POST` | `/v1/calls/:callId/hand-raise` | Toggle hand raise |
| `GET` | `/v1/calls/history` | Get call history |
| `GET` | `/v1/calls/:callId` | Get call details |
| `GET` | `/v1/calls/room/:roomId/active` | Get active call in room |

### Voice Rooms

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/v1/voice-rooms` | Create a voice room |
| `PATCH` | `/v1/voice-rooms/:id` | Update voice room |
| `DELETE` | `/v1/voice-rooms/:id` | Delete voice room |
| `POST` | `/v1/voice-rooms/:id/join` | Join voice room |
| `POST` | `/v1/voice-rooms/:id/leave` | Leave voice room |
| `POST` | `/v1/voice-rooms/:id/mute` | Toggle mute |
| `POST` | `/v1/voice-rooms/:id/deafen` | Toggle deafen |
| `GET` | `/v1/voice-rooms` | List voice rooms (query: `?roomId=`) |
| `GET` | `/v1/voice-rooms/me` | Get current voice room |
| `GET` | `/v1/voice-rooms/:id` | Get voice room details |

### Encryption

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/v1/encryption/keys` | Publish identity key |
| `POST` | `/v1/encryption/keys/prekeys` | Upload pre-keys |
| `GET` | `/v1/encryption/keys/:userId/bundle` | Fetch key bundle |
| `GET` | `/v1/encryption/keys/prekey-count` | Get remaining pre-key count |
| `GET` | `/v1/encryption/keys/:userId/devices` | List device keys |
| `POST` | `/v1/encryption/sessions` | Create/update session |
| `GET` | `/v1/encryption/sessions/:peerUserId` | Get session state |

### Media

| Method | Path | Description |
| -------- | ------ | ------------- |
| `POST` | `/v1/media/token` | Get LiveKit/SFU token |
| `GET` | `/v1/media/ice-servers` | Get ICE/TURN configuration |

---

## WebSocket Namespaces

### `/chat` — Chat Gateway (Port 4000)

**Client → Server Events:**

| Event | Payload | Description |
| ------- | --------- | ------------- |
| `room:join` | `{ roomId }` | Join a chat room |
| `room:leave` | `{ roomId }` | Leave a chat room |
| `message:send` | `{ roomId, text?, kind?, attachmentIds?, replyToId?, clientMsgId? }` | Send message |
| `message:edit` | `{ roomId, messageId, text }` | Edit message |
| `message:delete` | `{ roomId, messageId }` | Delete message |
| `message:forward` | `{ roomId, messageId, targetRoomId }` | Forward message |
| `message:read` | `{ roomId, messageId }` | Mark message read |
| `room:read-all` | `{ roomId }` | Mark all read |
| `reaction:add` | `{ roomId, messageId, emoji }` | Add reaction |
| `reaction:remove` | `{ roomId, messageId, emoji }` | Remove reaction |
| `message:star` | `{ roomId, messageId }` | Star message |
| `message:unstar` | `{ roomId, messageId }` | Unstar message |
| `typing:start` | `{ roomId }` | Start typing indicator |
| `typing:stop` | `{ roomId }` | Stop typing indicator |

**Server → Client Events:**

| Event | Payload | Description |
| ------- | --------- | ------------- |
| `message:new` | Message object | New message in room |
| `message:edited` | `{ roomId, message }` | Message was edited |
| `message:deleted` | `{ roomId, messageId }` | Message was deleted |
| `message:read` | `{ roomId, messageId, userId, readAt }` | Read receipt |
| `reaction:updated` | Reaction state | Reaction changed |
| `typing:update` | `{ roomId, userId, typing }` | Typing indicator |
| `presence:update` | `{ userId, status, lastSeenAt }` | User presence changed |

---

### `/calls` — Calls Gateway (Port 4000)

**Client → Server Events:**

| Event | Payload | Description |
| ------- | --------- | ------------- |
| `call:initiate` | `{ roomId, type: 'voice'│'video' }` | Start a call |
| `call:answer` | `{ callId }` | Answer incoming call |
| `call:reject` | `{ callId }` | Reject incoming call |
| `call:end` | `{ callId }` | End the call |
| `call:leave` | `{ callId }` | Leave (don't end for others) |
| `call:toggle-mute` | `{ callId }` | Toggle mute state |
| `call:toggle-video` | `{ callId }` | Toggle video state |
| `call:toggle-screen-share` | `{ callId }` | Toggle screen sharing |
| `call:toggle-hand-raise` | `{ callId }` | Toggle hand raise |
| `call:reaction` | `{ callId, emoji }` | Send call reaction |
| `webrtc:offer` | `{ callId, targetUserId, sdp, type }` | WebRTC offer |
| `webrtc:answer` | `{ callId, targetUserId, sdp, type }` | WebRTC answer |
| `webrtc:ice-candidate` | `{ callId, targetUserId, candidate }` | ICE candidate |

**Server → Client Events:**

| Event | Payload | Description |
| ------- | --------- | ------------- |
| `call:incoming` | `{ callId, roomId, callerId, type }` | Incoming call |
| `call:participant-joined` | `{ callId, participant }` | User joined call |
| `call:participant-rejected` | `{ callId, userId }` | User rejected call |
| `call:participant-left` | `{ callId, userId }` | User left call |
| `call:participant-updated` | `{ callId, userId, ... }` | Participant state change |
| `call:ended` | `{ callId }` | Call ended |
| `call:reaction` | `{ callId, userId, emoji }` | Call reaction |

---

### `/voice` — Voice Rooms Gateway (Port 4000)

**Client → Server Events:**

| Event | Payload | Description |
| ------- | --------- | ------------- |
| `voice:join` | `{ voiceRoomId }` | Join voice room |
| `voice:leave` | `{ voiceRoomId }` | Leave voice room |
| `voice:mute` | `{ voiceRoomId }` | Toggle mute |
| `voice:deafen` | `{ voiceRoomId }` | Toggle deafen |
| `voice:speaking` | `{ voiceRoomId, speaking }` | Speaking state |
| `voice:webrtc:offer` | `{ voiceRoomId, targetUserId, sdp, type }` | WebRTC offer |
| `voice:webrtc:answer` | `{ voiceRoomId, targetUserId, sdp, type }` | WebRTC answer |
| `voice:webrtc:ice-candidate` | `{ voiceRoomId, targetUserId, candidate }` | ICE candidate |

**Server → Client Events:**

| Event | Payload | Description |
| ------- | --------- | ------------- |
| `voice:joined` | VoiceRoomState | Successfully joined |
| `voice:member-joined` | `{ voiceRoomId, member }` | User joined room |
| `voice:member-left` | `{ voiceRoomId, userId }` | User left room |
| `voice:member-updated` | `{ voiceRoomId, userId, ... }` | Member state change |
| `voice:speaking` | `{ voiceRoomId, userId, speaking }` | Speaking indicator |

---

### `/presence` — Presence Gateway (Port 4000)

**Client → Server Events:**

| Event | Payload | Description |
| ------- | --------- | ------------- |
| `presence:heartbeat` | — | Keep-alive ping |
| `presence:set-status` | `{ status: 'online'│'away'│'dnd' }` | Set status |
| `presence:get` | `{ userIds: string[] }` | Get bulk presence |
| `presence:room` | `{ roomId }` | Get room member presence |

**Server → Client Events:**

| Event | Payload | Description |
| ------- | --------- | ------------- |
| `presence:update` | `{ userId, status, at }` | Presence changed |
| `presence:state` | `{ [userId]: Presence }` | Bulk presence response |
| `presence:room:state` | `{ roomId, presences }` | Room presence response |

---

## Database Schema (New Models)

### Call

```text
id, roomId, initiatorId, type (VOICE/VIDEO/GROUP_VOICE/GROUP_VIDEO),
status (RINGING/ACTIVE/ENDED/MISSED/DECLINED/FAILED),
startedAt, endedAt, durationSecs, recordingUrl, maxParticipants,
createdAt, updatedAt
```

### CallParticipant

```text
id, callId, userId, status (INVITED/CONNECTING/JOINED/LEFT/DECLINED/MISSED),
joinedAt, leftAt, isMuted, isVideoOff, isScreenSharing, isHandRaised
```

### VoiceRoom

```text
id, roomId, name, type (OPEN/STAGE/PRIVATE),
maxParticipants, isActive, createdById, createdAt, updatedAt
```

### VoiceRoomMember

```text
id, voiceRoomId, userId, isMuted, isDeafened, isSpeaking,
joinedAt, updatedAt
```

### EncryptionKey

```text
id, userId, deviceId, algorithm (X25519/RSA_OAEP_4096/P256_ECDH/AES_256_GCM),
type (IDENTITY/SIGNED_PRE_KEY/ONE_TIME_PRE_KEY),
publicKey, isConsumed, expiresAt, createdAt
```

### EncryptionSession

```text
id, initiatorId, recipientId, initiatorDeviceId, recipientDeviceId,
sessionState, rootKey, chainKey, messageNumber,
createdAt, updatedAt
```

### MediaSession

```text
id, callId, participantId, mediaType, sdpOffer, sdpAnswer,
status (PENDING/ACTIVE/CLOSED/FAILED),
startedAt, endedAt, createdAt
```

### MessageThread

```text
id, roomId, rootMessageId, lastActivityAt, messageCount,
createdAt, updatedAt
```

---

## Infrastructure

### Docker Compose Services

| Service | Image | Port | Purpose |
| --------- | ------- | ------ | --------- |
| postgres | postgres:16-alpine | 5432 | Primary database |
| redis | redis:7-alpine | 6379 | Presence, pub/sub, Socket.IO adapter, BullMQ |
| minio | minio/minio | 9000/9001 | S3-compatible file storage |
| clamav | docker-clamav:alpine | 3310 | Malware scanning |
| livekit | livekit/livekit-server:v1.8 | 7880/7881/7882 | WebRTC SFU media server |
| coturn | coturn/coturn:4.6 | 3478 | TURN/STUN NAT traversal |
| otel-collector | otel-collector-contrib | 4317/4318 | Telemetry collection |
| prometheus | prom/prometheus | 9090 | Metrics |
| grafana | grafana/grafana | 3001 | Dashboards |

### Environment Variables (New)

```env
# LiveKit SFU
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
LIVEKIT_HOST=http://livekit:7880
LIVEKIT_WS_URL=ws://localhost:7880

# TURN Server
TURN_URL=turn:localhost:3478
TURN_USERNAME=qweb
TURN_CREDENTIAL=qweb_turn_secret

# Redis (existing, now also used for Socket.IO adapter)
REDIS_URL=redis://redis:6379
```

### Worker Queues

| Queue | Job Types | Description |
| ------- | ----------- | ------------- |
| `malware-scan` | `scan-object` | ClamAV virus scanning of uploads |
| `media-processing` | `call-recording-finalize`, `generate-thumbnail` | Media post-processing |
| `notifications` | `missed-call`, `push-notification` | Notification delivery |

---

## WebRTC Flow

### P2P Call (≤4 participants, no LiveKit)

```text
Caller                Signaling             Callee
  │                      │                     │
  │─── call:initiate ───►│                     │
  │                      │──── call:incoming──►│
  │                      │                     │
  │                      │◄── call:answer ─────│
  │◄─ participant:joined─│                     │
  │                      │                     │
  │─── webrtc:offer ────►│                     │
  │                      │──── webrtc:offer ──►│
  │                      │                     │
  │                      │◄── webrtc:answer ──│
  │◄── webrtc:answer ────│                     │
  │                      │                     │
  │◄──── ICE candidates exchanged ───────────►│
  │                      │                     │
  │═══════ P2P Media Stream ═════════════════►│
```

### SFU Call (LiveKit, ≥5 participants)

```text
Participant        API Server         LiveKit SFU
    │                  │                   │
    │── POST /media/token ►│               │
    │◄── { token, wsUrl } ─│               │
    │                      │               │
    │──── Connect to LiveKit via wsUrl ──►│
    │◄═══════ Media Streams ═════════════►│
```
