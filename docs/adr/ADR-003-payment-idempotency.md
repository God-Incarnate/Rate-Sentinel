# ADR-003: Idempotency key pattern for payment deduplication

## Status
Accepted

## Context
Payment endpoints are called over unreliable networks. Retries without
deduplication cause double charges — a critical business failure.

## Decision
Client-supplied UUID `Idempotency-Key` header, checked in Redis (fast path)
then MySQL (durable path) before any payment processing begins.

## Reasoning
- Redis check: O(1), sub-millisecond — handles retry storms without DB hits
- MySQL check: durable guard against Redis eviction edge cases
- 24-hour TTL on Redis key matches typical client retry window
- Pattern is identical to Stripe and Razorpay's idempotency implementation

## Consequences
- Clients must generate a stable UUID per payment intent
- Two storage lookups per request (acceptable given payment criticality)
- Idempotency keys older than 24h are not protected — documented limitation
