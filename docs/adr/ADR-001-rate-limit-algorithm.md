# ADR-001: Sliding Window as default rate-limit algorithm

## Status
Accepted

## Context
We needed a default rate-limiting algorithm that balances accuracy, fairness,
and Redis overhead. Three options were evaluated: Fixed Window, Token Bucket,
and Sliding Window Log.

## Decision
Sliding Window Log (Redis sorted set) is the default. Clients can override
per-route via the Admin Rule API.

## Reasoning
- Fixed Window allows burst spikes at window boundaries (2x limit in 1 second)
- Token Bucket is accurate but requires two Redis keys and a refill calculation
- Sliding Window Log uses a sorted set — O(log N) ops, atomic, no boundary bursts

## Consequences
- Slightly higher Redis memory per key (sorted set vs single counter)
- Sub-millisecond decision latency maintained via Lua atomicity
- Algorithm is swappable per client/route without code changes
