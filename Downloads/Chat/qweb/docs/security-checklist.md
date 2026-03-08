# Security Hardening Checklist

- [x] Access JWT with short TTL and refresh token rotation
- [x] HTTP-only cookies for auth tokens
- [x] Room membership authorization checks (REST and WS)
- [x] Input validation using class-validator and zod contracts
- [x] Helmet secure headers + CSP
- [x] CORS restricted to configured origin
- [x] Rate limiting via Nest throttler + Redis-ready architecture
- [x] SQL injection defense via Prisma parameterized queries
- [x] Upload size and MIME allowlist validation
- [x] Signed upload URLs with short expiration
- [x] Malware scanning pipeline with ClamAV and quarantine bucket
- [x] Structured logs with sensitive field redaction
- [x] Request tracing hooks via OpenTelemetry
- [x] Health and metrics endpoints for operational safety

## Remaining before production launch
- [ ] CSRF double-submit token middleware for browser state-changing routes
- [ ] Redis-backed revoked token + session consistency service
- [ ] WAF and SSRF egress policy enforcement in cloud network
- [ ] KMS-backed secret management and key rotation policy
- [ ] Automated dependency and container image CVE gating in CI
