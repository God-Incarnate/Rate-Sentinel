# Rate-Sentinel

Rate-Sentinel is a Spring Boot service that provides centralized API protection and trust workflows:
rate limiting, JWT authentication, OTP verification, idempotent payment processing, and Kafka-based
notification dispatch.

## What This Project Solves

- Prevents abuse using configurable per-client and per-route throttling.
- Standardizes OTP generation/verification with lock and attempt policy.
- Prevents duplicate payment processing through idempotency keys.
- Decouples outbound notifications through asynchronous Kafka events.
- Exposes operational metrics and health endpoints for monitoring.

## Tech Stack

- Java 17
- Spring Boot
- Spring Security (JWT)
- Spring Data JPA + MySQL
- Redis
- Kafka
- Maven
- React 19 frontend
- Three.js / React Three Fiber / Drei UI experience

## Frontend Overview

The `frontend/` app is a React-based operator dashboard and API tester for the backend.
It includes:

- A live 3D particle background and modern glass-style UI
- Tabbed views for `Overview`, `Rate Rules`, `OTP Tester`, and `Payments`
- JWT-aware API calls to backend endpoints
- Admin rule management with access control overlays
- OTP generation/verification and payment creation flows

The frontend communicates with the backend at `http://localhost:8080` and is configured for
local development on `http://localhost:3000`.

## Core Runtime Flow

1. Request enters security filter chain.
2. JWT filter validates token and sets request `clientId` when available.
3. Rate-limit filter evaluates quota using configured rule + selected algorithm.
4. Controller/service executes business logic (OTP/payment/admin).
5. Events are published to Kafka for downstream delivery.

## Fixes Integrated in Current Design

- Sliding-window algorithm uses atomic Redis Lua execution to prevent concurrent quota overshoot.
- Rule evaluation supports exact, wildcard, and pattern-based matching.
- Admin rule mutations evict rule cache so updates apply immediately.
- Payment flow uses Redis + MySQL idempotency checks to prevent duplicate charges.

## Project Structure

- `src/main/java` - Application code
- `src/test/java` - Tests
- `frontend/` - React dashboard/client UI
- `docs/` - System documentation (HLD, LLD, BRD, PRD, API specs)
- `docker-compose.yml` - Local infra (Kafka, Kafka UI, Redis)

## Run Locally

Prerequisites (based on repository configuration):
- Java 17
- Maven wrapper (`mvnw.cmd`)
- Running Redis and Kafka (compose file present)
- MySQL reachable through environment-backed datasource config

Example startup:

```powershell
docker compose up -d
.\mvnw.cmd spring-boot:run
```

Frontend startup:

```powershell
cd frontend
npm install
npm start
```

## Test

```powershell
.\mvnw.cmd test
```

## API Overview

Primary endpoints:
- `POST /api/auth/login`
- `POST /api/v1/otp/generate-otp`
- `POST /api/v1/otp/verify-otp`
- `POST /api/v1/payment/createPayment`
- `GET /api/admin/rules`
- `POST /api/admin/rules`
- `PUT /api/admin/rules/{id}`
- `DELETE /api/admin/rules/{id}`

Detailed request/response contracts are documented in `docs/API_SPECS.md`.

The frontend dashboard uses these endpoints directly for live testing and operational visibility.

## Documentation

- `docs/HLD.md` - High-level architecture and deployment view
- `docs/LLD.md` - Module-level behavior, class responsibilities, and flows
- `docs/BRD.md` - Business requirements
- `docs/PRD.md` - Product requirements
- `docs/API_SPECS.md` - API contracts and cross-cutting behavior

## Notes

- This repository intentionally keeps documentation in markdown only.
- No PDF generation is required for the current documentation workflow.

