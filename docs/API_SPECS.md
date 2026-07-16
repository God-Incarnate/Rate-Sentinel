# Rate-Sentinel API Specifications

Version: 1.0
Date: 2026-07-17
Base URL: `http://localhost:8080`
Content Type: `application/json`

## 1. Authentication

### POST `/api/auth/login`
Authenticate a user and return JWT token details.

Request (form/query params):
- `username` (string, required)
- `password` (string, required)

Success 200:
```json
{
  "token": "<jwt>",
  "type": "Bearer",
  "username": "admin"
}
```

Errors:
- `401 Unauthorized` for invalid credentials.

## 2. OTP APIs

### POST `/api/v1/otp/generate-otp`
Generate OTP and dispatch notification.

Query params:
- `identifier` (string, required)
- `otpType` (enum, required): `SMS`, `EMAIL`, `WHATSAPP`

Success 200:
```json
{
  "Message": "OTP sent successfully"
}
```

Common errors:
- `400 Bad Request` invalid input.
- `429 Too Many Requests` rate limit exceeded.
- `500` lockout/dispatch errors if raised by service.

### POST `/api/v1/otp/verify-otp`
Verify provided OTP.

Query params:
- `identifier` (string, required)
- `otp` (string, required)
- `otpType` (enum, required): `SMS`, `EMAIL`, `WHATSAPP`

Success 200:
```json
{
  "Verified": true
}
```

## 3. Payment API

### POST `/api/v1/payment/createPayment`
Create/process payment with idempotency protection.

Headers:
- `Idempotency-Key` (string, required)

Query params:
- `username` (string, required)
- `amount` (decimal, required, positive)
- `currency` (string, required)
- `description` (string, optional)

Success 200:
```json
{
  "id": 101,
  "idempotencyKey": "1f3138af-2b2b-4b59-9f4f-0d6432a98f62",
  "clientId": "john",
  "amount": 199.99,
  "currency": "INR",
  "status": "SUCCESS",
  "description": "Ride payment"
}
```

Behavior:
- Repeated request with same `Idempotency-Key` returns existing payment outcome.

## 4. Admin Rule Management

All endpoints require admin role.

### GET `/api/admin/rules`
List all configured rules.

Success 200:
```json
[
  {
    "id": 1,
    "clientId": "*",
    "route": "/api/v1/otp/generate-otp",
    "requestLimit": 5,
    "windowSeconds": 60,
    "algorithm": "SLIDING_WINDOW",
    "active": true
  }
]
```

### POST `/api/admin/rules`
Create new rate-limit rule.

Request body:
```json
{
  "clientId": "*",
  "route": "/api/v1/otp/generate-otp",
  "requestLimit": 5,
  "windowSeconds": 60,
  "algorithm": "SLIDING_WINDOW",
  "active": true
}
```

Success 200: created rule object.

### PUT `/api/admin/rules/{id}`
Update existing rate-limit rule.

Request body: same as create.

Success 200: updated rule object.

### DELETE `/api/admin/rules/{id}`
Delete rate-limit rule.

Success 204: no content.

## 5. Cross-Cutting API Behavior

### Rate-limit Headers
Returned on protected endpoints:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Algorithm`

### Throttle Response
When quota is exceeded:

Status: `429 Too Many Requests`
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 60,
  "clientId": "client-abc"
}
```

### Health and Metrics
Public endpoints:
- `GET /actuator/health`
- `GET /actuator/prometheus`

## 6. Security Summary

- JWT is required for protected APIs.
- `/api/auth/**` and `/actuator/**` are public.
- Admin rule routes require admin role via method security.

