# qweb (Next.js + NestJS + Prisma + Redis)

Production-oriented real-time chat platform scaffold.

## Apps
- `apps/web`: Next.js frontend (TypeScript, Tailwind, shadcn-style components)
- `apps/api`: NestJS backend (REST + Socket.IO)
- `apps/worker`: queue workers (malware scan pipeline)

## Shared
- `packages/contracts`: shared zod schemas for events/DTOs
- `prisma`: shared schema for PostgreSQL
- `infra/docker`: local stack (Postgres, Redis, MinIO, ClamAV, OTel)
- `infra/terraform`: cloud-ready structure

## Quick Start
1. `cp .env.example .env`
2. `docker compose -f infra/docker/docker-compose.yml up -d`
3. `npm install`
4. `npm run db:generate`
5. `npm run db:migrate`
6. `npm run dev`
