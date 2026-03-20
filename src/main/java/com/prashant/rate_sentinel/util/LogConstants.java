package com.prashant.rate_sentinel.util;

public interface LogConstants {
    String DUPLICATE_PAYMENT_MSG="Duplicate payment request detected for idempotencyKey={}";
    String ERROR_SAVING_PAYMENT_MSG="Could not save payment due to: {}";
    String PAYMENT_SUCCESS="Payment processed successfully id={} clientId={}";
    String PAYMENT_GATEWAY_PAYMENT_SUCCESS="Payment processed successfully by Gateway id={} clientId={}";
    String PAYMENT_FAILURE="Payment failed id={} reason={}";
    String DISPATCHED_EVENT_MSG="Dispatched eventId={} channel={} topic={} priority={}";
    String PAYMENT_MSG_PUBLISH_FAILURE="Failed to publish to topic={} key={}";
    String OTP_GENERATED_DISPATCHED="OTP generated and dispatched for identifier={} type={}";
}
