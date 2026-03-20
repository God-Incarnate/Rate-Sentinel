# ADR-002: Kafka over Azure Service Bus for notification dispatch

## Status
Accepted

## Context
Notifications need to be dispatched asynchronously across SMS, Email,
WhatsApp, and Payment channels. Two options: Azure Service Bus (existing
TVS infra) and Apache Kafka.

## Decision
Kafka with 4 dedicated topics (topic.sms, topic.email, topic.whatsapp,
topic.payment).

## Reasoning
- Kafka consumer groups allow Repo 2 to scale independently per topic
- Topic-level partitioning gives natural priority lanes
- Replay capability — failed messages can be reprocessed from offset
- Open source, no vendor lock-in, free local dev via Docker

## Consequences
- Requires Zookeeper (or KRaft) in local dev
- Slightly more infra overhead than Service Bus
- Repo 2 owns all consumer logic — clean separation of concerns
