package com.prashant.rate_sentinel.service;

import com.prashant.rate_sentinel.enums.NotificationChannel;
import com.prashant.rate_sentinel.enums.NotificationPriority;
import com.prashant.rate_sentinel.enums.PaymentStatus;
import com.prashant.rate_sentinel.model.NotificationEvent;
import com.prashant.rate_sentinel.model.Payment;
import com.prashant.rate_sentinel.repository.PaymentRepository;
import com.prashant.rate_sentinel.util.LogConstants;
import com.prashant.rate_sentinel.util.PaymentConstants;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentService {
    private final PaymentRepository paymentRepository;
    private final StringRedisTemplate redisTemplate;
    private final NotificationDispatcherService dispatcherService;

    @Transactional
    public Payment processPayment(String clientId, String idempotencyKey, BigDecimal amount, String currency, String description) {
        //check redis for idempotencyKey
        //if key.isPresent in redis -> return existing Payment details
        String redisKey = PaymentConstants.IDEMPOTENCY_PREFIX + idempotencyKey;
        String existingId = redisTemplate.opsForValue().get(redisKey);
        if (existingId != null) {
            log.info(LogConstants.DUPLICATE_PAYMENT_MSG, idempotencyKey);
            return paymentRepository.findByIdempotencyKey(idempotencyKey).orElseThrow(() -> new IllegalArgumentException("Idempotency Key collision"));
        }

        //if key.isNotPresent in redis -> check in DB
        if (paymentRepository.existsByIdempotencyKey(idempotencyKey)) {
            return paymentRepository.findByIdempotencyKey(idempotencyKey).orElseThrow();
        }

        //else -> make new payment ->save Payment
        Payment newPayment = Payment.builder()
                .idempotencyKey(idempotencyKey)
                .clientId(clientId)
                .amount(amount)
                .currency(currency)
                .status(PaymentStatus.PENDING)
                .description(description)
                .build();

        savePayment(newPayment);

        // processPaymentGateway() to process the payment -> update Payment details -> save -> update idempotencyKey in redis
        try {
            processPaymentGateway(newPayment);
            newPayment.setStatus(PaymentStatus.SUCCESS);
            newPayment.setProcessedAt(LocalDateTime.now());
            savePayment(newPayment);

            //store idempotencyKey in redis
            redisTemplate.opsForValue().set(
                    redisKey,
                    String.valueOf(
                            newPayment.getClientId()),
                    PaymentConstants.IDEMPOTENCY_TTL_HOURS,
                    TimeUnit.HOURS);

            //dispatch notification for success message
            dispatchNotification(newPayment,PaymentConstants.SUCCESS_TEMPLATE_ID);
            log.info(LogConstants.PAYMENT_SUCCESS,newPayment.getId(),clientId);
        } catch (Exception e) {
            newPayment.setStatus(PaymentStatus.FAILED);
            newPayment.setFailureReason(e.getMessage());
            savePayment(newPayment);

            dispatchNotification(newPayment,PaymentConstants.FAILURE_TEMPLATE_ID);
            log.error(LogConstants.PAYMENT_FAILURE,newPayment.getId(),e.getMessage());
        }

        return newPayment;
    }

    private void processPaymentGateway(Payment payment) {
        //implement payment gateway processing
        log.info(LogConstants.PAYMENT_GATEWAY_PAYMENT_SUCCESS,payment.getId(),payment.getClientId());
    }

    private void dispatchNotification(Payment payment, String templateId) {
        NotificationEvent newEvent=NotificationEvent.builder()
                .eventId(String.valueOf(UUID.randomUUID()))
                .templateId(templateId)
                .clientId(payment.getClientId())
                .recipient(payment.getClientId())
                .channel(NotificationChannel.EMAIL)
                .templateParams(Map.of(
                        "amount", payment.getAmount().toPlainString(),
                        "currency", payment.getCurrency(),
                        "status", payment.getStatus().name(),
                        "paymentId", String.valueOf(payment.getId())))
                .priority(NotificationPriority.HIGH)
                .correlationId(String.valueOf(payment.getId()))
                .build();

        dispatcherService.dispatch(newEvent);
    }

    private void savePayment(Payment payment){
        try{
            paymentRepository.save(payment);
        } catch (Exception e){
            log.error(LogConstants.ERROR_SAVING_PAYMENT_MSG,e);
        }
    }
}
