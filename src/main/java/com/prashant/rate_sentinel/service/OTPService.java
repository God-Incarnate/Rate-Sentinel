package com.prashant.rate_sentinel.service;

import com.prashant.rate_sentinel.enums.NotificationChannel;
import com.prashant.rate_sentinel.enums.NotificationPriority;
import com.prashant.rate_sentinel.model.NotificationEvent;
import com.prashant.rate_sentinel.model.OTPRecord;
import com.prashant.rate_sentinel.repository.OTPRepository;
import com.prashant.rate_sentinel.util.LogConstants;
import com.prashant.rate_sentinel.util.OTPConstants;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class OTPService {

    private final OTPRepository otpRepo;
    private final RedisTemplate redisTemplate;
    private final NotificationDispatcherService notificationDispatcher;
    private final SecureRandom secureRandom=new SecureRandom();
    private final BCryptPasswordEncoder passwordEncoder=new BCryptPasswordEncoder();

    @Value("${otp.length}")
    private int otpLength;

    @Value("${otp.expiry-seconds}")
    private int expirySeconds;

    @Value("${otp.max-attempts}")
    private int maxAttempts;

    @Value("${otp.lockout-seconds}")
    private int lockoutSeconds;

    @Transactional
    public String generatesOTP(String identifier, NotificationChannel otpType){
        lockCheck(identifier,OTPConstants.OTP_GENERATE_LOCKED);

        String otp=generateOtp();
        String hashed=passwordEncoder.encode(otp);

        OTPRecord otpRecord=OTPRecord.builder()
                .identifier(identifier)
                .otpType(otpType)
                .hashedOTP(hashed)
                .expiresAt(LocalDateTime.now().plusSeconds(expirySeconds))
                .build();

        otpRepo.save(otpRecord);

        NotificationEvent otpEvent=NotificationEvent.builder()
                .eventId(UUID.randomUUID().toString())
                .clientId("otp-service")
                .recipient(identifier)
                .channel(otpType)
                .templateId("otp_verification")
                .templateParams(Map.of("otp", otp, "expiry", String.valueOf(expirySeconds / 60) + " mins"))
                .priority(NotificationPriority.HIGH)
                .correlationId(String.valueOf(otpRecord.getId()))
                .build();

        notificationDispatcher.dispatch(otpEvent);
        log.info(LogConstants.OTP_GENERATED_DISPATCHED,identifier,otpType);

        return OTPConstants.OTP_SENT_SUCCESS;
    }

    @Transactional
    public boolean verifiesOTP(String identifier, String otp, NotificationChannel otpType){
        String lockKey=lockCheck(identifier,OTPConstants.OTP_VERIFY_LOCKED_REMINDER);

        OTPRecord otpRecord= otpRepo
                .findTopByIdentifierAndOtpTypeAndUsedFalseOrderByCreatedAtDesc(identifier,otpType)
                .orElseThrow(()-> new IllegalArgumentException(OTPConstants.OTP_VERIFY_NO_ACTIVE_OTP_FOUND));

        if (LocalDateTime.now().isAfter(otpRecord.getExpiresAt())){
            throw new IllegalArgumentException(OTPConstants.OTP_VERIFY_EXPIRED);
        }

        otpRecord.setAttempts(otpRecord.getAttempts()+1);

        if(otpRecord.getAttempts()>=maxAttempts){
            redisTemplate.opsForValue().set(lockKey,1,lockoutSeconds, TimeUnit.SECONDS);
            otpRepo.save(otpRecord);
            throw new IllegalStateException(OTPConstants.OTP_VERIFY_LOCKED_ACK + (lockoutSeconds / 60)+" minutes.");
        }

        if(!passwordEncoder.matches(otp,otpRecord.getHashedOTP())){
            otpRepo.save(otpRecord);
            return false;
        }

        otpRecord.setUsed(true);
        otpRepo.save(otpRecord);
        return true;
    }


    private String generateOtp(){
        int bound = (int) Math.pow(10, otpLength);
        return String.format("%0" + otpLength + "d", secureRandom.nextInt(bound));
    }

    private String lockCheck(String identifier,String statement){
        String lockKey="otp:lock:"+identifier;
        if (Boolean.TRUE.equals(redisTemplate.hasKey(lockKey))){
            throw new IllegalStateException(statement);
        }
        return lockKey;
    }
}
