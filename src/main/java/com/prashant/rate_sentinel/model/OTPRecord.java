package com.prashant.rate_sentinel.model;

import com.prashant.rate_sentinel.enums.NotificationChannel;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Entity
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Table(name="otp")
public class OTPRecord {
    @Id
    @GeneratedValue(strategy= GenerationType.IDENTITY)
    private long id;

    @Column(nullable=false)
    private String identifier;

    @Column(nullable=false)
    @Enumerated(EnumType.STRING)
    private NotificationChannel otpType;

    @Column(nullable=false)
    private String hashedOTP;

    @Column(nullable=false)
    private LocalDateTime expiresAt;

    @Column(nullable=false)
    @Builder.Default
    private int attempts=0;

    @Column(nullable=false)
    private boolean used;

    @Column(nullable=false)
    @Builder.Default
    private LocalDateTime createdAt=LocalDateTime.now();
}
