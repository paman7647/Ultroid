# QWeb Architecture Reference

> **Version**: 3.0 — Production-hardened for horizontal scaling to millions of concurrent users.

---

## 1  High-Level Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                        Clients                              │
│      Next.js SPA  ·  React Native  ·  Desktop (Electron)   │
└────────────┬────────────────────────────────┬───────────────┘
             │ HTTPS / WSS                    │ WSS
             ▼                                ▼
┌────────────────────────┐     ┌───────────────────────────┐
│   NestJS API  :4000    │     │  Signaling Server  :4100  │
│  REST + Socket.IO      │     │  Socket.IO + Zod          │
│  16 modules            │     │  WebRTC signaling          │
└────┬──────┬──────┬─────┘     └────────────┬──────────────┘
     │      │      │                        │
     │      │      │  ┌─────────────────────┘
     ▼      ▼      ▼  ▼
┌─────────────────────────────────────────────────────────────┐
│                    Infrastructure                           │
│  PostgreSQL 16  ·  Redis 7  ·  MinIO  ·  ClamAV            │
│  LiveKit SFU    ·  Coturn TURN  ·  OTel + Prometheus        │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP (internal)
                         ▼
              ┌──────────────────────┐
              │  Python FastAPI :8000│
              │  AI · Media · Search │
              │  Bot Engine · Stats  │
              └──────────────────────┘
```

---

## 2  Service Inventory

| Service | Port | Tech | Purpose |
| --------- | ------ | ------ | --------- |
| **api** | 4000 | NestJS 11 | REST API, WebSocket hub (5 namespaces), auth, business logic, sharding, connection tracking |
| **worker** | — | NestJS (BullMQ) | Background jobs: malware scan, media processing, notifications, search indexing, AI tasks |
| **signaling** | 4100 | Node.js + Socket.IO | WebRTC signaling with Zod validation, token-bucket rate limiting |
| **ai-python** | 8000 | FastAPI 0.116 | AI/ML processing, media transcoding, bot engine, search, analytics |
| **web** | 3000 | Next.js | Server-rendered React frontend |
| **music-bot** | — | Node.js | Reference bot implementation |
| **postgres** | 5432 | PostgreSQL 16 | Primary relational store — 32 Prisma models |
| **redis** | 6379 | Redis 7 | Streams, BullMQ, pub/sub (Socket.IO adapter), cache, presence |
| **minio** | 9000 | MinIO | S3-compatible object storage for uploads |
| **clamav** | 3310 | ClamAV | Malware scanning for uploaded files |
| **livekit** | 7880 | LiveKit v1.8 | SFU for voice/video calls |
| **coturn** | 3478 | Coturn 4.6 | TURN/STUN for NAT traversal |
| **otel-collector** | 4317 | OTel Collector | Trace and metric ingestion |
| **prometheus** | 9090 | Prometheus | Metrics storage and alerting |
| **grafana** | 3001 | Grafana | Dashboards and visualization |

---

## 3  Database Schema (Prisma — 32+ models)

### Core Entities

- **User** — profiles, roles (`USER | MODERATOR | ADMIN`), bot flags, MFA fields
- **Room** — `DM | GROUP | CHANNEL`, metadata, pinned messages
- **RoomMembership** — join/leave, roles (`OWNER | ADMIN | MEMBER`), mute state
- **Message** — text, kind (`TEXT | IMAGE | FILE | AUDIO | VIDEO | SYSTEM | BOT`), threads, reactions, edits
- **Attachment** — S3 key/URL, MIME, size, malware scan status
- **RoomInvite** — shareable invite links with expiry/max-uses

### Auth & Sessions

- **Session** — device fingerprint, IP, last activity, revocable
- **Device** — multi-device tracking, passkey credentials, trust status
- **RefreshToken** — rotating refresh tokens with family tracking
- **AuditLog** — action log for login, logout, password changes, device changes

### Communication

- **Call / CallParticipant** — 1:1 and group calls with LiveKit integration
- **VoiceRoom / VoiceRoomMember** — persistent voice channels
- **VoiceStream / MusicQueueItem** — voice streaming and music bot queue
- **EncryptionKey / EncryptionSession** — E2E encryption key exchange
- **MediaSession** — WebRTC media sessions

### Bot Ecosystem

- **BotToken** — API tokens with scope-based permissions
- **BotCommand** — registered slash/prefix commands per room
- **BotPlugin** — modular bot plugins with config
- **BotMarketplaceListing / BotReview / BotInstallation** — marketplace

### Enums

`Role`, `RoomType`, `MessageKind`, `MemberRole`, `ScanStatus`, `CallType`, `VoiceRoomType`, `KeyAlgorithm`, `BotScope`, `BotPluginType`, `ListingStatus`, `VoiceStreamStatus`

---

## 4  API Modules (NestJS)

| Module | Key Endpoints | WebSocket |
| -------- | -------------- | ----------- |
| **AuthModule** | `/v1/auth/register`, `/login`, `/refresh`, `/passkey/*`, `/qr/*`, `/devices`, `/sessions` | — |
| **UsersModule** | `/v1/users/me`, `/users/:id`, `/users/search` | — |
| **ChatModule** | `/v1/rooms`, `/rooms/:id/messages`, `/rooms/:id/members` | `/chat` namespace |
| **UploadsModule** | `/v1/uploads`, `/uploads/:id` | — |
| **CallsModule** | `/v1/calls` | `/calls` namespace |
| **VoiceRoomsModule** | `/v1/voice-rooms` | `/voice` namespace |
| **EncryptionModule** | `/v1/encryption/keys`, `/sessions` | — |
| **PresenceModule** | — | `/presence` namespace |
| **MediaModule** | `/v1/media/token` | — |
| **BotsModule** | `/v1/bot-api/*`, `/v1/bots/*` | `/bots` namespace |
| **SearchModule** | `/v1/search`, `/v1/search/stats` | — |
| **QueueModule** (global) | `/v1/notifications` | — |
| **HealthModule** | `/v1/health`, `/v1/health/live`, `/v1/health/deps`, `/v1/health/metrics` | — |

---

## 5  WebSocket Namespaces

| Namespace | Events (Client → Server) | Events (Server → Client) |
| ----------- | ------------------------- | ------------------------- |
| `/chat` | `message:send`, `message:edit`, `message:delete`, `message:react`, `typing:start`, `typing:stop`, `room:join`, `room:leave` | `message:new`, `message:updated`, `message:deleted`, `message:batch`, `typing`, `room:updated` |
| `/calls` | `call:initiate`, `call:join`, `call:leave`, `call:signal` | `call:incoming`, `call:joined`, `call:ended`, `call:signal` |
| `/voice` | `voice:join`, `voice:leave`, `voice:mute`, `voice:stream` | `voice:state`, `voice:member-joined`, `voice:member-left` |
| `/presence` | `presence:update` | `presence:changed`, `presence:bulk` |
| `/bots` | `bot:event` | `bot:response`, `bot:status` |

---

## 6  Message Queue Architecture

### Redis Streams (Event Bus)

Real-time event distribution with consumer groups:

- `events:messages` — message create/edit/delete events
- `events:notifications` — push notification dispatch
- `events:analytics` — usage tracking events

### BullMQ Job Queues

Durable background processing with retries and backoff:

| Queue | Purpose | Concurrency |
| ------- | --------- | ------------- |
| `malware-scan` | ClamAV file scanning | 2 |
| `message-processing` | AI moderation, search indexing | 5 |
| `bot-events` | Bot event dispatch | 10 |
| `ai-tasks` | Spam check, content analysis | 3 |
| `media-processing` | Image/video/audio transcoding | 2 |
| `notifications` | Push notification delivery | 10 |
| `search-index` | Full-text index updates | 5 |

---

## 7  Python FastAPI Services

All services run in a single FastAPI process on port 8000, communicating with the NestJS API via internal HTTP and Redis Streams.

### Routers

| Router | Prefix | Capabilities |
| -------- | -------- | ------------- |
| **bot_engine** | `/v1/bots/` | Event dispatch via Redis Streams, command execution, worker heartbeat |
| **ai_service** | `/v1/ai/` | Spam detection (heuristic), content moderation (5 categories), sentiment analysis, smart replies, language detection — all local, no external APIs |
| **media_service** | `/v1/media/` | Image compression (Pillow), audio encoding (FFmpeg: opus/aac/mp3), video transcoding (h264/vp9/av1), voice-to-text (Whisper, optional) |
| **search_service** | `/v1/search/` | In-memory inverted index, tokenization, AND-query search, snippet generation |
| **analytics_service** | `/v1/analytics/` | Redis-backed counters (daily/hourly), time-series data, room stats, concurrent users |

---

## 8  Authentication & Security

### Auth Flow

1. **Registration**: bcrypt-12 password hash → session + device record → JWT pair
2. **Login**: credential verify → device fingerprint → rotating refresh token → access JWT (15min) + refresh JWT (14d)
3. **Passkey (WebAuthn)**: challenge-response with ES256/RS256, credential stored in Redis + Device table
4. **QR Login**: generate token → display QR → mobile scans → confirms with existing session → web client polls and receives tokens
5. **Token Rotation**: refresh tokens are single-use with family tracking; reuse triggers full family revocation

### Security Layers

- **CSRF**: double-submit cookie pattern
- **Rate Limiting**: `@nestjs/throttler` (120 req/min global), bot-specific sliding window, token-bucket on signaling
- **Helmet**: strict CSP, CORP, referrer policy
- **File Security**: ClamAV scan, extension allowlist, MIME validation, quarantine on threat
- **Input Validation**: class-validator (NestJS), Zod (signaling), Pydantic v2 (Python)
- **E2E Encryption**: Olm-compatible key exchange with per-session ratcheting

---

## 9  Performance & Scaling

### Horizontal Scaling

- **Consistent-Hash Sharding**: ShardingService distributes users/rooms across 16 shards via MD5 hashing; each API instance owns a subset via Redis registry
- **Distributed Connection Tracking**: ConnectionManagerService tracks per-instance WebSocket counts in Redis sorted sets; enables load-aware routing
- **WebSocket Sharding**: Redis IO adapter (`@socket.io/redis-adapter`) broadcasts events across multiple API instances
- **Stateless API**: JWT auth, no server-side session store (Redis-backed device/session metadata only)
- **Worker Pool**: BullMQ workers can run on any number of instances concurrently (7 queue types)

### Caching

- **CacheService**: Redis-backed with 5min default TTL, domain helpers for room members (120s) and user profiles (10min)
- **Presence**: Redis TTL-based (300s) with heartbeat renewal

### Message Batching

- **MessageBatcher**: Accumulates WebSocket events per room over 50ms intervals, emits as `message:batch` array to reduce Redis adapter publish overhead in high-throughput rooms

### Database

- **Cursor-based Pagination**: all list endpoints use Prisma cursor pagination (no offset)
- **Connection Pooling**: Prisma connection pool with configurable limits via `DATABASE_URL` params

---

## 10  Observability

| Component | Purpose |
| ----------- | --------- |
| OpenTelemetry SDK | Distributed traces from NestJS |
| OTel Collector | Receives and exports traces/metrics |
| Prometheus | Time-series metrics storage |
| Grafana | Dashboards, alerting |
| Pino (nestjs-pino) | Structured JSON logging with PII redaction |
| BullMQ Dashboard | Queue depth, failure rates, processing times |

---

## 11  Docker Compose Topology

```text
docker-compose.yml  (15 services)
├── postgres:16-alpine          (healthcheck: pg_isready)
├── redis:7-alpine              (healthcheck: redis-cli ping, 512MB LRU)
├── minio                       (S3-compatible object store)
├── clamav                      (malware scanning)
├── otel-collector              (trace ingestion)
├── prometheus                  (metrics)
├── grafana                     (dashboards)
├── api                         (NestJS, depends: postgres✓ redis✓ minio clamav ai-python✓)
├── worker                      (BullMQ, depends: postgres✓ redis✓ minio clamav ai-python✓)
├── signaling                   (Socket.IO, depends: redis✓)
├── ai-python                   (FastAPI, depends: redis✓, healthcheck: /health)
├── livekit                     (SFU, depends: redis)
├── coturn                      (TURN, host network)
├── web                         (Next.js, depends: api)
└── music-bot                   (reference bot, depends: api redis)
```

---

## 12  Project Layout

```text
qweb/
├── apps/
│   ├── api/             NestJS API (15 modules)
│   │   └── src/
│   │       ├── auth/          JWT, passkeys, QR login, devices
│   │       ├── bots/          Bot ecosystem (events, commands, gateway, marketplace)
│   │       ├── calls/         1:1 and group calls
│   │       ├── chat/          Rooms, messages, threads, reactions
│   │       ├── common/        Guards, decorators, adapters, cache, batcher, sharding, connection tracking, circuit breaker
│   │       ├── encryption/    E2E encryption key exchange
│   │       ├── health/        Readiness/liveness probes, metrics endpoint
│   │       ├── media/         LiveKit token generation
│   │       ├── presence/      Online status with Redis TTL
│   │       ├── queue/         EventBus, MessageQueue, Notifications
│   │       ├── search/        Search proxy to Python service
│   │       ├── uploads/       File upload with ClamAV pipeline
│   │       ├── users/         User profiles, search
│   │       └── voice-rooms/   Persistent voice channels
│   ├── signaling/       WebRTC signaling server
│   ├── web/             Next.js frontend
│   └── worker/          BullMQ job workers (7 queues)
├── packages/
│   ├── config/          Shared configuration
│   ├── contracts/       Shared TypeScript types
│   └── ui/              Shared React components
├── prisma/
│   ├── schema.prisma    32 models, 12 enums
│   ├── seed.ts          Development seeding
│   └── migrations/      Database migrations
├── services/
│   ├── ai-python/       FastAPI service (5 routers)
│   └── music-bot/       Reference bot implementation
├── infra/
│   ├── docker/          Docker Compose + configs
│   └── terraform/       Infrastructure as Code
├── docs/                Architecture, API contracts, design system
└── scripts/             Utility scripts
```

---

## 13  Environment Variables

| Variable | Service | Purpose |
| ---------- | --------- | --------- |
| `DATABASE_URL` | api, worker | PostgreSQL connection string |
| `REDIS_URL` | api, worker, signaling, ai-python, livekit | Redis connection |
| `PYTHON_SERVICE_URL` | api, worker | FastAPI endpoint (`http://ai-python:8000`) |
| `PYTHON_INTERNAL_API_KEY` | api, ai-python | Internal service auth |
| `JWT_SECRET` | api, signaling | Token signing |
| `S3_ENDPOINT`, `S3_KEY`, `S3_SECRET` | api, worker | MinIO credentials |
| `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | api | LiveKit auth |
| `CORS_ORIGIN` | api, signaling | Allowed origins |
| `MUSIC_BOT_TOKEN` | music-bot | Bot authentication |
| `CLAMAV_HOST`, `CLAMAV_PORT` | api | ClamAV connection |

---

## 14  Production Scaling Architecture

### Consistent-Hash Sharding

```text
                     ┌──────────────────┐
                     │   Load Balancer  │
                     └────┬────┬────┬───┘
                          │    │    │
               ┌──────────┘    │    └──────────┐
               ▼               ▼               ▼
         ┌──────────┐   ┌──────────┐   ┌──────────┐
         │  API-1   │   │  API-2   │   │  API-3   │
         │ Shards   │   │ Shards   │   │ Shards   │
         │ 0-5      │   │ 6-10     │   │ 11-15    │
         └────┬─────┘   └────┬─────┘   └────┬─────┘
              │              │              │
              └──────────────┼──────────────┘
                             ▼
         ┌───────────────────────────────────────┐
         │              Redis 7                  │
         │  IO Adapter · Streams · BullMQ        │
         │  Shard Registry · Connection Tracking │
         │  Cache (5min TTL) · Presence (300s)   │
         └───────────────────────────────────────┘
```

**ShardingService** uses MD5 consistent hashing with 16 configurable shards:

- `getShardId(key)` → `MD5(key) % SHARD_COUNT`
- `getUserShard(userId)` / `getRoomShard(roomId)` — routes users/rooms to deterministic shards
- `isOwnedShard()` — multi-instance shard ownership via Redis `shard:instances` registry (300s TTL)
- Enables partition-aware processing: each API instance only handles its owned shards

### Distributed Connection Tracking

**ConnectionManagerService** tracks WebSocket connections across all API instances:

- Redis sorted set `ws:connections` stores per-instance connection counts
- 10-second heartbeat cycle reports counts via `ZADD`
- `getTotalConnections()` — global WebSocket count across all instances
- `getConnectionDistribution()` — per-instance breakdown
- `getLeastLoadedInstance()` — load-aware routing for new connections
- Stale instances auto-expire after missed heartbeats

### WebSocket Scaling

- **Redis IO Adapter** (`@socket.io/redis-adapter`): broadcasts Socket.IO events across API instances
- **5 namespaces** (`/chat`, `/calls`, `/voice`, `/presence`, `/bots`): isolated event streams
- **MessageBatcher**: 50ms accumulation window reduces Redis pub/sub overhead in high-throughput rooms
- **Per-gateway connection tracking**: increment on connect, decrement on disconnect

---

## 15  Fault Tolerance

### Circuit Breaker Pattern

```text
  CLOSED ──(failure count ≥ threshold)──► OPEN
    ▲                                       │
    │                                       │ (resetTimeoutMs)
    │                                       ▼
    └──────(success)──── HALF_OPEN ◄────────┘
                           │
                      (failure)──► OPEN
```

**Implementation** (`circuit-breaker.ts`):

- States: `CLOSED` → `OPEN` (after 5 consecutive failures) → `HALF_OPEN` (after 30s)
- Applied to: SearchController (Python search proxy), extensible to any inter-service call
- Prevents cascading failures when downstream services are unavailable

### Worker Resilience

- BullMQ built-in retry with exponential backoff
- 7 queue workers with independent failure isolation
- Graceful shutdown: all workers `.close()` on process signals (SIGTERM, SIGINT)
- Dead letter queues for permanently failed jobs

### Database Resilience

- Prisma connection pool with automatic reconnection
- Slow query detection (>200ms) with structured logging
- Error event monitoring via `$on('error')` hook
- Environment-aware log levels (dev: query+info+warn+error, prod: warn+error)

---

## 16  Performance Benchmarks & Targets

### Scalability Targets (per API instance)

| Metric | Target | Mechanism |
| -------- | -------- | ----------- |
| WebSocket connections | 50,000 per instance | Redis IO adapter, connection tracking |
| Message throughput | 10,000 msg/s per instance | MessageBatcher (50ms window), BullMQ parallelism |
| Message latency (p50) | < 20ms | Direct Redis pub/sub, in-memory batching |
| Message latency (p99) | < 100ms | Connection-local processing, shard-aware routing |
| API response time (p95) | < 50ms | CacheService (5min TTL), cursor pagination |
| Database queries | < 5ms for indexed queries | Composite indexes on Message, RoomMembership |
| Search latency | < 200ms | Python in-memory inverted index + circuit breaker |
| File upload scan | < 10s | ClamAV streaming, async BullMQ worker |

### Horizontal Scaling Capacity

| Scale Point | Instances | Estimated Capacity |
| ------------- | ----------- | ------------------- |
| Small | 1 API, 1 Worker | ~50k connections, ~5k msg/s |
| Medium | 4 API, 2 Worker | ~200k connections, ~40k msg/s |
| Large | 16 API, 8 Worker | ~800k connections, ~160k msg/s |
| XL | 64 API, 32 Worker | ~3M connections, ~640k msg/s |

### Key Database Indexes

```sql
-- Message retrieval (most frequent query path)
@@index([roomId, createdAt])   -- room message history
@@index([senderId, createdAt]) -- user message history
@@index([roomId, senderId])    -- per-user per-room queries

-- Session/Device lookups
@@index([userId])              -- user sessions
@@unique([deviceId, userId])   -- device dedup
```

### Load Testing

Located at `scripts/load_test.py`:

```bash
# Quick smoke test (100 users, 30s)
python scripts/load_test.py --users 100 --duration 30

# Medium load (10k users, 60s)
python scripts/load_test.py --users 10000 --duration 60 --concurrent 2000

# Stress test (100k users, 120s)
python scripts/load_test.py --users 100000 --duration 120 --concurrent 5000
```

Measures: connections success/fail, messages sent/received/failed, throughput (msg/s), latency (avg, p50, p95, p99).

---

## 17  Security Hardening

### Fixes Applied (v3.0)

1. **Constant-time API key comparison**: `hmac.compare_digest()` in Python security middleware (prevents timing attacks)
2. **Environment validation**: All required env vars validated at startup via Zod schema (`CLAMAV_HOST`, `CLAMAV_PORT`, `PYTHON_SERVICE_URL`, `PYTHON_INTERNAL_API_KEY`)
3. **Rate limiter memory cap**: OrderedDict with 10,000-entry LRU eviction (prevents unbounded memory growth)
4. **Circuit breaker on inter-service calls**: Prevents cascading failure from Python service outages

### Security Layers (complete)

| Layer | Implementation |
| ------- | --------------- |
| Authentication | bcrypt-12, JWT RS256/HS256, WebAuthn passkeys, QR login |
| Authorization | Role-based (USER/MODERATOR/ADMIN), room-level (OWNER/ADMIN/MEMBER), bot scopes |
| Transport | HTTPS/WSS enforced, Helmet CSP, CORS allowlist |
| Input validation | class-validator (NestJS) + Zod (signaling) + Pydantic v2 (Python) |
| Rate limiting | @nestjs/throttler (120/min), sliding window (bots), token bucket (signaling) |
| File security | ClamAV scan, extension whitelist, MIME validation, quarantine |
| API key security | HMAC constant-time comparison, rotating tokens |
| CSRF | Double-submit cookie pattern |
| E2E encryption | Olm-compatible key exchange, per-session ratcheting |

---

## 18  CI/CD Pipeline

```yaml
GitHub Actions Workflow (.github/workflows/ci.yml)
├── build-test (Node.js 20, Redis 7 service container)
│   ├── npm ci
│   ├── npx prisma generate
│   ├── npm run lint
│   ├── npm run typecheck
│   ├── npm run test
│   ├── npm run build
│   └── npm audit --audit-level=moderate
├── python-ci (Python 3.12)
│   ├── pip install -r requirements
│   └── py_compile syntax check
└── docker-validate (depends: build-test)
    ├── docker build apps/api
    ├── docker build apps/worker
    └── docker build services/ai-python
```

---

## 19  Design Principles

1. **Zero external APIs**: All AI/ML is heuristic or local-model based. No OpenAI, no cloud APIs.
2. **Self-hosted everything**: Every dependency runs in Docker. No SaaS.
3. **Event-driven**: Redis Streams for cross-service communication, BullMQ for durable jobs.
4. **Horizontal scalability**: Stateless services, consistent-hash sharding, Redis IO adapter, distributed connection tracking.
5. **Security-first**: Input validation at every boundary, ClamAV scanning, E2E encryption, CSRF protection, rate limiting on all surfaces, constant-time comparisons.
6. **Open source only**: PostgreSQL, Redis, MinIO, LiveKit, Coturn, ClamAV, Grafana — no proprietary components.
7. **Fault tolerance**: Circuit breakers on all inter-service calls, graceful degradation, queue-based retry with backoff.
8. **Observable**: Structured logging (Pino), distributed traces (OTel), metrics (Prometheus), dashboards (Grafana), health endpoints with metrics.

---

## 20  Production Hardening Changelog (v3.0)

### Bugs Fixed

| # | File | Issue | Fix |
| --- | ------ | ------- | ----- |
| 1 | `event-bus.service.ts` | `xadd` returns `string \| null`, strict mode rejects | Added `?? ''` null coalescing |
| 2 | `notification.service.ts` | Unchecked array index access (2 locations) | Added guard clause + conditional push |
| 3 | `message-batcher.ts` | `items[0]` possibly undefined under `noUncheckedIndexedAccess` | Used `const first = items[0]!` with destructure |
| 4 | `worker/main.ts` | Notification worker created per-recipient system messages | Single system message with roomId guard |
| 5 | `worker/main.ts` | `finalStatus` always evaluated to `'STOPPED'` (dead branch) | Removed variable, inlined value |

### Security Fixes

| # | File | Issue | Fix |
| --- | ------ | ------- | ----- |
| 1 | `security.py` | Plain string `!=` for API key (timing attack) | `hmac.compare_digest()` constant-time comparison |
| 2 | `env.ts` | Missing validation for CLAMAV and Python service vars | Added Zod schema entries with defaults |
| 3 | `ai_service.py` | Unbounded `_message_timestamps` dict (memory leak) | OrderedDict with 10k-entry LRU cap |

### New Infrastructure

| Component | File(s) | Purpose |
| ----------- | --------- | --------- |
| ShardingService | `sharding.service.ts` | MD5 consistent-hash, 16 shards, Redis registry |
| ConnectionManagerService | `connection-manager.service.ts` | Distributed WS tracking, load-aware routing |
| CircuitBreaker | `circuit-breaker.ts` | CLOSED/OPEN/HALF_OPEN fault tolerance |
| Search-index worker | `worker/main.ts` | Full-text index pipeline (concurrency: 5) |
| AI-tasks worker | `worker/main.ts` | Spam/moderation pipeline (concurrency: 3) |
| Load test script | `scripts/load_test.py` | WebSocket stress testing with metrics |

### Enhanced Services

| Service | Enhancement |
| --------- | ------------ |
| PrismaService | Slow query detection (>200ms), error event logging, env-aware log levels |
| HealthController | Redis/Python health checks, `/metrics` endpoint with connection/shard/queue stats |
| ChatGateway | ConnectionManager integration (increment/decrement on connect/disconnect) |
| QueueModule | Now global with 6 services: MessageQueue, Notification, EventBus, Cache, Sharding, ConnectionManager |
| CI/CD | Redis service container, Python syntax CI, Docker image builds |
| Docker Compose | Redis maxmemory 512MB LRU, ai-python healthcheck, `service_healthy` conditions |
| Prisma schema | 2 new Message indexes (`[senderId, createdAt]`, `[roomId, senderId]`) |
