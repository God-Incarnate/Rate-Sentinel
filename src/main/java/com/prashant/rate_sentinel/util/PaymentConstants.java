package com.prashant.rate_sentinel.util;

public interface PaymentConstants {
    String IDEMPOTENCY_PREFIX="payment:idem";
    long IDEMPOTENCY_TTL_HOURS=24;
    String SUCCESS_TEMPLATE_ID="success_template";
    String FAILURE_TEMPLATE_ID="failure_template";
}
