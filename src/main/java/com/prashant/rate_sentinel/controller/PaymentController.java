package com.prashant.rate_sentinel.controller;

import com.prashant.rate_sentinel.model.Payment;
import com.prashant.rate_sentinel.service.PaymentService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;

@RestController
@RequiredArgsConstructor
@RequestMapping("api/v1/payment")
public class PaymentController {

    private final PaymentService paymentService;

    @PostMapping("/createPayment")
    public ResponseEntity<Payment> createPayment(
            //@AuthenticationPrincipal UserDetails userDetails,
            @RequestParam String username,
            @RequestHeader("Idempotency-Key") @NotBlank String idempotencyKey,
            @RequestParam @Positive BigDecimal amount,
            @RequestParam @NotBlank String currency,
            @RequestParam(required=false) String description
    ) {
        Payment payment=paymentService.processPayment(
                //userDetails.getUsername(),
                username,
                idempotencyKey,
                amount,
                currency,
                description);
        return ResponseEntity.ok(payment);
    }
}
