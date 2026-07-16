# rate-sentinel — Business Requirements Document

> **Version:** 1.0 &nbsp;|&nbsp; **Status:** Draft &nbsp;|&nbsp; **Author:** Prashant Verma &nbsp;|&nbsp; **Domain:** Platform Engineering · FinTech / Mobility

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Stakeholders](#3-stakeholders)
4. [Business Objectives](#4-business-objectives)
5. [Business Rules](#5-business-rules)
6. [Functional Scope](#6-functional-scope)
7. [Performance Requirements](#7-performance-requirements)
8. [Security & Compliance Requirements](#8-security--compliance-requirements)
9. [Operational Requirements](#9-operational-requirements)
10. [Success Metrics & KPIs](#10-success-metrics--kpis)
11. [Assumptions & Constraints](#11-assumptions--constraints)
12. [Out of Scope](#12-out-of-scope)
13. [Risk Register](#13-risk-register)
14. [Glossary](#14-glossary)

---

## 1. Executive Summary

Digital platforms operating at scale face two compounding problems: unrestricted API access enables abuse, cost spikes, and cascading failures; and fragmented authentication and payment logic scattered across services creates duplication, inconsistency, and security gaps.

**rate-sentinel** solves this by acting as a centralised access-control, client-verification, and payment processing gateway. It enforces who can call what and how often, verifies client identity via multi-channel OTP, processes payments with idempotency guarantees, and reliably dispatches notification events to a Kafka message bus for downstream consumption.

The platform also includes a React-based operator dashboard used to view system status, manage rate-limit rules, test OTP flows, and validate payment/idempotency behavior without relying on backend-only tools.

This document defines the business requirements that govern what the platform must do, why it must do it, and how success is measured — independent of technical implementation.

---

## 2. Problem Statement

### 2.1 API Abuse and Cost Exposure

Without request throttling, a single misbehaving or malicious client can consume disproportionate platform resources, degrade service quality for legitimate users, and drive up infrastructure costs unpredictably. Existing per-service rate limiting is inconsistent, duplicated across codebases, and not centrally manageable.

### 2.2 Duplicate Payment Charges

In unreliable mobile and network conditions, clients retry payment requests. Without a deduplication mechanism, retries result in double charges — a critical trust and compliance failure that damages customer relationships and triggers regulatory scrutiny.

### 2.3 Fragmented Client Verification

OTP generation and verification logic is implemented independently across multiple services, leading to inconsistent security policies (different expiry times, different lockout thresholds, different hashing approaches), no unified audit trail, and duplicated vendor integrations.

### 2.4 Decoupled Notification Dispatch

Business services need to trigger customer notifications (OTP delivery, payment confirmation) without owning the complexity of vendor selection, retry logic, or delivery tracking. A clean event-driven boundary is required between "what to send" and "how to send it."

---

## 3. Stakeholders

| Stakeholder | Role | Primary Concern |
|---|---|---|
| Platform / DevOps Engineer | Operates the system | Live rule control, observability, no-downtime deployments |
| Business / Product Owner | Owns cost and SLA | Zero double charges, bounded vendor costs, delivery SLA |
| Downstream Service Teams | Produce notification events | Simple, stable Kafka contract with no vendor ownership |
| Security / Compliance Officer | Audits and governs | PII handling, secrets management, SAST scan results |
| End Customer | Receives OTP and payment confirmations | Fast OTP delivery, no phantom charges |
| Customer Support Agent | Resolves disputes | Searchable audit trail to confirm what was sent and when |
| Platform Operator Dashboard User | Uses the web console | Visual access to rules, OTP, and payment workflows |

---

## 4. Business Objectives

### BO-1 · Protect platform revenue from API abuse

Enforce configurable request limits per client and route to prevent deliberate or accidental abuse without impacting legitimate traffic patterns.

**Acceptance Criteria:**
- No single client can exceed their configured quota
- Throttled requests receive a clear `429` response within 5ms
- Legitimate traffic at or below quota is never rejected
- Rate limit rules can be changed by operations without a service restart

---

### BO-2 · Eliminate duplicate payment charges

Guarantee that a payment is processed exactly once, regardless of how many times the client submits the same request due to network retries or timeouts.

**Acceptance Criteria:**
- Submitting the same `Idempotency-Key` within 24 hours returns the original result with no new DB record created
- Zero duplicate entries in the `payments` table under any retry scenario
- Zero double-charge incidents in load and integration testing

---

### BO-3 · Centralise and standardise client verification

Provide a single, secure OTP service that all downstream systems use for client identity verification, with consistent security policies and a unified audit trail.

**Acceptance Criteria:**
- All OTP generation and verification flows through rate-sentinel exclusively
- OTP never stored in plaintext in any system
- Lockout policy (attempts, duration) is centrally configurable without code changes
- All OTP events (generate, verify, fail, lock) are auditable from a single source

---

### BO-4 · Decouple business logic from notification delivery

Allow business services to publish notification intent without owning vendor credentials, retry logic, or delivery state. The platform absorbs all communication complexity behind a Kafka contract.

**Acceptance Criteria:**
- Downstream services publish a `NotificationEvent` to Kafka with zero knowledge of the delivery vendor
- Adding a new communication channel requires no changes to any business service
- All notification events published by this platform are consumed and delivered by message-relay

---

## 5. Business Rules

### BR-1 · OTP must never be stored in plaintext

Customer verification codes are sensitive credentials. Storing them in plaintext exposes customers to credential theft if the database is compromised.

- OTPs must be BCrypt-hashed (work factor ≥ 10) immediately upon generation
- The plaintext OTP must be discarded after hashing; it must never appear in any database column, log line, or API response
- Only the hash is persisted; verification uses `BCryptPasswordEncoder.matches()`

---

### BR-2 · Payment idempotency window is 24 hours

Client retries are expected within a session window but must not persist indefinitely.

- An `Idempotency-Key` submitted more than 24 hours after the original request is treated as a new transaction
- Redis TTL on idempotency keys must be exactly 24 hours
- MySQL acts as the durable secondary guard against Redis eviction edge cases

---

### BR-3 · Locked accounts must not receive new OTPs

Allowing OTP generation while an account is locked circumvents the brute-force protection mechanism.

- `POST /api/otp/generate` must return `400 Bad Request` with a "locked" message for any identifier in Redis lockout state
- Lockout is applied per `identifier + otpType` combination, not globally per identifier
- Lockout duration and max attempts are externally configurable without code changes

---

### BR-4 · Rate limit rules take effect within one request cycle

Business decisions to restrict a client must be enforceable immediately without service downtime.

- A rule update via `PUT /api/admin/rules/{id}` must evict the Redis cache synchronously
- The next incoming request after the update must use the new rule, not the old cached value
- Total time from API call to rule enforcement must be under 1 second

---

### BR-5 · All secrets managed through Azure Key Vault

No sensitive credentials may appear in version-controlled files or environment variables in production.

- JWT signing key, database passwords, and vendor API keys must be retrieved at runtime from Azure Key Vault
- Local development may use environment variables as a fallback
- Any Checkmarx SAST finding flagging hardcoded secrets must block the build

---

### BR-6 · Admin endpoints require elevated authorisation

Rate limit rule management must not be accessible to ordinary client tokens.

- All `/api/admin/**` endpoints require a JWT with `ROLE_ADMIN`
- Client tokens (`ROLE_CLIENT`) must receive `403 Forbidden` on admin endpoints
- Admin actions (create, update, delete rule) must be logged with the acting user's identity

---

## 6. Functional Scope

| Feature Area | In Scope | Notes |
|---|---|---|
| Rate limiting | Sliding Window, Token Bucket, Fixed Window | Per client, per route, live rule updates |
| Authentication | JWT issue and validation | Stateless, RS256-signed |
| OTP | Generate, verify, lockout | SMS / Email / WhatsApp channels |
| Payments | Process, idempotency, status persistence | MySQL-backed, gateway-agnostic |
| Notification dispatch | Kafka publish to 4 topics | Channel-based routing |
| Admin rule API | CRUD with live cache eviction | ADMIN role required |
| Observability | Prometheus metrics, structured logs | Grafana dashboards in message-relay |

---

## 7. Performance Requirements

| Requirement | Target | Measurement Method |
|---|---|---|
| Rate limit decision latency | p99 < 5ms | JMeter load test, 10,000 req/sec |
| OTP verification latency | p99 < 10ms | JMeter, 3,000 req/sec sustained |
| Payment processing latency | p99 < 45ms | JMeter, 1,500 req/sec sustained |
| Kafka publish throughput | > 5,000 events/sec | JMeter + Kafka consumer lag monitoring |
| Horizontal scalability | Linear to 5 instances | No state in JVM; all state externalised |

---

## 8. Security & Compliance Requirements

### SC-1 · SAST scanning on every pull request

Checkmarx One free-tier scan must be configured as a required CI step. Builds must fail on any critical or high-severity finding.

### SC-2 · No hardcoded credentials

Zero tolerance for passwords, API keys, or JWT secrets in source code or configuration files committed to version control.

### SC-3 · PII protection in logs

Phone numbers and email addresses must never appear unmasked in application logs. Log statements must use masked versions only.

### SC-4 · Brute-force protection on OTP

Maximum 3 failed verify attempts before account lockout. Lockout must be enforced at the Redis layer (not application layer) to survive application restarts.

### SC-5 · Input validation on all endpoints

All request parameters must be validated before processing. Malformed input returns `400 Bad Request` with a descriptive error message. No stack traces exposed to callers.

---

## 9. Operational Requirements

### OR-1 · Zero-downtime rule updates

Platform operators must be able to update rate limit rules, add new clients, and change thresholds without restarting the service or causing any request failures during the update.

### OR-2 · Single-command local environment

A new engineer must be able to run the complete platform locally using `docker-compose up -d` followed by `./mvnw spring-boot:run` — no additional infrastructure setup required.

### OR-3 · Health and readiness endpoints

`/actuator/health` must return system health including Redis and MySQL connectivity. `/actuator/health/readiness` must signal when the application is ready to accept traffic. Both used by Kubernetes liveness and readiness probes.

### OR-4 · Structured log format

All log output must follow a consistent structured pattern: `timestamp | thread | level | logger | message`. Logs must include `clientId` and `correlationId` in every line related to a business transaction for distributed tracing.

---

## 10. Success Metrics & KPIs

| KPI | Target | Baseline (pre-platform) |
|---|---|---|
| Duplicate payment incidents | 0 | Unknown (untracked) |
| Rate limit decision latency (p99) | < 5ms | N/A (no prior rate limiter) |
| OTP verification latency (p99) | < 10ms | ~50ms (per-service impl) |
| Code duplication across services | −60% | Fragmented per-service |
| Time to add new notification channel | < 1 sprint | 2–3 sprints |
| Security vulnerabilities (Checkmarx) | 0 critical/high | Unknown |

---

## 11. Assumptions & Constraints

**Assumptions:**
- Downstream services are capable of generating stable UUID idempotency keys per payment intent
- A Kafka cluster (single-broker acceptable in dev/test) is available in all environments
- Azure Key Vault access is provisioned for production deployments
- Mock vendor implementations are acceptable for initial delivery; real SDK integration is a subsequent iteration

**Constraints:**
- Java 17 and Spring Boot 3.x are the mandated runtime stack
- All infrastructure must be containerisable for AKS deployment
- SonarCloud free tier is used — public repository required for unlimited scans
- Checkmarx One free tier limits scans to 10 per month

---

## 12. Out of Scope

The following are explicitly not part of rate-sentinel v1.0:

- Webhook callbacks to notify callers of asynchronous payment status changes
- OAuth2 / OpenID Connect integration (future auth layer)
- Multi-region active-active deployment
- Real-time push notification delivery (in-app or Firebase)
- Payment refund initiation (separate service concern)
- User management and registration endpoints

---

## 13. Risk Register

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-01 | Redis failure takes down rate limiter and OTP entirely | Medium | High | Redis Sentinel in prod; graceful degradation to allow-all with Sentry alert |
| R-02 | Kafka broker outage blocks all notification dispatch | Low | High | Replication factor ≥ 2; producer retries with `acks=all`; consumer lag alerting |
| R-03 | JWT secret rotation causes all active sessions to invalidate | Low | Medium | Key rotation procedure documented; rolling restart with overlapping validity window |
| R-04 | MySQL connection pool exhaustion under payment burst | Medium | Medium | HikariCP pool tuning; connection pool metrics exposed to Prometheus |
| R-05 | Idempotency key collision across different clients | Very Low | High | Key namespaced by `clientId` at lookup level; collision structurally impossible |

---

## 14. Glossary

| Term | Definition |
|---|---|
| Idempotency Key | A client-supplied UUID that uniquely identifies a payment intent, used to prevent duplicate processing on retry |
| Rate Limit Rule | A database-backed configuration defining the request limit, time window, and algorithm for a specific client-route combination |
| OTP | One-Time Password — a time-limited numeric code used to verify client identity via SMS, email, or WhatsApp |
| Sliding Window | A rate-limiting algorithm that counts requests within a rolling time window using a Redis sorted set |
| Token Bucket | A rate-limiting algorithm that models a bucket of tokens replenished at a fixed rate; each request consumes one token |
| NotificationEvent | The Kafka message payload published by rate-sentinel containing the recipient, channel, template, and priority for a notification |
| DLQ | Dead Letter Queue — a Kafka topic that receives messages that could not be successfully delivered after all retry attempts |
| SAST | Static Application Security Testing — automated code scanning for security vulnerabilities, performed by Checkmarx |
| PII | Personally Identifiable Information — data such as phone numbers and email addresses that must be protected under data privacy regulations |
