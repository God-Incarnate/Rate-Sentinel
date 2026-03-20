package com.prashant.rate_sentinel.util;

public interface OTPConstants {
    String OTP_SENT_SUCCESS="OTP sent successfully";
    String OTP_VERIFY_LOCKED_REMINDER ="Account locked due to too many attempts.";
    String OTP_GENERATE_LOCKED="Account Locked. Try again later.";
    String OTP_VERIFY_NO_ACTIVE_OTP_FOUND="No active OTP found.";
    String OTP_VERIFY_EXPIRED="OTP has expired.";
    String OTP_VERIFY_LOCKED_ACK="Too many attempts. Account locked for ";
}
