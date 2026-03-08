# API + WebSocket Contracts

## REST
- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`
- `GET /v1/auth/me`
- `GET /v1/rooms`
- `POST /v1/rooms`
- `GET /v1/rooms/:roomId/messages?cursor=...`
- `POST /v1/rooms/:roomId/messages`
- `POST /v1/rooms/:roomId/messages/:messageId/read`
- `POST /v1/uploads/sign`
- `POST /v1/uploads/complete`
- `GET /v1/users/me`
- `PATCH /v1/users/me`
- `GET /v1/users/search?q=...`
- `GET /v1/users/blocked`
- `POST /v1/users/:userId/block`
- `DELETE /v1/users/:userId/block`
- `GET /v1/health/live`
- `GET /v1/health/ready`
- `GET /v1/health/deps`
- `GET /v1/metrics`

## Security headers for mutating requests
- All `POST`, `PUT`, `PATCH`, and `DELETE` requests require:
  - `Cookie: csrf_token=<token>`
  - `x-csrf-token: <same-token>`

## WebSocket Namespace `/chat`
Client events:
- `room:join` `{ roomId }`
- `room:leave` `{ roomId }`
- `message:send` `{ roomId, text, replyToId?, clientMsgId? }`
- `typing:start` `{ roomId }`
- `typing:stop` `{ roomId }`

Server events:
- `room:joined`
- `room:left`
- `message:new`
- `message:ack`
- `typing:update`
- `presence:update`
