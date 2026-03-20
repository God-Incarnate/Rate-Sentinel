package com.prashant.rate_sentinel.repository;

import com.prashant.rate_sentinel.enums.NotificationChannel;
import com.prashant.rate_sentinel.model.OTPRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface OTPRepository extends JpaRepository<OTPRecord,Long>{
    Optional<OTPRecord> findTopByIdentifierAndOtpTypeAndUsedFalseOrderByCreatedAtDesc(String identifier, NotificationChannel otpType);
}
