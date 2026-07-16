# rate-sentinel — Product Requirements Document (PRD)

> **Version:** 1.0 &nbsp;|&nbsp; **Status:** Draft &nbsp;|&nbsp; **Author:** Prashant Verma
> **Related BRD:** [rate-sentinel-BRD.md](rate-sentinel-BRD.md) &nbsp;|&nbsp; **Domain:** Platform Engineering · FinTech / Mobility

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [User Stories](#3-user-stories)
4. [Functional Requirements](#4-functional-requirements)
   - [FR-1 Rate Limiting](#fr-1-rate-limiting)
   - [FR-2 Authentication & Authorization](#fr-2-authentication--authorization)
   - [FR-3 OTP Verification](#fr-3-otp-verification)
   - [FR-4 Payment Processing](#fr-4-payment-processing)
   - [FR-5 Notification Dispatch](#fr-5-notification-dispatch)
   - [FR-6 Admin Rule Management](#fr-6-admin-rule-management)
   - [FR-7 Observability & Metrics](#fr-7-observability--metrics)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [API Contract Summary](#6-api-contract-summary)
7. [Data Models](#7-data-models)
8. [Error Handling Standards](#8-error-handling-standards)
9. [Dependencies](#9-dependencies)
10. [Acceptance Criteria Summary](#10-acceptance-criteria-summary)
11. [Open Questions](#11-open-questions)

---

## 1. Product Overview

**rate-sentinel** is a centralised API gateway and access-control platform built on Java 17 and Spring Boot 3. It sits at the entry point of all platform API calls and enforces:

- **Rate limiting** — pluggable algorithm-based throttling per client and route
- **Authentication** — stateless JWT-based identity verification
- **OTP verification** — secure, multi-channel client identity confirmation
- **Payment processing** — idempotent transaction handling with MySQL persistence
- **Notification dispatch** — async Kafka event publishing for downstream delivery

The product also ships with a React operator dashboard for exploring system health, testing OTP and payment flows, and managing rate-limit rules from a browser-based UI.

It publishes all notification events to Kafka topics consumed by **message-relay**.

---

## 2. Goals & Non-Goals

### Goals
- Prevent API abuse through configurable, live-updatable rate limiting
- Provide a single, secure OTP service with consistent lockout policy across all consumer services
- Guarantee exactly-once payment processing using idempotency keys
- Decouple business logic from notification delivery via Kafka event publishing
- Expose operational metrics for real-time monitoring via Prometheus

### Non-Goals
- Delivering notifications to end customers (owned by message-relay)
- User registration and account management
- OAuth2 / OIDC flows
- Payment refunds or chargebacks
- Multi-region active-active deployment (v1.0)

---

## 3. User Stories

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-01 | Platform operator | Update rate limit rules live without restarting the service | I can respond to abuse incidents immediately |
| US-02 | Client application | Receive a clear `429` when I exceed my quota | I know when to back off and retry |
| US-03 | Client application | Generate and verify an OTP for my user | I can confirm identity before sensitive operations |
| US-04 | Client application | Submit a payment with an idempotency key | Retrying on network failure never double-charges my user |
| US-05 | Platform operator | See rate limit hit rates and OTP metrics in Grafana | I can monitor platform health without querying the database |
| US-06 | Security officer | Have all secrets managed in Azure Key Vault | No credentials are exposed in source code or logs |
| US-07 | Downstream service | Publish a notification intent and forget | I never own vendor logic, retry logic, or delivery state |
| US-08 | Client application | Know exactly how many requests I have remaining | I can implement smart client-side throttling |
| US-09 | Platform operator | Use a dashboard to test OTP, payment, and rule-management flows | I can validate the system without crafting raw HTTP calls |

---

## 4. Functional Requirements

---

### FR-1 Rate Limiting

#### FR-1.1 — Algorithm selection per rule
**Priority:** P0 — Must Have

The system must support three rate-limiting algorithms, selectable per rate limit rule:

| Algorithm | Mechanism | Redis Structure | Best For |
|---|---|---|---|
| `SLIDING_WINDOW` | Rolling window using sorted set; removes stale entries on each request | Sorted set (`ZSET`) keyed by `sw:{clientId}:{route}` | Accuracy, no boundary burst |
| `TOKEN_BUCKET` | Bucket refilled at fixed rate; consume one token per request | Two keys: `tb:tokens:{key}` and `tb:refill:{key}` | Burst tolerance with sustained rate |
| `FIXED_WINDOW` | Counter reset at fixed interval boundaries | Single counter keyed by `fw:{key}:{windowBucket}` | Simplicity, lowest Redis overhead |

- Default algorithm is `SLIDING_WINDOW` unless overridden by a matching rule
- Algorithm name is stored on the `RateLimitRule` entity and loaded per request
- All three implementations must implement the `RateLimitAlgorithm` interface
- The correct implementation is resolved at runtime via `RateLimitAlgorithmFactory`

---

#### FR-1.2 — Rule evaluation priority
**Priority:** P0 — Must Have

Rate limit rules must be evaluated in the following priority order for every incoming request:

1. Exact match: `clientId` + `route`
2. Wildcard client: `*` + `route`
3. Global default: `*` + `*`
4. Hard-coded fallback (if no DB rule exists): 100 req / 60s / SLIDING_WINDOW

Rules are cached in Redis under key `rate-limit-rules::{clientId}:{route}` with a 5-minute TTL. Cache is invalidated via `@CacheEvict` on any admin rule mutation.

---

#### FR-1.3 — Request interception via Spring filter
**Priority:** P0 — Must Have

`RateLimitFilter` must extend `OncePerRequestFilter` and execute before any controller logic:

```
Incoming request
      ↓
Extract clientId (JWT attribute → X-Forwarded-For → remoteAddr)
      ↓
Fetch rule (Redis cache → MySQL fallback)
      ↓
Execute algorithm (Redis atomic operation)
      ↓
ALLOW → set response headers → continue filter chain
DENY  → return 429 with JSON body → terminate
```

**Skip list** — filter must not apply to:
- `/actuator/**`
- `/api/auth/**`
- `/favicon.ico`

---

#### FR-1.4 — Standard rate limit response headers
**Priority:** P0 — Must Have

Every response (allowed and throttled) must include:

| Header | Value |
|---|---|
| `X-RateLimit-Limit` | Configured limit for this rule |
| `X-RateLimit-Remaining` | Remaining requests in current window |
| `X-RateLimit-Algorithm` | Algorithm name: `SLIDING_WINDOW`, `TOKEN_BUCKET`, or `FIXED_WINDOW` |

Throttled responses additionally return:

```json
HTTP 429 Too Many Requests
{
  "error": "Rate limit exceeded",
  "retryAfter": 60,
  "clientId": "client-abc"
}
```

---

#### FR-1.5 — Prometheus counters for rate limit events
**Priority:** P1 — Should Have

Two Micrometer counters must be registered and exported to `/actuator/prometheus`:

- `rate_limit.allowed` — incremented on every passed request
- `rate_limit.throttled` — incremented on every 429 response

---

### FR-2 Authentication & Authorization

#### FR-2.1 — JWT token issuance
**Priority:** P0 — Must Have

`POST /api/auth/login` must:

1. Accept `username` and `password` as request parameters
2. Authenticate via `AuthenticationManager`
3. Return a signed JWT containing:
   - **Subject:** `username` (used as `clientId` throughout the system)
   - **Claim `role`:** e.g. `ROLE_ADMIN`, `ROLE_CLIENT`
   - **Issued at:** current timestamp
   - **Expiry:** configurable via `jwt.expiration` (default 24 hours)
4. Return HTTP 401 on invalid credentials

Token is signed using HMAC-SHA256 with a secret loaded from `jwt.secret` (Azure Key Vault in production).

---

#### FR-2.2 — JWT validation on every protected request
**Priority:** P0 — Must Have

`JwtAuthFilter` must:

1. Extract the Bearer token from the `Authorization` header
2. Validate signature, expiry, and structure using `JwtTokenProvider`
3. On success: set `SecurityContextHolder` authentication and store `clientId` as a request attribute (`request.setAttribute("clientId", subject)`)
4. On failure: log a warning at DEBUG level and continue the filter chain unauthenticated (Spring Security will reject the request downstream)

Invalid or expired tokens must result in HTTP 401. No token present skips the filter and falls through to Spring Security's default rejection for protected routes.

---

#### FR-2.3 — Role-based endpoint protection
**Priority:** P0 — Must Have

| Endpoint Pattern | Required Role | Notes |
|---|---|---|
| `/api/auth/**` | None (public) | Login endpoint |
| `/actuator/**` | None (public) | Health and metrics |
| `/api/admin/**` | `ROLE_ADMIN` | Rate limit rule management |
| `/api/otp/**` | `ROLE_CLIENT` or `ROLE_ADMIN` | OTP generate and verify |
| `/api/payments/**` | `ROLE_CLIENT` or `ROLE_ADMIN` | Payment processing |

Unauthorised access returns HTTP 403.

---

### FR-3 OTP Verification

#### FR-3.1 — OTP generation
**Priority:** P0 — Must Have

`POST /api/otp/generate` accepts:
- `identifier` — phone number (E.164) or email address
- `type` — enum: `SMS`, `EMAIL`, `WHATSAPP`

Processing steps:

1. Check Redis lockout key `otp:lock:{identifier}` — reject with HTTP 400 if locked
2. Generate a cryptographically secure numeric OTP using `SecureRandom` (length configurable, default 6 digits)
3. BCrypt-hash the OTP (work factor 10) and persist an `OtpRecord` to MySQL with:
   - `identifier`, `otpType`, `hashedOtp`
   - `expiresAt` = now + `otp.expiry-seconds` (default 300s)
   - `used = false`, `attempts = 0`
4. Build a `NotificationEvent` with `templateId = "otp_verification"` and dispatch via `NotificationDispatcher`
5. Return HTTP 200 with `{"message": "OTP sent successfully"}`

The plaintext OTP is never returned in the API response and never logged.

---

#### FR-3.2 — OTP verification
**Priority:** P0 — Must Have

`POST /api/otp/verify` accepts: `identifier`, `otp`, `type`

Processing steps:

1. Check Redis lockout key — return HTTP 400 if locked
2. Fetch the most recent unused `OtpRecord` for `identifier + type` ordered by `createdAt DESC`
3. If none found: HTTP 400 `"No active OTP found"`
4. If `expiresAt` < now: HTTP 400 `"OTP has expired"`
5. Increment `attempts` on the record
6. If `attempts >= otp.max-attempts` (default 3): set Redis lockout key with TTL `otp.lockout-seconds` (default 900); save record; throw lockout exception
7. BCrypt compare `otp` against `hashedOtp` — if mismatch: save incremented attempts, return `{"verified": false}`
8. On match: set `used = true`, save record, return `{"verified": true}`

---

#### FR-3.3 — OTP configuration
**Priority:** P1 — Should Have

All OTP behaviour must be driven by externally configurable properties:

| Property | Default | Description |
|---|---|---|
| `otp.length` | `6` | Number of digits in generated OTP |
| `otp.expiry-seconds` | `300` | OTP validity window (5 minutes) |
| `otp.max-attempts` | `3` | Failed attempts before lockout |
| `otp.lockout-seconds` | `900` | Account lockout duration (15 minutes) |

Changes take effect on next application restart (no live reload required for security policy changes).

---

### FR-4 Payment Processing

#### FR-4.1 — Idempotent payment creation
**Priority:** P0 — Must Have

`POST /api/payments` accepts:
- Header: `Idempotency-Key` (UUID, required)
- Params: `amount` (positive BigDecimal), `currency` (3-char ISO), `description` (optional)
- Auth: JWT required; `clientId` extracted from token subject

Processing steps:

1. **Redis check:** look up `payment:idem:{idempotencyKey}` — if found, return the existing payment from MySQL without re-processing
2. **MySQL check:** `paymentRepository.existsByIdempotencyKey()` — secondary durable guard
3. If neither exists: create `Payment` record with status `PENDING`, save to MySQL
4. Call `processWithGateway()` (pluggable; mock in v1.0)
5. **On success:** update status to `SUCCESS`, set `processedAt`, store idempotency key in Redis with 24h TTL, dispatch `payment_success` notification
6. **On failure:** update status to `FAILED`, store `failureReason`, dispatch `payment_failed` notification
7. Return the final `Payment` entity

---

#### FR-4.2 — Payment status persistence
**Priority:** P0 — Must Have

The `payments` MySQL table must persist:

| Field | Type | Notes |
|---|---|---|
| `id` | BIGINT PK | Auto-generated |
| `idempotencyKey` | VARCHAR UNIQUE | Client-supplied UUID |
| `clientId` | VARCHAR | From JWT subject |
| `amount` | DECIMAL(12,2) | Must be > 0 |
| `currency` | CHAR(3) | ISO 4217 |
| `status` | ENUM | `PENDING`, `SUCCESS`, `FAILED`, `REFUNDED` |
| `description` | VARCHAR | Optional |
| `failureReason` | VARCHAR | Null on success |
| `createdAt` | TIMESTAMP | Immutable |
| `processedAt` | TIMESTAMP | Set on terminal state |

Indexes: `UNIQUE(idempotencyKey)`, composite `(clientId, status)`.

---

#### FR-4.3 — Post-payment notification dispatch
**Priority:** P0 — Must Have

On both `SUCCESS` and `FAILED` outcomes, a `NotificationEvent` must be dispatched via `NotificationDispatcher` with:

- `templateId`: `"payment_success"` or `"payment_failed"`
- `channel`: `EMAIL` (default; overridable per client config in future)
- `templateParams`: `amount`, `currency`, `status`, `paymentId`
- `priority`: `HIGH`
- `correlationId`: `paymentId`

---

### FR-5 Notification Dispatch

#### FR-5.1 — Channel-based Kafka topic routing
**Priority:** P0 — Must Have

`NotificationDispatcher.dispatch()` must resolve the Kafka topic using the following logic:

```
if templateId is "payment_success" OR "payment_failed"
    → publish to kafka.topics.payment
else
    SMS     → kafka.topics.sms
    EMAIL   → kafka.topics.email
    WHATSAPP → kafka.topics.whatsapp
```

Topic names are injected from `application.yml` — no hardcoded strings in dispatcher logic.

---

#### FR-5.2 — Async non-blocking Kafka publish
**Priority:** P0 — Must Have

`KafkaProducerService.publish()` must use `KafkaTemplate.send()` which returns a `CompletableFuture`. The future's `whenComplete` callback must:

- On success: log at DEBUG with topic, key, partition, and offset
- On failure: log at ERROR with topic, key, and exception message

The dispatcher must never block the calling thread waiting for Kafka acknowledgement. A Kafka publish failure must not fail the API response to the client.

---

#### FR-5.3 — NotificationEvent contract
**Priority:** P0 — Must Have

Every `NotificationEvent` published to Kafka must contain:

| Field | Type | Required | Notes |
|---|---|---|---|
| `eventId` | String (UUID) | Yes | Globally unique per dispatch |
| `clientId` | String | Yes | Originating service identifier |
| `recipient` | String | Yes | Phone (E.164) or email |
| `channel` | Enum | Yes | `SMS`, `EMAIL`, `WHATSAPP` |
| `templateId` | String | Yes | e.g. `otp_verification`, `payment_success` |
| `templateParams` | Map<String,String> | No | Dynamic content for template rendering |
| `priority` | Enum | Yes | `HIGH`, `MEDIUM`, `LOW` |
| `correlationId` | String | No | Links event to source entity (OTP ID, payment ID) |
| `createdAt` | LocalDateTime | Yes | Set at dispatch time |

---

### FR-6 Admin Rule Management

#### FR-6.1 — Full CRUD on rate limit rules
**Priority:** P0 — Must Have

| Method | Endpoint | Action | Auth |
|---|---|---|---|
| `GET` | `/api/admin/rules` | List all rules | `ROLE_ADMIN` |
| `POST` | `/api/admin/rules` | Create a new rule | `ROLE_ADMIN` |
| `PUT` | `/api/admin/rules/{id}` | Update an existing rule | `ROLE_ADMIN` |
| `DELETE` | `/api/admin/rules/{id}` | Soft-delete (set `active=false`) | `ROLE_ADMIN` |

All mutations must call `@CacheEvict(value = "rate-limit-rules", allEntries = true)` to immediately invalidate the Redis rule cache.

---

#### FR-6.2 — RateLimitRule schema
**Priority:** P0 — Must Have

| Field | Type | Validation | Notes |
|---|---|---|---|
| `clientId` | String | Required | Use `"*"` for wildcard |
| `route` | String | Required | URI path; use `"*"` for global |
| `requestLimit` | Long | Required, > 0 | Max requests in window |
| `windowSeconds` | Long | Required, > 0 | Time window in seconds |
| `algorithm` | String | Required | `SLIDING_WINDOW`, `TOKEN_BUCKET`, `FIXED_WINDOW` |
| `active` | Boolean | Default `true` | Inactive rules are ignored |

---

### FR-7 Observability & Metrics

#### FR-7.1 — Prometheus metrics endpoint
**Priority:** P1 — Should Have

`/actuator/prometheus` must export the following application metrics:

| Metric | Type | Description |
|---|---|---|
| `rate_limit.allowed` | Counter | Requests that passed rate limit check |
| `rate_limit.throttled` | Counter | Requests that were rejected (429) |
| `otp.generated` | Counter | OTP generate calls (tag: `type`) |
| `otp.verified.success` | Counter | Successful OTP verifications |
| `otp.verified.failure` | Counter | Failed OTP verifications |
| `payment.processed` | Counter | Payment attempts (tag: `status`) |
| `http.server.requests` | Timer | Per-endpoint latency (Spring auto) |

---

#### FR-7.2 — Health and readiness probes
**Priority:** P1 — Should Have

`/actuator/health` must report:
- `UP` when Redis and MySQL are reachable
- `DOWN` with detail when either dependency is unavailable

`/actuator/health/readiness` used by Kubernetes readiness probe — must not return `UP` until application context is fully initialised.

---

## 5. Non-Functional Requirements

| Category | Requirement | Target |
|---|---|---|
| Performance | Rate limit decision latency | p99 < 5ms at 10,000 req/sec |
| Performance | OTP verification latency | p99 < 10ms at 3,000 req/sec |
| Performance | Payment processing latency | p99 < 45ms at 1,500 req/sec |
| Scalability | Horizontal scaling | Stateless JVM; all state in Redis/MySQL/Kafka |
| Reliability | Availability | 99.9% uptime (excluding planned maintenance) |
| Security | Secrets management | All secrets via Azure Key Vault in production |
| Security | SAST | Zero Checkmarx critical/high findings on merge |
| Security | Code coverage | SonarCloud gate: ≥ 70% line coverage |
| Maintainability | Algorithm extensibility | New algorithm: one new class, zero existing changes |
| Operability | Rule update time | < 1s from admin API call to enforcement |
| Operability | Local setup | `docker-compose up -d` + `./mvnw spring-boot:run` < 3 minutes |

---

## 6. API Contract Summary

### Public Endpoints

```
POST   /api/auth/login                    → JWT token
POST   /api/otp/generate                  → OTP dispatched
POST   /api/otp/verify                    → {verified: bool}
POST   /api/payments                      → Payment record
GET    /api/payments/{id}                 → Payment record
```

### Admin Endpoints (ROLE_ADMIN)

```
GET    /api/admin/rules                   → List<RateLimitRule>
POST   /api/admin/rules                   → RateLimitRule
PUT    /api/admin/rules/{id}              → RateLimitRule
DELETE /api/admin/rules/{id}              → 204 No Content
```

### Infrastructure Endpoints

```
GET    /actuator/health                   → Health status
GET    /actuator/health/readiness         → Readiness status
GET    /actuator/prometheus               → Prometheus metrics
```

---

## 7. Data Models

### RateLimitRule (MySQL)
```
id              BIGINT PK AUTO_INCREMENT
clientId        VARCHAR(255) NOT NULL
route           VARCHAR(255) NOT NULL
requestLimit    BIGINT NOT NULL
windowSeconds   BIGINT NOT NULL
algorithm       VARCHAR(50) NOT NULL DEFAULT 'SLIDING_WINDOW'
active          BOOLEAN NOT NULL DEFAULT TRUE
createdAt       TIMESTAMP NOT NULL
updatedAt       TIMESTAMP
INDEX: (clientId, route)
```

### OtpRecord (MySQL)
```
id              BIGINT PK AUTO_INCREMENT
identifier      VARCHAR(255) NOT NULL
otpType         ENUM('SMS','EMAIL','WHATSAPP') NOT NULL
hashedOtp       VARCHAR(255) NOT NULL
attempts        INT NOT NULL DEFAULT 0
used            BOOLEAN NOT NULL DEFAULT FALSE
expiresAt       TIMESTAMP NOT NULL
createdAt       TIMESTAMP NOT NULL
INDEX: (identifier, otpType)
```

### Payment (MySQL)
```
id              BIGINT PK AUTO_INCREMENT
idempotencyKey  VARCHAR(255) NOT NULL UNIQUE
clientId        VARCHAR(255) NOT NULL
amount          DECIMAL(12,2) NOT NULL
currency        CHAR(3) NOT NULL
status          ENUM('PENDING','SUCCESS','FAILED','REFUNDED')
description     VARCHAR(500)
failureReason   VARCHAR(500)
createdAt       TIMESTAMP NOT NULL
processedAt     TIMESTAMP
INDEX: UNIQUE(idempotencyKey), (clientId, status)
```

---

## 8. Error Handling Standards

All error responses must follow a consistent JSON structure:

```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE",
  "timestamp": "2025-01-01T10:00:00Z",
  "path": "/api/otp/verify"
}
```

| Scenario | HTTP Status | `code` |
|---|---|---|
| Missing / invalid JWT | 401 | `UNAUTHORIZED` |
| Insufficient role | 403 | `FORBIDDEN` |
| Rate limit exceeded | 429 | `RATE_LIMIT_EXCEEDED` |
| OTP expired | 400 | `OTP_EXPIRED` |
| Account locked | 400 | `ACCOUNT_LOCKED` |
| Invalid idempotency | 400 | `INVALID_IDEMPOTENCY_KEY` |
| Validation failure | 400 | `VALIDATION_ERROR` |
| Internal error | 500 | `INTERNAL_ERROR` |

Stack traces must never be included in API responses in any environment.

---

## 9. Dependencies

| Dependency | Version | Purpose |
|---|---|---|
| Spring Boot | 3.2.x | Application framework |
| Spring Security | 6.x | Auth filter chain |
| Spring Data JPA | 3.2.x | MySQL ORM |
| Spring Data Redis | 3.2.x | Rate limiter state, OTP lockout, idempotency |
| Spring Kafka | 3.x | Notification event publishing |
| JJWT | 0.12.x | JWT issue and validation |
| Spring Cloud Azure Key Vault | 5.8.x | Secrets management |
| Micrometer Prometheus | Latest | Metrics export |
| Lombok | Latest | Boilerplate reduction |
| JaCoCo | 0.8.11 | Code coverage reporting |

**Infrastructure:**

| Service | Version | Purpose |
|---|---|---|
| MySQL | 8.0 | Payments, OTP records, rate limit rules |
| Redis | 7.x | Rate limit state, OTP lockout, idempotency cache, rule cache |
| Apache Kafka | 7.5.x (Confluent) | Notification event bus |

---

## 10. Acceptance Criteria Summary

| FR | Acceptance Criteria |
|---|---|
| FR-1.1 | All three algorithm implementations pass unit tests. Factory resolves correct implementation per rule config. |
| FR-1.2 | Rule priority order verified by integration test: exact > wildcard client > global default > fallback. |
| FR-1.3 | Filter verified with MockMvc: 429 returned on 11th request when limit=10. Auth and actuator endpoints bypass filter. |
| FR-1.4 | All three headers present in every response. 429 body matches schema. |
| FR-2.1 | Login returns JWT. Expired credentials return 401. Token contains correct subject and role claim. |
| FR-2.2 | Valid JWT → 200. Expired JWT → 401. Tampered JWT → 401. No JWT on protected route → 401. |
| FR-2.3 | ROLE_CLIENT JWT → 403 on `/api/admin/**`. ROLE_ADMIN JWT → 200. |
| FR-3.1 | OTP stored as BCrypt hash. Plaintext not in DB, logs, or response. Dispatch confirmed via mock. |
| FR-3.2 | Correct OTP → `verified: true`. Wrong OTP → `verified: false`. 3 wrong → 400 locked. Expired → 400 expired. |
| FR-4.1 | Same Idempotency-Key submitted twice: second call returns first result, no new DB row created. |
| FR-4.2 | Payment table schema matches spec. SUCCESS and FAILED states both persisted with correct fields. |
| FR-4.3 | NotificationEvent captured in Kafka consumer during integration test for both success and failure paths. |
| FR-5.1 | Payment templates routed to `topic.payment`. SMS/Email/WhatsApp routed to respective topics. |
| FR-6.1 | CRUD operations verified. Cache evicted after each mutation (verified by checking Redis key absence). |
| FR-7.1 | `/actuator/prometheus` returns `rate_limit_allowed_total` and `rate_limit_throttled_total` counters. |

---

## 11. Open Questions

| ID | Question | Owner | Status |
|---|---|---|---|
| OQ-01 | Which real payment gateway (Razorpay / Stripe) will be integrated in v1.1? | Product Owner | Open |
| OQ-02 | Should the admin rule API support bulk import of rules (CSV/JSON)? | Platform Lead | Open |
| OQ-03 | What is the required OTP delivery SLA (time from generate call to SMS receipt)? | Business Owner | Open |
| OQ-04 | Should rate limit rules support time-of-day windows (e.g. stricter limits at night)? | Product Owner | Backlog |
| OQ-05 | Is a refresh token mechanism required or is 24h JWT expiry acceptable? | Security Officer | Open |
