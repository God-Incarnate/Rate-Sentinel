package com.prashant.rate_sentinel.model;

import com.prashant.rate_sentinel.enums.PaymentStatus;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "payments")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Payment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique=true, nullable=false)
    private String idempotencyKey;

    @Column(nullable=false)
    private String clientId;

    @Column(nullable=false, precision=12, scale=2)
    private BigDecimal amount;

    @Column(nullable=false, length=3)
    private String currency;

    @Column(nullable=false)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private PaymentStatus status= PaymentStatus.PENDING;

    private String description;

    private String failureReason;

    @Column(updatable=false)
    @Builder.Default
    private LocalDateTime createdAt=LocalDateTime.now();

    private LocalDateTime processedAt;

}
